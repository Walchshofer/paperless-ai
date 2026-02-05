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
import binascii
import glob
import io
import logging
import os
import threading
import time
from datetime import datetime, timezone
from collections.abc import AsyncIterator
from concurrent.futures import ThreadPoolExecutor
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
    Distance,  # type: ignore
    FieldCondition,  # type: ignore
    Filter,  # type: ignore
    MatchValue,  # type: ignore
    PayloadSchemaType,  # type: ignore
    PointStruct,  # type: ignore
    VectorParams,  # type: ignore
)
from transformers import AutoModel, AutoProcessor  # type: ignore
from prometheus_fastapi_instrumentator import Instrumentator  # type: ignore


# --- Configuration ---
# Only ColQwen3-4B models are allowed (ticket:005.1)
ALLOWED_MODELS = {
    "TomoroAI/tomoro-colqwen3-embed-4b",     # Primary model (320-dim)
    "TomoroAI/tomoro-colqwen3-4b-awq",       # Legacy AWQ (deprecated)
}
DEFAULT_MODEL = "TomoroAI/tomoro-colqwen3-embed-4b"
MODEL_ID = os.getenv("VISUAL_RAG_MODEL", DEFAULT_MODEL)
MODEL_REVISION = os.getenv("MODEL_REVISION", "main")
EXPECTED_EMBEDDING_DIM = 320  # ColQwen3 native dimension

# Enforce model ID matches allowed models
if MODEL_ID not in ALLOWED_MODELS:
    raise RuntimeError(
        (
            f"Model enforcement failed: '{MODEL_ID}' is not allowed. "
            f"Allowed models: {ALLOWED_MODELS}"
        )
    )

# Attention implementation: sdpa (default), flash_attention_2, eager
ATTN_IMPLEMENTATION = os.getenv("ATTN_IMPLEMENTATION", "sdpa")

# Offline mode configuration
OFFLINE_MODE = os.getenv("HF_HUB_OFFLINE", "0") == "1"

# Qdrant configuration
QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
REQUIRE_QDRANT = os.getenv("REQUIRE_QDRANT", "false").lower() == "true"

# Index and device configuration
INDEX_DIR = Path(os.getenv("INDEX_DIR", "/data/indices"))
DEVICE = os.getenv("DEVICE", "cuda")
DPI = int(os.getenv("VISION_RENDER_DPI", "300"))

# Resource limits
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "50"))
MAX_PDF_SIZE_MB = int(os.getenv("MAX_PDF_SIZE_MB", "100"))
MAX_PRELOAD_INDICES = int(os.getenv("MAX_PRELOAD_INDICES", "1000"))

# Allowed paths for directory indexing (security)
ALLOWED_INDEX_PATHS_ENV = os.getenv(
    "ALLOWED_INDEX_PATHS",
    "/data/documents,/data/imports"
)
ALLOWED_INDEX_PATHS = [
    Path(p.strip()).resolve()
    for p in ALLOWED_INDEX_PATHS_ENV.split(",")
    if p.strip()
]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("visual_rag_native")

# Thread pool for blocking I/O operations
io_executor = ThreadPoolExecutor(max_workers=4)


# --- Visual Qdrant Adapter (Thread-Safe Singleton) - ticket:005.3 ---
class VisualQdrantAdapter:
    """
    Thread-safe singleton Qdrant adapter for visual RAG collections.
    """

    _instance: Optional["VisualQdrantAdapter"] = None
    _lock = threading.Lock()

    def __new__(cls) -> "VisualQdrantAdapter":
        """Thread-safe singleton pattern with double-check locking."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False  # type: ignore
        return cls._instance

    def __init__(self) -> None:
        """Initialize Qdrant client (only once)."""
        if getattr(self, "_initialized", False):
            return
        self._initialized = True

        self.host = QDRANT_HOST
        self.port = QDRANT_PORT
        self.client: Any = None
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
                    c.name == coll_name
                    for c in resp.collections
                )

                if exists:
                    # Validate Distance Metric Lock
                    info = self.client.get_collection(coll_name)
                    cfg: Any = info.config.params.vectors
                    if isinstance(cfg, dict):
                        page_cfg: Any = cfg.get(  # type: ignore
                            "page_embedding"
                        )
                        if page_cfg:
                            dist: Any = (  # type: ignore
                                page_cfg.distance
                            )
                            if dist != Distance.DOT:  # type: ignore
                                logger.warning(
                                    "Distance mismatch in %s: %s",
                                    coll_name, dist  # type: ignore
                                )
                    logger.info("Collection '%s' verified", coll_name)
                else:
                    logger.info("Creating collection '%s'", coll_name)
                    self.client.create_collection(
                        collection_name=coll_name,
                        vectors_config={
                            "page_embedding": VectorParams(
                                size=EXPECTED_EMBEDDING_DIM,
                                distance=Distance.DOT  # type: ignore
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

        fields: List[Any] = [
            ("doc_id", PayloadSchemaType.INTEGER),  # type: ignore
            ("correspondent_id", PayloadSchemaType.INTEGER),  # type: ignore
            ("tag_ids", PayloadSchemaType.INTEGER),  # type: ignore
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
    ) -> Optional[Any]:
        """Build Qdrant Filter from SearchFilters."""
        if not filters:
            return None

        conditions: List[Any] = []

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

        return Filter(must=conditions)  # type: ignore

    def search(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 5,
        filters: Optional["SearchFilters"] = None
    ) -> List[Dict[str, Any]]:
        """Search with Expert Filtering."""
        if not self.client:
            raise RuntimeError("Qdrant not connected")

        if collection_name not in self.collections:
            raise ValueError(f"Invalid collection: {collection_name}")

        query_filter = self.build_filter(filters)

        # Use query_points (qdrant-client 1.16+)
        response = self.client.query_points(
            collection_name=collection_name,
            query=query_vector,
            using="page_embedding",
            query_filter=query_filter,
            limit=limit,
            with_payload=True
        )

        return [
            {
                "doc_id": (
                    h.payload.get("doc_id")
                    if h.payload else h.id
                ),
                "score": h.score,
                "payload": h.payload
            }
            for h in response.points
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
                    points = int(
                        getattr(info, "points_count", 0) or 0
                    )
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


# Singleton instance
qdrant_adapter = VisualQdrantAdapter()


# --- Pydantic Models for Validation ---
class IndexRequest(BaseModel):
    """Request to index document images."""
    doc_id: int
    images: List[str]
    metadata: Optional[Dict[str, Any]] = None


class IndexPdfRequest(BaseModel):
    """Request to index a PDF document."""
    doc_id: int
    pdf_data: str  # Base64 encoded PDF


class IndexDirectoryRequest(BaseModel):
    """Request to index images from a directory."""
    doc_id: int
    path: str


class SearchFilters(BaseModel):
    """Expert Filtering options for search."""
    doc_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    correspondent_id: Optional[int] = None


class SearchRequest(BaseModel):
    """Search request for text and image queries."""
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
    """Individual search result."""
    doc_id: int
    score: float
    page_num: Optional[int] = None
    thumbnail_url: Optional[str] = None


class SearchResponse(BaseModel):
    """Search response with MaxSim scoring."""
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
    """Initialization state for 503 response."""
    model: Any = None
    processor: Any = None
    qdrant: Any = None
    registry: Dict[str, Any] = {}

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


def _check_ready_or_503() -> None:
    """Raise 503 if initializing."""
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


def _validate_base64_size(
    data_b64: str,
    max_size_mb: int,
    data_type: str = "data"
) -> None:
    """Validate base64 encoded data size before decoding."""
    # Base64 is approximately 4/3 of original size
    estimated_size = len(data_b64) * 3 // 4
    max_bytes = max_size_mb * 1024 * 1024

    if estimated_size > max_bytes:
        size_mb = estimated_size // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=(
                f"{data_type} too large: ~{size_mb}MB "
                f"exceeds limit of {max_size_mb}MB"
            )
        )


def _decode_base64_image(
    image_b64: str,
    max_size_mb: int = MAX_IMAGE_SIZE_MB
) -> Any:
    """Decode and validate a Base64 encoded image with size limit."""
    _validate_base64_size(image_b64, max_size_mb, "Image")

    try:
        img_data = base64.b64decode(image_b64)

        # Double-check decoded size
        if len(img_data) > max_size_mb * 1024 * 1024:
            size_mb = len(img_data) // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"Decoded image too large: {size_mb}MB"
            )

        img: Any = Image.open(io.BytesIO(img_data))  # type: ignore

        # Validate format is supported
        supported_formats = ("JPEG", "PNG", "BMP", "TIFF", "WEBP", None)
        img_format: Any = img.format  # type: ignore
        if img_format not in supported_formats:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format: {img_format}"
            )

        return cast(Any, img.convert("RGB"))  # type: ignore
    except binascii.Error as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid Base64 encoding: {e}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to decode image: {e}"
        )


def _validate_directory_path(path: str) -> Path:
    """Validate that path is within allowed directories."""
    try:
        req_path = Path(path).resolve()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid path: {e}"
        )

    if not ALLOWED_INDEX_PATHS:
        raise HTTPException(
            status_code=403,
            detail="No allowed index paths configured"
        )

    for allowed in ALLOWED_INDEX_PATHS:
        try:
            req_path.relative_to(allowed)
            return req_path
        except ValueError:
            continue

    raise HTTPException(
        status_code=403,
        detail=f"Path not allowed. Must be under: {ALLOWED_INDEX_PATHS}"
    )


def _validate_model_dimensions(model: Any, processor: Any) -> None:
    """Validate ColQwen3 model outputs expected dimensional embeddings."""
    logger.info("Validating model dimensions...")

    config: Any = getattr(model, "config", None)
    if config is not None:
        proj_dim = getattr(config, "projection_dim", None)
        hidden_size = getattr(config, "hidden_size", None)

        if proj_dim is not None and proj_dim != EXPECTED_EMBEDDING_DIM:
            raise RuntimeError(
                f"Architecture mismatch: model projection_dim={proj_dim}, "
                f"expected {EXPECTED_EMBEDDING_DIM}. "
                "Only ColQwen3-4B-AWQ (320-dim) is supported."
            )

        logger.info(
            "Model config: projection_dim=%s, hidden_size=%s",
            proj_dim, hidden_size
        )

    try:
        test_img: Any = Image.new(  # type: ignore
            "RGB", (224, 224), color="gray"
        )

        with torch.inference_mode():  # type: ignore
            inputs: Any = processor.process_images([test_img]).to(DEVICE)
            out: Any = model(**inputs)
            embeddings: Any = out.embeddings

            actual_dim = embeddings.shape[-1]

            if actual_dim != EXPECTED_EMBEDDING_DIM:
                raise RuntimeError(
                    f"Dimension validation failed: model outputs "
                    f"{actual_dim}-dim embeddings, expected "
                    f"{EXPECTED_EMBEDDING_DIM}. "
                    "Ensure ColQwen3-4B-AWQ is loaded."
                )

            logger.info(
                "✅ Dimension validation passed: %d-dim embeddings",
                actual_dim
            )
    except RuntimeError:
        raise
    except Exception as exc:
        logger.warning("Could not perform runtime dimension check: %s", exc)


# --- Lifespan Manager ---
@asynccontextmanager
async def lifespan(_app: Any) -> AsyncIterator[None]:
    """Initializes the 320-dim ColQwen3 bridge on startup."""
    logger.info("🚀 Initializing ColQwen3 (4B) on %s...", DEVICE)
    logger.info("Model: %s (revision: %s)", MODEL_ID, MODEL_REVISION)
    logger.info("Attention implementation: %s", ATTN_IMPLEMENTATION)
    logger.info("Offline mode: %s", OFFLINE_MODE)

    try:
        # Stage 1: Load processor
        state.init_stage = "loading_processor"
        logger.info("Stage: %s", state.init_stage)

        state.processor = AutoProcessor.from_pretrained(  # type: ignore
            MODEL_ID,
            revision=MODEL_REVISION,
            trust_remote_code=True,
            local_files_only=OFFLINE_MODE,
            max_num_visual_tokens=1280
        )

        # Stage 2: Load model into VRAM
        state.init_stage = "loading_model"
        logger.info("Stage: %s", state.init_stage)

        state.model = AutoModel.from_pretrained(  # type: ignore
            MODEL_ID,
            revision=MODEL_REVISION,
            trust_remote_code=True,
            local_files_only=OFFLINE_MODE,
            torch_dtype=torch.float16,  # type: ignore
            device_map=DEVICE,
            attn_implementation=ATTN_IMPLEMENTATION
        ).eval()  # type: ignore

        # Stage 3: Validate dimensions
        state.init_stage = "validating"
        logger.info("Stage: %s", state.init_stage)
        _validate_model_dimensions(
            state.model,  # type: ignore
            state.processor  # type: ignore
        )

        # Stage 4: Connect Qdrant adapter
        state.init_stage = "connecting_qdrant"
        logger.info("Stage: %s", state.init_stage)
        try:
            if qdrant_adapter.connect():
                qdrant_adapter.ensure_collections()
                state.qdrant = qdrant_adapter.client
                logger.info("✅ Qdrant adapter initialized")
            elif REQUIRE_QDRANT:
                raise RuntimeError(
                    "Qdrant connection required but failed"
                )
            else:
                logger.warning(
                    "⚠️ Qdrant unavailable; using local registry only"
                )
        except RuntimeError:
            raise
        except Exception as exc:
            if REQUIRE_QDRANT:
                raise RuntimeError(
                    f"Qdrant initialization failed: {exc}"
                )
            logger.warning("⚠️ Qdrant initialization failed: %s", exc)

        # Stage 5: Load indices from disk
        state.init_stage = "loading_indices"
        logger.info("Stage: %s", state.init_stage)
        INDEX_DIR.mkdir(parents=True, exist_ok=True)

        indices = sorted(
            INDEX_DIR.glob("*.pt"),
            key=lambda p: p.stat().st_mtime,
            reverse=True
        )

        loaded_count = 0
        for p in indices[:MAX_PRELOAD_INDICES]:
            try:
                loaded: Any = torch.load(  # type: ignore
                    p, map_location="cpu", weights_only=True
                )
                state.registry[p.stem] = loaded
                loaded_count += 1
            except Exception as exc:
                logger.warning("Failed to load index %s: %s", p, exc)

        if len(indices) > MAX_PRELOAD_INDICES:
            logger.warning(
                "Only preloaded %d of %d indices",
                loaded_count, len(indices)
            )

        # Ready: Model in VRAM, transition to 200 OK
        state.init_stage = "ready"
        state.initializing = False
        vram_alloc = float(torch.cuda.memory_allocated())  # type: ignore
        logger.info(
            "✅ Ready. Registry size: %d, VRAM: %.2fGB",
            len(state.registry),
            vram_alloc / 1e9
        )

    except Exception as exc:
        state.init_error = str(exc)
        state.init_stage = "error"
        logger.error("❌ Initialization failed: %s", exc)
        raise

    yield

    # Graceful shutdown: release VRAM
    logger.info("🛑 Shutting down, releasing VRAM...")
    state.registry.clear()
    state.model = None
    state.processor = None
    if torch.cuda.is_available():  # type: ignore
        torch.cuda.empty_cache()  # type: ignore
    io_executor.shutdown(wait=True)
    logger.info("✅ Shutdown complete")


app: FastAPI = FastAPI(  # type: ignore
    title="Native ColQwen3 Visual RAG",
    lifespan=lifespan
)
Instrumentator().instrument(app).expose(app)  # type: ignore


# --- Endpoints ---

def _to_optional_int(value: Any) -> Optional[int]:
    """Convert a value to int when possible."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip():
        try:
            return int(value)
        except ValueError:
            return None
    return None


def _extract_tag_ids(metadata: Dict[str, Any]) -> List[int]:
    """Extract integer tag IDs from metadata."""
    raw_tag_ids = metadata.get("tag_ids", metadata.get("tags"))
    if not isinstance(raw_tag_ids, list):
        return []

    tag_ids: List[int] = []
    for item in raw_tag_ids:
        tag_id = _to_optional_int(item)
        if tag_id is not None:
            tag_ids.append(tag_id)
    return tag_ids


def _build_page_payload(
    doc_id: int,
    page_number: int,
    page_count: int,
    metadata: Optional[Dict[str, Any]]
) -> Dict[str, Any]:
    """Build payload for a single page embedding point."""
    metadata = metadata or {}
    domain_raw = metadata.get("domain")
    domain = "general"
    if isinstance(domain_raw, str) and domain_raw.strip():
        domain = domain_raw.strip().lower()

    indexed_at_raw = metadata.get("indexed_at")
    if isinstance(indexed_at_raw, str) and indexed_at_raw.strip():
        indexed_at = indexed_at_raw
    else:
        indexed_at = datetime.now(timezone.utc).isoformat()

    payload: Dict[str, Any] = {
        "doc_id": doc_id,
        "document_id": doc_id,
        "page_number": page_number,
        "page_count": page_count,
        "domain": domain,
        "indexed_at": indexed_at,
    }

    correspondent_id = _to_optional_int(
        metadata.get("correspondent_id", metadata.get("correspondent"))
    )
    if correspondent_id is not None:
        payload["correspondent_id"] = correspondent_id

    tag_ids = _extract_tag_ids(metadata)
    if tag_ids:
        payload["tag_ids"] = tag_ids

    return payload

async def _process_images(
    doc_id: int,
    pil_images: List[Any],
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Shared logic for processing document images."""
    doc_id_str = str(doc_id)
    started_at = time.time()
    try:
        with torch.inference_mode():  # type: ignore
            inputs = state.processor.process_images(pil_images).to(DEVICE)
            out = state.model(**inputs)
            emb: Any = out.embeddings
            embeddings: Any = emb.to(torch.bfloat16).cpu()  # type: ignore

        # Update in-memory registry for MaxSim (ephemeral)
        # Note: Persistence is handled by Qdrant SOT below
        state.registry[doc_id_str] = embeddings

        indexed_points = 0
        if state.qdrant:
            try:
                page_vectors: Any = embeddings.float().mean(dim=1)
                points: List[Any] = []
                page_count = len(pil_images)
                for page_idx in range(page_count):
                    page_number = page_idx + 1
                    point_id = f"{doc_id}:{page_number}"
                    page_vector: List[float] = (
                        page_vectors[page_idx]
                        .view(EXPECTED_EMBEDDING_DIM)
                        .tolist()
                    )
                    points.append(
                        PointStruct(
                            id=point_id,
                            vector={"page_embedding": page_vector},
                            payload=_build_page_payload(
                                doc_id,
                                page_number,
                                page_count,
                                metadata,
                            ),
                        )
                    )

                state.qdrant.upsert(
                    collection_name="visual_pages",
                    points=points,
                )
                indexed_points = len(points)
                logger.info("✅ Synced doc %s to Qdrant SOT", doc_id_str)
            except Exception as exc:
                logger.error(
                    "⚠️ Qdrant sync failed for %s: %s", doc_id_str, exc
                )

        indexing_time_ms = (time.time() - started_at) * 1000
        page_count = len(pil_images)
        per_page_latency_ms = indexing_time_ms / max(page_count, 1)
        vram_used = torch.cuda.memory_allocated()  # type: ignore
        vram_gb: float = float(vram_used) / 1e9    # type: ignore
        return {
            "status": "success",
            "doc_id": doc_id,
            "page_count": page_count,
            "indexed_points": indexed_points,
            "indexing_time_ms": round(indexing_time_ms, 2),
            "per_page_latency_ms": round(per_page_latency_ms, 2),
            "vram_gb": f"{vram_gb:.2f}"
        }
    except Exception as exc:
        logger.exception("Index error for %s", doc_id_str)
        raise exc


@app.post("/index/document")  # type: ignore
async def index_document(payload: IndexRequest) -> Dict[str, Any]:
    """Index document images."""
    _check_ready_or_503()

    try:
        pil_images: List[Any] = []
        for img_b64 in payload.images:
            img = _decode_base64_image(img_b64)
            pil_images.append(img)

        return await _process_images(
            payload.doc_id,
            pil_images,
            payload.metadata
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Indexing failed for doc %s", payload.doc_id)
        raise HTTPException(
            status_code=500,
            detail=f"Indexing failure: {type(exc).__name__}"
        )


@app.post("/index/pdf")  # type: ignore
async def index_pdf(payload: IndexPdfRequest) -> Dict[str, Any]:
    """Index PDF document."""
    _check_ready_or_503()

    try:
        _validate_base64_size(payload.pdf_data, MAX_PDF_SIZE_MB, "PDF")

        pdf_bytes = base64.b64decode(payload.pdf_data)

        if len(pdf_bytes) > MAX_PDF_SIZE_MB * 1024 * 1024:
            size_mb = len(pdf_bytes) // (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=f"PDF too large: {size_mb}MB"
            )

        # Run PDF conversion in executor to avoid blocking
        loop = asyncio.get_event_loop()
        pil_images: List[Any] = await loop.run_in_executor(
            io_executor,
            lambda: list(convert_from_bytes(  # type: ignore
                pdf_bytes, dpi=DPI, fmt="jpeg", thread_count=4
            ))
        )

        return await _process_images(payload.doc_id, pil_images)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("PDF index error for doc %s", payload.doc_id)
        raise HTTPException(
            status_code=500,
            detail=f"PDF indexing failure: {type(exc).__name__}"
        )


@app.post("/index/directory")  # type: ignore
async def index_directory(payload: IndexDirectoryRequest) -> Dict[str, Any]:
    """Index images from directory."""
    _check_ready_or_503()

    try:
        # Validate path is within allowed directories
        validated_path = _validate_directory_path(payload.path)

        image_paths = sorted(glob.glob(str(validated_path / "*")))
        pil_images: List[Any] = []

        valid_exts = ('.png', '.jpg', '.jpeg', '.bmp', '.tiff', '.webp')
        for p in image_paths:
            if p.lower().endswith(valid_exts):
                try:
                    pil_images.append(
                        Image.open(p).convert("RGB")  # type: ignore
                    )
                except Exception as exc:
                    logger.warning("Failed to load image %s: %s", p, exc)

        if not pil_images:
            raise HTTPException(
                status_code=400,
                detail=f"No valid images found in {validated_path}"
            )

        return await _process_images(payload.doc_id, pil_images)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Directory index error for %s", payload.path)
        raise HTTPException(
            status_code=500,
            detail=f"Directory indexing failure: {type(exc).__name__}"
        )


@app.post("/search", response_model=SearchResponse)  # type: ignore
async def search(payload: SearchRequest) -> SearchResponse:
    """Search endpoint for text and image queries."""
    start_time = time.time()

    _check_ready_or_503()

    text_query = payload.get_text_query()
    image_query = payload.query_image

    if not text_query and not image_query:
        raise HTTPException(
            status_code=400,
            detail="At least one of query_text or query_image required"
        )

    # Determine query type
    if text_query and image_query:
        query_type = "hybrid"
    elif text_query:
        query_type = "text"
    else:
        query_type = "image"

    # Validate collection
    valid_collections = {"visual_pages", "visual_overlays"}
    if payload.collection_name not in valid_collections:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Invalid collection: {payload.collection_name}. "
                f"Valid: {valid_collections}"
            )
        )

    # 1. Compute Query Embedding
    query_emb: Any = None
    query_vec: List[float] = []
    try:
        with torch.inference_mode():  # type: ignore
            if image_query:
                # Image-to-image search
                query_img = _decode_base64_image(image_query)
                q_inputs = state.processor.process_images(
                    [query_img]
                ).to(DEVICE)
            else:
                # Text-to-image search
                q_inputs = state.processor.process_texts(
                    [text_query]
                ).to(DEVICE)

            q_out = state.model(**q_inputs)

            # Full tensor for MaxSim (High Fidelity)
            q_emb: Any = q_out.embeddings
            query_emb = q_emb.to(torch.float16).cpu()  # type: ignore

            # Mean pool for Qdrant/Dense fallback
            query_vec = (
                query_emb.float().mean(dim=1).view(-1).tolist()
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Embedding generation failure")
        raise HTTPException(
            status_code=500,
            detail=f"Embedding error: {type(exc).__name__}"
        )

    results: List[SearchResult] = []
    score_type = "maxsim"

    # 2. Strategy A: Native MaxSim
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
            tk_count = min(payload.k, len(scores_tensor))
            top_val: Any
            top_idx: Any
            top_val, top_idx = torch.topk(  # type: ignore
                scores_tensor, tk_count
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

    # 3. Strategy B: Qdrant Dense Search with Expert Filtering
    score_type = "dense"
    if qdrant_adapter.client:
        try:
            hits = qdrant_adapter.search(
                collection_name=payload.collection_name,
                query_vector=query_vec,
                limit=payload.k,
                filters=payload.filters
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
        except Exception as exc:
            logger.exception("Qdrant search failure")
            raise HTTPException(
                status_code=500,
                detail=f"Search error: {type(exc).__name__}"
            )

    execution_time = (time.time() - start_time) * 1000
    return SearchResponse(
        results=[],
        score_type=score_type,
        collection_used=payload.collection_name,
        execution_time_ms=round(execution_time, 2),
        query_type=query_type
    )


@app.delete("/index/{doc_id}")  # type: ignore
async def delete_document(doc_id: int) -> Dict[str, Any]:
    """Delete a document from the index."""
    _check_ready_or_503()

    doc_id_str = str(doc_id)
    deleted_from: List[str] = []

    # Remove from local registry
    if doc_id_str in state.registry:
        del state.registry[doc_id_str]
        deleted_from.append("registry")

    # Remove from disk
    index_path = INDEX_DIR / f"{doc_id_str}.pt"
    if index_path.exists():
        try:
            index_path.unlink()
            deleted_from.append("disk")
        except Exception as exc:
            logger.error(
                "Failed to delete %s from disk: %s", doc_id_str, exc
            )

    # Remove from Qdrant
    if state.qdrant:
        try:
            state.qdrant.delete(
                collection_name="visual_pages",
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="doc_id",
                            match=MatchValue(value=doc_id)
                        )
                    ]
                )
            )
            deleted_from.append("qdrant")
        except Exception as exc:
            logger.error(
                "Failed to delete %s from Qdrant: %s", doc_id_str, exc
            )

    if not deleted_from:
        raise HTTPException(
            status_code=404,
            detail=f"Document {doc_id} not found"
        )

    return {
        "status": "success",
        "doc_id": doc_id,
        "deleted_from": deleted_from
    }


@app.get("/health")  # type: ignore
async def health() -> Dict[str, Any]:
    """Health endpoint with initialization status."""
    vram: float = 0.0
    if torch.cuda.is_available():  # type: ignore
        vram = float(torch.cuda.memory_allocated() / 1e9)  # type: ignore

    if state.init_error:
        status = "error"
    elif state.initializing:
        status = "initializing"
    else:
        status = "healthy"

    qdrant_health = qdrant_adapter.health_check()

    return {
        "status": status,
        "init": state.get_init_status(),
        "model_id": MODEL_ID,
        "model_revision": MODEL_REVISION,
        "embedding_dim": EXPECTED_EMBEDDING_DIM,
        "attn_implementation": ATTN_IMPLEMENTATION,
        "offline_mode": OFFLINE_MODE,
        "docs": len(state.registry),
        "vram_gb": round(vram, 2),
        "vram": f"{vram:.2f}GB",
        "qdrant": qdrant_health,
        "config": {
            "max_image_size_mb": MAX_IMAGE_SIZE_MB,
            "max_pdf_size_mb": MAX_PDF_SIZE_MB,
            "max_preload_indices": MAX_PRELOAD_INDICES,
            "allowed_index_paths": [str(p) for p in ALLOWED_INDEX_PATHS],
            "require_qdrant": REQUIRE_QDRANT
        }
    }


@app.get("/ready")  # type: ignore
async def ready() -> Dict[str, Any]:
    """Kubernetes readiness probe endpoint."""
    if state.initializing:
        raise HTTPException(
            status_code=503,
            detail=f"Initializing: {state.init_stage}"
        )

    if state.init_error:
        raise HTTPException(
            status_code=503,
            detail=f"Initialization error: {state.init_error}"
        )

    return {"ready": True}


@app.get("/live")  # type: ignore
async def live() -> Dict[str, Any]:
    """Kubernetes liveness probe endpoint."""
    return {"live": True}
