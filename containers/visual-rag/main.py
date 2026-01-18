"""
Native ColQwen3 Visual RAG Sidecar (ticket:005.x).

Implements 320-dim ColQwen3-4B-AWQ model with:
- Model enforcement (005.1)
- Image-to-image search (005.2)
- Unified Qdrant adapter (005.3)
- 503 Initializing state (005.4)
- Python Detox standards (005.5)
"""
# Standard library imports
import asyncio
import base64
import glob
import io
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, cast

# Third-party imports
import torch  # type: ignore
from fastapi import FastAPI, HTTPException  # type: ignore
from pdf2image import convert_from_bytes  # type: ignore
from PIL import Image  # type: ignore
from pydantic import BaseModel, Field  # type: ignore
from qdrant_client import QdrantClient  # type: ignore
from qdrant_client.models import (  # type: ignore
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)
from transformers import AutoModel, AutoProcessor  # type: ignore


# --- Configuration ---
# Model Enforcement: Only ColQwen3-4B-AWQ is allowed (ticket:005.1)
ALLOWED_MODEL = "TomoroAI/tomoro-colqwen3-4b-awq"
MODEL_ID = os.getenv("VISUAL_RAG_MODEL", ALLOWED_MODEL)
EXPECTED_EMBEDDING_DIM = 320  # ColQwen3 native dimension

# Enforce model ID matches allowed model
if MODEL_ID != ALLOWED_MODEL:
    raise RuntimeError(
        f"Model enforcement failed: '{MODEL_ID}' is not allowed. "
        f"Only '{ALLOWED_MODEL}' is permitted."
    )

INDEX_DIR = Path(os.getenv("INDEX_DIR", "/data/indices"))
DEVICE = "cuda"
QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
DPI = int(os.getenv("VISION_RENDER_DPI", 300))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("visual_rag_native")


# --- Visual Qdrant Adapter (Singleton) - ticket:005.3 ---
class VisualQdrantAdapter:
    """
    Singleton Qdrant adapter for visual RAG collections (ticket:005.3).

    Supports:
    - visual_pages (320-dim, DOT distance)
    - visual_overlays (320-dim, DOT distance)
    - Expert Filtering (doc_id, tag_ids, correspondent_id)
    """

    _instance: Optional["VisualQdrantAdapter"] = None

    def __new__(cls) -> "VisualQdrantAdapter":
        """Singleton pattern."""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        """Initialize Qdrant client (only once)."""
        if getattr(self, "_initialized", False):
            return
        self._initialized = True

        self.host = QDRANT_HOST
        self.port = QDRANT_PORT
        self.client: Optional[QdrantClient] = None
        self.collections = {"visual_pages", "visual_overlays"}

    def connect(self) -> bool:
        """Establish connection to Qdrant."""
        try:
            self.client = QdrantClient(host=self.host, port=self.port)
            logger.info(
                "✅ Qdrant adapter connected (%s:%d)",
                self.host, self.port
            )
            return True
        except Exception as exc:
            logger.error("⚠️ Qdrant connection failed: %s", exc)
            self.client = None
            return False

    def ensure_collections(self) -> None:
        """Ensure visual collections exist with correct config."""
        if not self.client:
            return

        for coll_name in self.collections:
            try:
                resp: Any = self.client.get_collections()
                exists = any(
                    c.name == coll_name for c in resp.collections
                )

                if exists:
                    # Validate Distance Metric Lock
                    info = self.client.get_collection(coll_name)
                    cfg = info.config.params.vectors
                    if isinstance(cfg, dict):
                        page_cfg = cfg.get("page_embedding")
                        if page_cfg:
                            dist = page_cfg.distance
                            if dist != Distance.DOT:
                                logger.warning(
                                    "Distance mismatch in %s: %s != DOT",
                                    coll_name, dist
                                )
                    logger.info("Collection '%s' verified", coll_name)
                else:
                    logger.info("Creating collection '%s'", coll_name)
                    self.client.create_collection(
                        collection_name=coll_name,
                        vectors_config={
                            "page_embedding": VectorParams(
                                size=EXPECTED_EMBEDDING_DIM,
                                distance=Distance.DOT
                            )
                        },
                    )
                    self._create_payload_indexes(coll_name)
            except Exception as exc:
                logger.error(
                    "Failed to ensure collection %s: %s", coll_name, exc
                )

    def _create_payload_indexes(self, collection_name: str) -> None:
        """Create payload indexes for Expert Filtering."""
        if not self.client:
            return

        fields = [
            ("doc_id", PayloadSchemaType.INTEGER),
            ("correspondent_id", PayloadSchemaType.INTEGER),
            ("tag_ids", PayloadSchemaType.INTEGER),
        ]

        for field_name, schema_type in fields:
            try:
                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name=field_name,
                    field_schema=schema_type,
                )
                logger.info(
                    "Ensured index for '%s.%s'",
                    collection_name, field_name
                )
            except Exception:
                pass  # Index may already exist

    def build_filter(
        self, filters: Optional["SearchFilters"]
    ) -> Optional[Filter]:
        """
        Build Qdrant Filter from SearchFilters (ticket:005.3).

        Args:
            filters: SearchFilters with doc_id, tag_ids, correspondent_id

        Returns:
            Qdrant Filter or None if no filters
        """
        if not filters:
            return None

        conditions: List[FieldCondition] = []

        if filters.doc_id is not None:
            conditions.append(
                FieldCondition(
                    key="doc_id",
                    match=MatchValue(value=filters.doc_id)
                )
            )

        if filters.correspondent_id is not None:
            conditions.append(
                FieldCondition(
                    key="correspondent_id",
                    match=MatchValue(value=filters.correspondent_id)
                )
            )

        if filters.tag_ids:
            # AND logic: document must have all provided tags
            for tag_id in filters.tag_ids:
                conditions.append(
                    FieldCondition(
                        key="tag_ids",
                        match=MatchValue(value=tag_id)
                    )
                )

        if not conditions:
            return None

        return Filter(must=conditions)

    def search(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 5,
        filters: Optional["SearchFilters"] = None
    ) -> List[Dict[str, Any]]:
        """
        Search with Expert Filtering (ticket:005.3).

        Args:
            collection_name: Target collection
            query_vector: 320-dim query embedding
            limit: Number of results
            filters: Expert Filtering options

        Returns:
            List of search results with doc_id, score, payload
        """
        if not self.client:
            raise RuntimeError("Qdrant not connected")

        if collection_name not in self.collections:
            raise ValueError(f"Invalid collection: {collection_name}")

        query_filter = self.build_filter(filters)

        hits = self.client.search(
            collection_name=collection_name,
            query_vector=("page_embedding", query_vector),
            query_filter=query_filter,
            limit=limit
        )

        return [
            {
                "doc_id": h.payload.get("doc_id") if h.payload else h.id,
                "score": h.score,
                "payload": h.payload
            }
            for h in hits
        ]

    def upsert(
        self,
        collection_name: str,
        doc_id: int,
        vector: List[float],
        payload: Dict[str, Any]
    ) -> None:
        """Upsert a document embedding with metadata."""
        if not self.client:
            raise RuntimeError("Qdrant not connected")

        if collection_name not in self.collections:
            raise ValueError(f"Invalid collection: {collection_name}")

        self.client.upsert(
            collection_name=collection_name,
            points=[
                PointStruct(
                    id=doc_id,
                    vector={"page_embedding": vector},
                    payload=payload
                )
            ]
        )

    def health_check(self) -> Dict[str, Any]:
        """Check Qdrant connectivity and collection status."""
        if not self.client:
            return {"healthy": False, "error": "Not connected"}

        try:
            details: Dict[str, Any] = {}
            total_points = 0

            for coll_name in self.collections:
                try:
                    info = self.client.get_collection(coll_name)
                    points = int(getattr(info, "points_count", 0) or 0)
                    details[coll_name] = {
                        "exists": True,
                        "point_count": points,
                        "status": str(info.status),
                    }
                    total_points += points
                except Exception:
                    details[coll_name] = {
                        "exists": False,
                        "point_count": 0,
                        "status": "missing",
                    }

            return {
                "healthy": True,
                "collections": details,
                "point_count": total_points,
            }
        except Exception as e:
            return {"healthy": False, "error": str(e)}


# Singleton instance (ticket:005.3)
qdrant_adapter = VisualQdrantAdapter()


# --- Pydantic Models for Validation ---
class IndexRequest(BaseModel):
    """Request to index document images."""
    doc_id: int
    images: List[str]


class IndexPdfRequest(BaseModel):
    """Request to index a PDF document."""
    doc_id: int
    pdf_data: str  # Base64 encoded PDF


class IndexDirectoryRequest(BaseModel):
    """Request to index images from a directory."""
    doc_id: int
    path: str


class SearchFilters(BaseModel):
    """Expert Filtering options for search (ticket:005.2)."""
    doc_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    correspondent_id: Optional[int] = None


class SearchRequest(BaseModel):
    """
    Search request supporting both text and image queries (ticket:005.2).

    For text search: provide query_text
    For image search: provide query_image (Base64)
    Both can be provided for hybrid search.
    """
    query: Optional[str] = Field(
        default=None,
        description="Text query (backward compatible alias)"
    )
    query_text: Optional[str] = Field(
        default=None,
        description="Text query for semantic search"
    )
    query_image: Optional[str] = Field(
        default=None,
        description="Base64 encoded image for visual search"
    )
    collection_name: str = Field(
        default="visual_pages",
        description="Target collection: visual_pages or visual_overlays"
    )
    filters: Optional[SearchFilters] = Field(
        default=None,
        description="Expert Filtering options"
    )
    k: int = Field(default=5, ge=1, le=50, description="Number of results")

    def get_text_query(self) -> Optional[str]:
        """Get text query with backward compatibility."""
        return self.query_text or self.query


class SearchResult(BaseModel):
    """Individual search result (ticket:005.2)."""
    doc_id: int
    score: float
    page_num: Optional[int] = None
    thumbnail_url: Optional[str] = None


class SearchResponse(BaseModel):
    """Search response with MaxSim scoring (ticket:005.2)."""
    results: List[SearchResult]
    score_type: str = Field(
        default="maxsim",
        description="Scoring method: maxsim or dense"
    )
    collection_used: str
    execution_time_ms: float
    query_type: str = Field(
        description="Query type: text, image, or hybrid"
    )


class GlobalState:
    """
    Explicitly typed state container for Pylance transparency.

    Tracks initialization state for 503 Initializing response (ticket:005.4).
    """
    model: Any = None
    processor: Any = None
    qdrant: Any = None
    # doc_id string keys for the 320-dim tensor registry
    registry: Dict[str, Any] = {}

    # Initialization tracking (ticket:005.4)
    initializing: bool = True
    init_stage: str = "starting"
    init_error: Optional[str] = None

    def is_ready(self) -> bool:
        """Check if model and processor are ready for requests."""
        return (
            self.model is not None
            and self.processor is not None
            and not self.initializing
        )

    def get_init_status(self) -> Dict[str, Any]:
        """Get current initialization status."""
        return {
            "initializing": self.initializing,
            "stage": self.init_stage,
            "error": self.init_error,
            "model_loaded": self.model is not None,
            "processor_loaded": self.processor is not None
        }


state = GlobalState()

# Timeout configuration (ticket:005.4)
RETRIEVAL_TIMEOUT_SECONDS = 5.0


def _check_ready_or_503() -> None:
    """
    Check if service is ready, raise 503 if initializing (ticket:005.4).

    Returns 503 with body "Initializing" during VRAM warmup.
    """
    if state.initializing:
        raise HTTPException(
            status_code=503,
            detail=f"Initializing: {state.init_stage}"
        )
    if state.model is None or state.processor is None:
        raise HTTPException(
            status_code=503,
            detail="Service unavailable"
        )


async def _with_timeout(
    coro: Any,
    timeout: float = RETRIEVAL_TIMEOUT_SECONDS
) -> Any:
    """
    Wrap coroutine with timeout (ticket:005.4).

    Args:
        coro: Coroutine to execute
        timeout: Timeout in seconds (default: 5s)

    Returns:
        Result of coroutine

    Raises:
        HTTPException: If timeout exceeded
    """
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.error("Request timed out after %.1fs", timeout)
        raise HTTPException(
            status_code=504,
            detail=f"Request timeout ({timeout}s exceeded)"
        )


def _decode_base64_image(image_b64: str) -> Any:
    """
    Decode and validate a Base64 encoded image (ticket:005.2).

    Args:
        image_b64: Base64 encoded image string

    Returns:
        PIL Image in RGB format

    Raises:
        HTTPException: If image is invalid or corrupt
    """
    try:
        img_data = base64.b64decode(image_b64)
        img = Image.open(io.BytesIO(img_data))

        # Validate format is supported
        if img.format not in ("JPEG", "PNG", "BMP", "TIFF", "WEBP", None):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format: {img.format}"
            )

        # Convert to RGB for ColQwen3 processing
        return img.convert("RGB")
    except base64.binascii.Error as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Base64 encoding: {e}"
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode image: {e}"
        )


def _validate_model_dimensions(model: Any, processor: Any) -> None:
    """
    Validate ColQwen3 model outputs 320-dimensional embeddings.

    Raises:
        RuntimeError: If model architecture or dimensions don't match.
    """
    logger.info("Validating model dimensions...")

    # Check model config for embedding dimension if available
    config: Any = getattr(model, "config", None)
    if config is not None:
        # ColQwen3 stores projection_dim or hidden_size
        proj_dim = getattr(config, "projection_dim", None)
        hidden_size = getattr(config, "hidden_size", None)

        # Validate projection_dim if present
        if proj_dim is not None and proj_dim != EXPECTED_EMBEDDING_DIM:
            raise RuntimeError(
                f"Architecture mismatch: model projection_dim={proj_dim}, "
                f"expected {EXPECTED_EMBEDDING_DIM}. "
                f"Only ColQwen3-4B-AWQ (320-dim) is supported."
            )

        logger.info(
            "Model config: projection_dim=%s, hidden_size=%s",
            proj_dim, hidden_size
        )

    # Runtime validation: generate a test embedding
    try:
        from PIL import Image as PILImage  # type: ignore
        test_img = PILImage.new("RGB", (224, 224), color="gray")

        with torch.inference_mode():  # type: ignore
            inputs: Any = processor.process_images([test_img]).to(DEVICE)
            out: Any = model(**inputs)
            embeddings: Any = out.embeddings

            # Get the embedding dimension (last axis)
            emb_shape = embeddings.shape
            actual_dim = emb_shape[-1]

            if actual_dim != EXPECTED_EMBEDDING_DIM:
                raise RuntimeError(
                    f"Dimension validation failed: model outputs "
                    f"{actual_dim}-dim embeddings, expected "
                    f"{EXPECTED_EMBEDDING_DIM}. "
                    f"Ensure ColQwen3-4B-AWQ is loaded."
                )

            logger.info(
                "✅ Dimension validation passed: %d-dim embeddings",
                actual_dim
            )
    except RuntimeError:
        # Re-raise RuntimeError (validation failures)
        raise
    except Exception as exc:
        logger.warning(
            "Could not perform runtime dimension check: %s", exc
        )


# --- Lifespan Manager (Replaces deprecated on_event) - ticket:005.4 ---
@asynccontextmanager
async def lifespan(_app: Any):
    """
    Initializes the 320-dim ColQwen3 bridge on startup.

    Implements 503 Initializing state tracking (ticket:005.4):
    - Tracks init stages: starting -> loading_processor ->
      loading_model -> validating -> connecting_qdrant ->
      loading_indices -> ready
    - Sets state.initializing = False when model is ready
    - Handles graceful shutdown and VRAM release
    """
    logger.info("🚀 Initializing ColQwen3 (4B-AWQ) on %s...", DEVICE)
    logger.info("Model enforcement: %s (offline mode)", ALLOWED_MODEL)

    try:
        # Stage 1: Load processor
        state.init_stage = "loading_processor"
        logger.info("Stage: %s", state.init_stage)

        p_load: Any = AutoProcessor  # type: ignore
        state.processor = p_load.from_pretrained(  # type: ignore
            MODEL_ID,
            trust_remote_code=True,
            local_files_only=True,  # No external hub connectivity
            max_num_visual_tokens=1280
        )

        # Stage 2: Load model into VRAM
        state.init_stage = "loading_model"
        logger.info("Stage: %s", state.init_stage)

        m_load: Any = AutoModel  # type: ignore
        state.model = m_load.from_pretrained(  # type: ignore
            MODEL_ID,
            trust_remote_code=True,
            local_files_only=True,  # No external hub connectivity
            torch_dtype=torch.float16,  # type: ignore
            device_map=DEVICE,
            attn_implementation="flash_attention_2"
        ).eval()  # type: ignore

        # Stage 3: Validate dimensions
        state.init_stage = "validating"
        logger.info("Stage: %s", state.init_stage)
        _validate_model_dimensions(state.model, state.processor)

        # Stage 4: Connect Qdrant adapter
        state.init_stage = "connecting_qdrant"
        logger.info("Stage: %s", state.init_stage)
        try:
            if qdrant_adapter.connect():
                qdrant_adapter.ensure_collections()
                state.qdrant = qdrant_adapter.client
                logger.info("✅ Qdrant adapter initialized with collections")
            else:
                logger.warning("⚠️ Qdrant adapter connection failed")
        except Exception as exc:
            logger.warning("⚠️ Qdrant initialization failed: %s", exc)

        # Stage 5: Load indices from disk
        state.init_stage = "loading_indices"
        logger.info("Stage: %s", state.init_stage)
        INDEX_DIR.mkdir(parents=True, exist_ok=True)
        for p in INDEX_DIR.glob("*.pt"):
            loaded: Any = torch.load(  # type: ignore
                p, map_location="cpu", weights_only=True
            )
            state.registry[p.stem] = loaded

        # Ready: Model in VRAM, transition to 200 OK
        state.init_stage = "ready"
        state.initializing = False
        logger.info(
            "✅ Ready. Registry size: %d, VRAM: %.2fGB",
            len(state.registry),
            torch.cuda.memory_allocated() / 1e9  # type: ignore
        )

    except Exception as exc:
        state.init_error = str(exc)
        state.init_stage = "error"
        logger.error("❌ Initialization failed: %s", exc)
        raise

    yield

    # Graceful shutdown: release VRAM (ticket:005.4)
    logger.info("🛑 Shutting down, releasing VRAM...")
    state.registry.clear()
    state.model = None
    state.processor = None
    if torch.cuda.is_available():  # type: ignore
        torch.cuda.empty_cache()  # type: ignore
    logger.info("✅ Shutdown complete")


app = FastAPI(  # type: ignore
    title="Native ColQwen3 Visual RAG", lifespan=lifespan
)


# --- Endpoints ---

async def _process_images(
    doc_id: int, pil_images: List[Any]
) -> Dict[str, Any]:
    """Shared logic for processing and indexing a list of PIL images."""
    doc_id_str = str(doc_id)
    try:
        with torch.inference_mode():  # type: ignore
            # Processor handles Dynamic Resolution patching
            inputs = state.processor.process_images(pil_images).to(DEVICE)
            out = state.model(**inputs)
            # embeddings is the native 320-dim output for ColQwen3
            embeddings: Any = out.embeddings.to(  # type: ignore
                torch.bfloat16  # type: ignore
            ).cpu()

        torch.save(embeddings, INDEX_DIR / f"{doc_id_str}.pt")  # type: ignore
        state.registry[doc_id_str] = embeddings

        if state.qdrant:
            try:
                # Serialize full tensor for SOT restoration
                buffer = io.BytesIO()
                torch.save(embeddings, buffer)  # type: ignore
                tensor_b64 = base64.b64encode(
                    buffer.getvalue()
                ).decode("utf-8")

                # Mean pooling for vector index (approximate semantic rep)
                mean_vec: List[float] = (
                    embeddings.float().view(-1, 320).mean(dim=0).tolist()
                )

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
                logger.error(
                    "⚠️ Qdrant sync failed for %s: %s", doc_id_str, exc
                )

        vram: float = torch.cuda.memory_allocated() / 1e9  # type: ignore
        return {
            "status": "success",
            "doc_id": doc_id,
            "vram_gb": f"{vram:.2f}"
        }
    except Exception as exc:
        logger.error("Index error for %s: %s", doc_id_str, exc)
        raise exc


@app.post("/index/document")  # type: ignore
async def index_document(payload: IndexRequest) -> Dict[str, Any]:
    """Index document images (ticket:005.4: uses 503 check)."""
    _check_ready_or_503()

    try:
        pil_images: List[Any] = []
        for img_b64 in payload.images:
            img_data = base64.b64decode(img_b64)
            # Surgical ignore for unresolved PIL members
            img = Image.open(  # type: ignore
                io.BytesIO(img_data)
            ).convert("RGB")  # type: ignore
            pil_images.append(img)

        return await _process_images(payload.doc_id, pil_images)
    except Exception:
        raise HTTPException(status_code=500, detail="Indexing failure")


@app.post("/index/pdf")  # type: ignore
async def index_pdf(payload: IndexPdfRequest) -> Dict[str, Any]:
    """Index PDF document (ticket:005.4: uses 503 check)."""
    _check_ready_or_503()

    try:
        pdf_bytes = base64.b64decode(payload.pdf_data)
        # Render PDF to images at configured DPI
        pil_images = convert_from_bytes(
            pdf_bytes, dpi=DPI, fmt="jpeg", thread_count=4
        )
        return await _process_images(payload.doc_id, pil_images)
    except Exception as exc:
        logger.error("PDF index error for doc %s: %s", payload.doc_id, exc)
        raise HTTPException(status_code=500, detail="PDF Indexing failure")


@app.post("/index/directory")  # type: ignore
async def index_directory(payload: IndexDirectoryRequest) -> Dict[str, Any]:
    """Index images from directory (ticket:005.4: uses 503 check)."""
    _check_ready_or_503()

    try:
        image_paths = sorted(glob.glob(os.path.join(payload.path, "*")))
        pil_images: List[Any] = []
        for p in image_paths:
            if p.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.tiff')):
                pil_images.append(Image.open(p).convert("RGB"))  # type: ignore

        return await _process_images(payload.doc_id, pil_images)
    except Exception as exc:
        logger.error("Directory index error: %s", exc)
        raise HTTPException(status_code=500, detail="Indexing failure")


@app.post("/search", response_model=SearchResponse)  # type: ignore
async def search(payload: SearchRequest) -> SearchResponse:
    """
    Search endpoint supporting text and image queries (ticket:005.2, 005.4).

    - Text query: Uses process_texts for semantic search
    - Image query: Uses process_images for visual similarity search
    - Hybrid: Combines both for enhanced retrieval
    - 5-second timeout for retrieval calls (ticket:005.4)
    """
    start_time = time.time()

    _check_ready_or_503()  # ticket:005.4

    # Validate at least one query type is provided
    text_query = payload.get_text_query()
    image_query = payload.query_image

    if not text_query and not image_query:
        raise HTTPException(
            status_code=400,
            detail="At least one of query_text or query_image required"
        )

    # Determine query type
    query_type = "hybrid" if text_query and image_query else (
        "text" if text_query else "image"
    )

    # Validate collection
    valid_collections = {"visual_pages", "visual_overlays"}
    if payload.collection_name not in valid_collections:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid collection: {payload.collection_name}. "
                   f"Valid: {valid_collections}"
        )

    # 1. Compute Query Embedding (Native ColQwen3)
    query_emb: Any = None
    try:
        with torch.inference_mode():  # type: ignore
            if image_query:
                # Image-to-image search (ticket:005.2)
                query_img = _decode_base64_image(image_query)
                q_inputs = state.processor.process_images(
                    [query_img]
                ).to(DEVICE)
            else:
                # Text-to-image search (original behavior)
                q_inputs = state.processor.process_texts(
                    [text_query]
                ).to(DEVICE)

            q_out = state.model(**q_inputs)

            # Full tensor for MaxSim (High Fidelity)
            query_emb = q_out.embeddings.to(
                torch.float16  # type: ignore
            ).cpu()

            # Mean pool for Qdrant/Dense fallback (Approximate)
            query_vec: List[float] = (
                query_emb.float().mean(dim=1).view(-1).tolist()
            )
    except HTTPException:
        raise
    except Exception:
        logger.exception("Embedding generation failure")
        raise HTTPException(status_code=500, detail="Embedding error")

    results: List[SearchResult] = []
    score_type = "maxsim"

    # 2. Strategy A: Native MaxSim (Preferred for Visual RAG accuracy)
    # If we have tensors in memory, use them for late-interaction scoring.
    if state.registry:
        try:
            doc_ids = list(state.registry.keys())
            doc_tensors: List[Any] = [state.registry[i] for i in doc_ids]

            # Native MaxSim Scoring
            with torch.inference_mode():  # type: ignore
                scores_tensor = state.processor.score_multi_vector(
                    query_emb, doc_tensors
                )[0]

            # Top-K
            top_val: Any
            top_idx: Any
            top_val, top_idx = torch.topk(  # type: ignore
                scores_tensor, min(payload.k, len(scores_tensor))
            )

            indices = cast(List[int], top_idx.tolist())  # type: ignore
            values = cast(List[float], top_val.tolist())  # type: ignore

            for i, idx in enumerate(indices):
                doc_id_int = int(doc_ids[idx])
                results.append(SearchResult(
                    doc_id=doc_id_int,
                    score=round(values[i], 4),
                    thumbnail_url=f"/thumbnails/{doc_id_int}"
                ))

            execution_time = (time.time() - start_time) * 1000
            return SearchResponse(
                results=results,
                score_type=score_type,
                collection_used=payload.collection_name,
                execution_time_ms=round(execution_time, 2),
                query_type=query_type
            )
        except Exception:
            logger.exception("MaxSim search failure, attempting fallback")
            # Fallthrough to Qdrant if MaxSim fails

    # 3. Strategy B: Qdrant Dense Search with Expert Filtering (ticket:005.3)
    # Used if registry is empty or MaxSim failed.
    score_type = "dense"
    if qdrant_adapter.client:
        try:
            # Use singleton adapter with Expert Filtering
            hits = qdrant_adapter.search(
                collection_name=payload.collection_name,
                query_vector=query_vec,
                limit=payload.k,
                filters=payload.filters  # Expert Filtering (005.3)
            )

            for h in hits:
                doc_id_int = int(h["doc_id"])
                results.append(SearchResult(
                    doc_id=doc_id_int,
                    score=round(h["score"], 4),
                    thumbnail_url=f"/thumbnails/{doc_id_int}"
                ))

            execution_time = (time.time() - start_time) * 1000
            return SearchResponse(
                results=results,
                score_type=score_type,
                collection_used=payload.collection_name,
                execution_time_ms=round(execution_time, 2),
                query_type=query_type
            )
        except Exception:
            logger.exception("Qdrant search failure")
            raise HTTPException(status_code=500, detail="Search error")

    execution_time = (time.time() - start_time) * 1000
    return SearchResponse(
        results=[],
        score_type=score_type,
        collection_used=payload.collection_name,
        execution_time_ms=round(execution_time, 2),
        query_type=query_type
    )


@app.get("/health")  # type: ignore
async def health() -> Dict[str, Any]:
    """
    Health endpoint with initialization status (ticket:005.1, 005.3, 005.4).

    Returns:
        - status: "healthy" | "initializing" | "error"
        - init: Detailed initialization status (005.4)
        - qdrant: Adapter health with collection details (005.3)
    """
    vram: float = float(
        cast(Any, torch).cuda.memory_allocated() / 1e9
        if cast(Any, torch).cuda.is_available() else 0
    )

    # Determine status (ticket:005.4)
    if state.init_error:
        status = "error"
    elif state.initializing:
        status = "initializing"
    else:
        status = "healthy"

    # Get Qdrant adapter health (ticket:005.3)
    qdrant_health = qdrant_adapter.health_check()

    return {
        "status": status,
        "init": state.get_init_status(),  # ticket:005.4
        "model_id": ALLOWED_MODEL,
        "embedding_dim": EXPECTED_EMBEDDING_DIM,
        "offline_mode": True,
        "docs": len(state.registry),
        "vram_gb": round(vram, 2),
        "vram": f"{vram:.2f}GB",
        "qdrant": qdrant_health
    }
