import base64
import io
import logging
import glob
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, cast

import torch  # type: ignore
from fastapi import FastAPI, HTTPException  # type: ignore
from PIL import Image  # type: ignore
from pydantic import BaseModel, Field  # type: ignore
from transformers import AutoModel, AutoProcessor  # type: ignore
from qdrant_client import QdrantClient  # type: ignore
from qdrant_client.models import PointStruct, VectorParams, Distance    # type: ignore


# --- Configuration ---
MODEL_ID = os.getenv(
    "VISUAL_RAG_MODEL", "TomoroAI/tomoro-ai-colqwen3-embed-4b-awq"
)
INDEX_DIR = Path(os.getenv("INDEX_DIR", "/data/indices"))
DEVICE = "cuda"
QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("visual_rag_native")


# --- Pydantic Models for Validation ---
class IndexRequest(BaseModel):
    doc_id: int
    images: List[str]


class IndexDirectoryRequest(BaseModel):
    doc_id: int
    path: str


class SearchRequest(BaseModel):
    query: str
    k: int = Field(default=5, ge=1, le=50)


class GlobalState:
    """Explicitly typed state container for Pylance transparency."""
    model: Any = None
    processor: Any = None
    qdrant: Any = None
    # doc_id string keys for the 320-dim tensor registry
    registry: Dict[str, torch.Tensor] = {}


state = GlobalState()


# --- Lifespan Manager (Replaces deprecated on_event) ---
@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initializes the 320-dim ColQwen3 bridge on startup."""
    logger.info("🚀 Initializing ColQwen3 (4B-AWQ) on %s...", DEVICE)

    # Cast loaders to Any to prevent Pylance 'partially unknown' errors
    p_load: Any = AutoProcessor
    m_load: Any = AutoModel

    state.processor = p_load.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        max_num_visual_tokens=1280
    )

    state.model = m_load.from_pretrained(
        MODEL_ID,
        trust_remote_code=True,
        torch_dtype=torch.float16,
        device_map=DEVICE,
        attn_implementation="flash_attention_2"
    ).eval()

    try:
        state.qdrant = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        logger.info("✅ Qdrant client initialized (%s:%d)", QDRANT_HOST, QDRANT_PORT)
        
        # Ensure visual_pages collection exists with correct config
        collections = state.qdrant.get_collections().collections
        if not any(c.name == "visual_pages" for c in collections):
            logger.info("Creating 'visual_pages' collection")
            state.qdrant.create_collection(
                collection_name="visual_pages",
                vectors_config={
                    "page_embedding": VectorParams(size=320, distance=Distance.DOT)
                },
            )
    except Exception as exc:
        logger.warning("⚠️ Qdrant initialization failed: %s", exc)

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    for p in INDEX_DIR.glob("*.pt"):
        # weights_only=True is mandatory for secure loading
        loaded = torch.load(p, map_location="cpu", weights_only=True)
        state.registry[p.stem] = cast(torch.Tensor, loaded)

    logger.info("✅ Ready. Registry size: %d", len(state.registry))
    yield
    state.registry.clear()


app = FastAPI(title="Native ColQwen3 Visual RAG", lifespan=lifespan)


# --- Endpoints ---

async def _process_images(doc_id: int, pil_images: List[Any]) -> Dict[str, Any]:
    """Shared logic for processing and indexing a list of PIL images."""
    doc_id_str = str(doc_id)
    try:
        with torch.inference_mode():
            # Processor handles Dynamic Resolution patching
            inputs = state.processor.process_images(pil_images).to(DEVICE)
            out = state.model(**inputs)
            # embeddings is the native 320-dim output for ColQwen3
            embeddings = cast(
                torch.Tensor, out.embeddings
            ).to(torch.bfloat16).cpu()

        torch.save(embeddings, INDEX_DIR / f"{doc_id_str}.pt")
        state.registry[doc_id_str] = embeddings

        if state.qdrant:
            try:
                # Serialize full tensor for SOT restoration
                buffer = io.BytesIO()
                torch.save(embeddings, buffer)
                tensor_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

                # Mean pooling for vector index (approximate semantic rep)
                mean_vec = embeddings.float().view(-1, 320).mean(dim=0).tolist()

                state.qdrant.upsert(
                    collection_name="visual_pages",
                    points=[
                        PointStruct(
                            id=doc_id,
                            vector={"page_embedding": mean_vec},
                            payload={
                                "doc_id": doc_id,
                                "tensor_b64": tensor_b64,
                                "page_count": len(pil_images)
                            }
                        )
                    ]
                )
                logger.info("✅ Synced doc %s to Qdrant SOT", doc_id_str)
            except Exception as exc:
                logger.error("⚠️ Qdrant sync failed for %s: %s", doc_id_str, exc)

        vram = torch.cuda.memory_allocated() / 1e9
        return {
            "status": "success",
            "doc_id": doc_id,
            "vram_gb": f"{vram:.2f}"
        }
    except Exception as exc:
        logger.error("Index error for %s: %s", doc_id_str, exc)
        raise exc


@app.post("/index/document")
async def index_document(payload: IndexRequest) -> Dict[str, Any]:
    if state.model is None or state.processor is None:
        raise HTTPException(status_code=503, detail="Initializing")

    try:
        pil_images: List[Any] = []
        for img_b64 in payload.images:
            img_data = base64.b64decode(img_b64)
            # Surgical ignore for unresolved PIL members
            img = Image.open(io.BytesIO(img_data)).convert("RGB")  # type: ignore
            pil_images.append(img)
        
        return await _process_images(payload.doc_id, pil_images)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Indexing failure")


@app.post("/index/directory")
async def index_directory(payload: IndexDirectoryRequest) -> Dict[str, Any]:
    if state.model is None or state.processor is None:
        raise HTTPException(status_code=503, detail="Initializing")

    try:
        image_paths = sorted(glob.glob(os.path.join(payload.path, "*")))
        pil_images: List[Any] = []
        for p in image_paths:
            if p.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                pil_images.append(Image.open(p).convert("RGB"))
        
        return await _process_images(payload.doc_id, pil_images)
    except Exception as exc:
        logger.error("Directory index error: %s", exc)
        raise HTTPException(status_code=500, detail="Indexing failure")


@app.post("/search")
async def search(payload: SearchRequest) -> Dict[str, Any]:
    if state.model is None or state.processor is None:
        raise HTTPException(status_code=503, detail="Initializing")

    if state.qdrant:
        try:
            with torch.inference_mode():
                q_inputs = state.processor.process_texts(
                    [payload.query]
                ).to(DEVICE)
                q_out = state.model(**q_inputs)
                # Mean pool query for vector search
                query_emb = cast(torch.Tensor, q_out.embeddings).float().cpu()
                query_vec = query_emb.mean(dim=1).view(-1).tolist()

            hits = state.qdrant.search(
                collection_name="visual_pages",
                query_vector=("page_embedding", query_vec),
                limit=payload.k
            )

            results: List[Dict[str, Any]] = []
            for h in hits:
                doc_id = h.payload.get("doc_id") if h.payload else h.id
                results.append({"doc_id": int(doc_id), "score": round(h.score, 4)})

            return {"query": payload.query, "results": results}
        except Exception:
            logger.exception("Qdrant search failure")
            raise HTTPException(status_code=500, detail="Search error")

    if not state.registry:
        return {"query": payload.query, "results": []}

    try:
        with torch.inference_mode():
            # Split encoding call to satisfy Flake8 E501
            q_inputs = state.processor.process_texts(
                [payload.query]
            ).to(DEVICE)
            q_out = state.model(**q_inputs)
            query_emb = (
                cast(torch.Tensor, q_out.embeddings).to(torch.float16).cpu()
            )

            # 2. Extract registry for MaxSim scoring
            doc_ids = list(state.registry.keys())
            doc_tensors = [state.registry[i] for i in doc_ids]

            # 3. Native MaxSim Scoring
            scores_tensor = state.processor.score_multi_vector(
                query_emb, doc_tensors
            )[0]
            scores = cast(torch.Tensor, scores_tensor)

        # 4. Filter Top-K and cast result lists
        top_val, top_idx = torch.topk(scores, min(payload.k, len(scores)))

        # Surgical ignore for unresolved tensor methods
        indices = cast(List[int], top_idx.tolist())  # type: ignore
        values = cast(List[float], top_val.tolist())  # type: ignore

        results: List[Dict[str, Any]] = []
        for i, idx in enumerate(indices):
            results.append({
                "doc_id": int(doc_ids[idx]),
                "score": round(values[i], 4)
            })

        return {"query": payload.query, "results": results}
    except Exception:
        logger.exception("Search failure")
        raise HTTPException(status_code=500, detail="Search error")


@app.get("/health")
async def health() -> Dict[str, Any]:
    vram = (
        torch.cuda.memory_allocated() / 1e9
        if torch.cuda.is_available() else 0
    )
    return {
        "status": "healthy" if state.model else "loading",
        "docs": len(state.registry),
        "vram": f"{vram:.2f}GB",
        "qdrant": "healthy" if state.qdrant else "disconnected"
    }
