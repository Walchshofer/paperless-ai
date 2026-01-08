"""
Visual RAG Sidecar Service

A FastAPI service that provides visual document retrieval using ColQwen3/
ColPali via the Byaldi library. This service indexes PDF pages as images and
enables semantic search that understands document layout, tables, charts,
and formatting.

Architecture:
- Runs as a Docker sidecar alongside paperless-ngx
- Shares GPU with Ollama (RTX 3090 Ti 24GB)
- Stores indices in /data/indices (persisted volume)
- Reads PDFs from /media/paperless (read-only mount)
- Supports Text-to-Image AND Image-to-Image retrieval
"""

import os
import logging
import asyncio
import base64
import io
from pathlib import Path
from typing import Optional, List, Dict, Any, Union
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from PIL import Image

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("visual_rag")

# Respect HF_HUB_OFFLINE env var; allow downloads by default for initial first-loads
# Set HF_HUB_OFFLINE=1 if you explicitly want the sidecar to run completely offline
hf_env = os.getenv("HF_HUB_OFFLINE")
if hf_env and hf_env.strip().lower() in ("1", "true", "yes"):
    os.environ["HF_HUB_OFFLINE"] = "1"
else:
    # Ensure we don't force offline mode so first-run downloads can proceed
    os.environ.pop("HF_HUB_OFFLINE", None)
# Helpful logging to indicate behavior
logger.info(f"HF_HUB_OFFLINE set to: {os.getenv('HF_HUB_OFFLINE', 'False')}")

# =============================================================================
# Configuration
# =============================================================================


class Config:
    """Service configuration from environment variables."""

    # Model settings
    # BREAKING CHANGE: Only TomoroAI/tomoro-colqwen3-embed-8b is supported
    # Old model vidore/colqwen2-v1.0 is no longer supported
    # Users must re-index documents with the new model
    MODEL_NAME = "TomoroAI/tomoro-colqwen3-embed-8b"

    # Log warning if user tries to override with old model
    requested_model = os.getenv("VISUAL_RAG_MODEL", MODEL_NAME)
    if requested_model != MODEL_NAME:
         logger.error(
             f"Unsupported model requested: {requested_model}. "
             f"Strictly enforcing {MODEL_NAME}."
         )
         raise ValueError(
             f"Unsupported model: {requested_model}. "
             f"Only {MODEL_NAME} is supported for this version of visual-rag-sidecar."
         )

    # Paths
    INDEX_DIR = Path(os.getenv("INDEX_DIR", "/data/indices"))
    MEDIA_DIR = Path(os.getenv("MEDIA_DIR", "/media/paperless"))

    # Index settings
    DEFAULT_INDEX_NAME = os.getenv("DEFAULT_INDEX_NAME", "paperless_visual")
    STORE_COLLECTION = os.getenv("STORE_COLLECTION", "false").lower() == "true"

    # Server settings
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8001"))

    # GPU memory settings (for sharing with Ollama)
    MAX_SPLIT_SIZE_MB = int(os.getenv("MAX_SPLIT_SIZE_MB", "512"))


config = Config()

# =============================================================================
# Global State
# =============================================================================


class ServiceState:
    """Global service state."""

    def __init__(self):
        self.model = None
        self.model_loaded = False
        self.loading = False
        self.index_loaded = False
        self.indexing_in_progress = False
        self.indexed_documents: Dict[str, Any] = {}
        self.last_error: Optional[str] = None


state = ServiceState()

# =============================================================================
# Pydantic Models
# =============================================================================


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    index_loaded: bool
    model_name: str
    indexed_docs_count: int


class IndexRequest(BaseModel):
    pdf_path: Optional[str] = Field(
        None,
        description=(
            "Path to PDF file (relative to /media/paperless)"
        ),
    )
    images: Optional[List[str]] = Field(
        None,
        description=(
            "Array of base64-encoded page images (PNG/JPEG)"
        ),
    )
    doc_id: Optional[int] = Field(
        None,
        description=(
            "Document ID from Paperless-ngx"
        ),
    )
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class IndexDirectoryRequest(BaseModel):
    directory: str = Field(
        "documents/originals",
        description=(
            "Directory to index (relative to /media/paperless)"
        ),
    )
    recursive: bool = Field(
        True,
        description=(
            "Index subdirectories"
        ),
    )


class SearchRequest(BaseModel):
    query: Optional[str] = Field(
        None,
        description=(
            "Search query text. Required if query_image is not provided."
        ),
    )
    query_image: Optional[str] = Field(
        None,
        description=(
            "Base64 encoded image for visual similarity search. "
            "If provided, takes precedence over query text."
        ),
    )
    k: int = Field(
        5,
        ge=1,
        le=50,
        description=(
            "Number of results to return"
        ),
    )
    include_base64: bool = Field(
        False,
        description=(
            "Include base64 image in results"
        ),
    )


class SearchResult(BaseModel):
    doc_id: Optional[int]
    page_num: int
    score: float
    metadata: Dict[str, Any]
    file_path: str
    base64: Optional[str] = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total_results: int


class IndexStatusResponse(BaseModel):
    indexing_in_progress: bool
    indexed_documents: int
    index_name: str
    index_path: str


# =============================================================================
# Model Loading
# =============================================================================

def load_model():
    """Load the ColQwen2/ColPali model using Byaldi."""
    global state

    if state.loading:
        logger.warning("Model loading already in progress")
        return

    state.loading = True
    state.last_error = None

    try:
        logger.info(f"Loading visual retrieval model: {config.MODEL_NAME}")
        logger.info("This may take 30-60 seconds on first load...")

        # Import here to avoid startup delay if model not needed
        from byaldi import RAGMultiModalModel

        # Check if existing index exists
        index_path = config.INDEX_DIR / config.DEFAULT_INDEX_NAME

        def is_valid_index(p: Path) -> bool:
            byaldi_meta = p / ".byaldi" / "index_config.json.gz"
            return p.exists() and byaldi_meta.exists()

        if is_valid_index(index_path):
            logger.info(f"Loading existing index from: {index_path}")
            try:
                state.model = RAGMultiModalModel.from_index(
                    str(index_path),
                    verbose=1
                )
                state.index_loaded = True
                logger.info("Existing index loaded successfully")
            except FileNotFoundError as e:
                logger.warning(
                    f"Index at {index_path} looks incomplete (missing files). "
                    "Falling back to model-only load and will allow re-indexing."
                )
                logger.debug("Index load exception: %s", e)
                state.model = RAGMultiModalModel.from_pretrained(
                    config.MODEL_NAME,
                    verbose=1
                )
        else:
            if index_path.exists():
                logger.warning(
                    f"Index path {index_path} exists but is not a valid Byaldi index. "
                    "To migrate old indices, run the migration script. Proceeding to load model only."
                )
            else:
                logger.info(
                    "No existing index found, loading model for new "
                    "indexing"
                )
            state.model = RAGMultiModalModel.from_pretrained(
                config.MODEL_NAME,
                verbose=1
            )

        state.model_loaded = True
        logger.info("Visual retrieval model loaded successfully")

        # Create marker so subsequent restarts run in offline mode only
        try:
            marker_file = config.INDEX_DIR / ".hf_hub_download_complete"
            marker_file.write_text(f"hf_downloaded_at={__import__('datetime').datetime.utcnow().isoformat()}\nmodel={config.MODEL_NAME}\n")
            os.environ["HF_HUB_OFFLINE"] = "1"
            logger.info(f"Model cache marker created: {marker_file}; HF_HUB_OFFLINE enforced for future runs")
        except Exception as e:
            logger.warning(f"Failed to write HF cache marker: {e}")

    except ImportError as e:
        state.last_error = f"Failed to import Byaldi: {e}"
        logger.error(state.last_error)
        raise
    except Exception as e:
        state.last_error = f"Failed to load model: {e}"
        logger.error(state.last_error)
        raise
    finally:
        state.loading = False


def ensure_model_loaded():
    """Ensure model is loaded before operations."""
    if not state.model_loaded:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Service is starting up."
        )


# =============================================================================
# FastAPI App
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # Startup
    logger.info("Starting Visual RAG Sidecar Service")
    logger.info(f"Model: {config.MODEL_NAME}")
    logger.info(f"Index directory: {config.INDEX_DIR}")
    logger.info(f"Media directory: {config.MEDIA_DIR}")
    logger.warning("=" * 80)
    logger.warning("BREAKING CHANGE: Visual RAG Sidecar v2.0")
    logger.warning("Old model vidore/colqwen2-v1.0 is no longer supported")
    logger.warning("Only TomoroAI/tomoro-colqwen3-embed-8b is supported")
    logger.warning("Existing indices must be re-indexed")
    logger.warning("See: docs/RAG_SYSTEMS_REFERENCE.md#migration-guide")
    logger.warning("=" * 80)

    # Ensure directories exist
    config.INDEX_DIR.mkdir(parents=True, exist_ok=True)

    # Marker file that indicates initial HF model download completed and we should run offline thereafter
    marker_file = config.INDEX_DIR / ".hf_hub_download_complete"

    # If marker exists or env explicitly requests offline, enforce HF offline mode.
    hf_env = os.getenv("HF_HUB_OFFLINE")
    if hf_env and hf_env.strip().lower() in ("1", "true", "yes"):
        os.environ["HF_HUB_OFFLINE"] = "1"
        logger.info("HF_HUB_OFFLINE explicitly set via environment; running in offline-only mode")
    elif marker_file.exists():
        os.environ["HF_HUB_OFFLINE"] = "1"
        logger.info(f"HF hub downloads disabled via marker file: {marker_file}")
    else:
        # Allow downloads for initial model pull
        os.environ.pop("HF_HUB_OFFLINE", None)
        logger.info("HF hub downloads allowed for first-run model pull (remove access if you want fully offline runs)")

    # Load model in background to not block startup
    asyncio.create_task(asyncio.to_thread(load_model))

    yield

    # Shutdown
    logger.info("Shutting down Visual RAG Sidecar Service")
    state.model = None
    state.model_loaded = False


app = FastAPI(
    title="Visual RAG Sidecar",
    description="Visual document retrieval service using ColQwen3/ColPali (v2.0+)",
    version="1.0.0",
    lifespan=lifespan
)


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy" if state.model_loaded else "loading",
        model_loaded=state.model_loaded,
        index_loaded=state.index_loaded,
        model_name=config.MODEL_NAME,
        indexed_docs_count=len(state.indexed_documents)
    )


@app.get("/status", response_model=IndexStatusResponse)
async def get_status():
    """Get indexing status."""
    return IndexStatusResponse(
        indexing_in_progress=state.indexing_in_progress,
        indexed_documents=len(state.indexed_documents),
        index_name=config.DEFAULT_INDEX_NAME,
        index_path=str(config.INDEX_DIR / config.DEFAULT_INDEX_NAME)
    )


@app.post("/index/document")
async def index_document(
    request: IndexRequest,
    background_tasks: BackgroundTasks,
):
    """Index a single PDF document."""
    ensure_model_loaded()
    # If images provided, write them to a temp folder under /data
    # and index those images
    if (
        request.images
        and isinstance(request.images, list)
        and len(request.images) > 0
    ):
        # Prepare metadata
        metadata = request.metadata or {}
        if request.doc_id:
            metadata["paperless_doc_id"] = request.doc_id

        tmp_root = config.INDEX_DIR.parent / 'tmp_images'
        tmp_root.mkdir(parents=True, exist_ok=True)
        timestamp = int(asyncio.get_event_loop().time() * 1000)
        uid = f"doc_{request.doc_id or 'unknown'}_{timestamp}"
        tmp_dir = tmp_root / uid
        tmp_dir.mkdir(parents=True, exist_ok=True)

        # Save images
        for i, b64 in enumerate(request.images, start=1):
            try:
                import base64
                img_bytes = base64.b64decode(b64)
                img_path = tmp_dir / f"page_{i}.png"
                with open(img_path, 'wb') as f:
                    f.write(img_bytes)
            except Exception as e:
                logger.error(f"Failed to write image {i} for indexing: {e}")

        async def do_index_images():
            state.indexing_in_progress = True
            try:
                logger.info(
                    f"Indexing {len(request.images)} images for doc "
                    f"{request.doc_id} from {tmp_dir}"
                )
                # Add to existing index or create a new one
                # using the directory of images
                index_path = config.INDEX_DIR / config.DEFAULT_INDEX_NAME

                if index_path.exists() and state.index_loaded:
                    state.model.add_to_index(
                        input_path=str(tmp_dir),
                        store_collection_with_index=config.STORE_COLLECTION,
                        metadata=[metadata]
                    )
                else:
                    state.model.index(
                        input_path=str(tmp_dir),
                        index_name=config.DEFAULT_INDEX_NAME,
                        store_collection_with_index=config.STORE_COLLECTION,
                        metadata=[metadata],
                        overwrite=False
                    )
                    state.index_loaded = True

                # Track indexed document
                doc_key = f"images:{uid}"
                state.indexed_documents[doc_key] = {
                    "doc_id": request.doc_id,
                    "metadata": metadata,
                }

                logger.info(f"Successfully indexed images from: {tmp_dir}")
            except Exception as e:
                logger.error(f"Failed to index images from {tmp_dir}: {e}")
                state.last_error = str(e)
                raise
            finally:
                state.indexing_in_progress = False
                # cleanup files (best-effort)
                try:
                    import shutil
                    shutil.rmtree(tmp_dir)
                except Exception:
                    pass

        background_tasks.add_task(
            asyncio.to_thread,
            lambda: asyncio.run(do_index_images()),
        )

        return {
            "status": "indexing_started",
            "document": f"images:{uid}",
            "document_count": len(request.images),
        }

    # Fallback: pdf_path-based indexing (existing behavior)
    if not request.pdf_path:
        raise HTTPException(
            status_code=400,
            detail="Either 'pdf_path' or 'images' must be provided",
        )

    # Construct full path
    full_path = config.MEDIA_DIR / request.pdf_path

    if not full_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"PDF not found: {request.pdf_path}"
        )

    if not full_path.suffix.lower() == ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    async def do_index_pdf():
        state.indexing_in_progress = True
        try:
            logger.info(f"Indexing document: {full_path}")

            # Prepare metadata
            metadata = request.metadata or {}
            if request.doc_id:
                metadata["paperless_doc_id"] = request.doc_id
            metadata["source_path"] = str(request.pdf_path)

            # Check if index exists
            index_path = config.INDEX_DIR / config.DEFAULT_INDEX_NAME

            if index_path.exists() and state.index_loaded:
                # Add to existing index
                state.model.add_to_index(
                    input_path=str(full_path),
                    store_collection_with_index=config.STORE_COLLECTION,
                    metadata=[metadata]
                )
            else:
                # Create new index
                state.model.index(
                    input_path=str(full_path),
                    index_name=config.DEFAULT_INDEX_NAME,
                    store_collection_with_index=config.STORE_COLLECTION,
                    metadata=[metadata],
                    overwrite=False
                )
                state.index_loaded = True

            # Track indexed document
            doc_key = str(request.pdf_path)
            state.indexed_documents[doc_key] = {
                "doc_id": request.doc_id,
                "metadata": metadata
            }

            logger.info(f"Successfully indexed: {full_path}")

        except Exception as e:
            logger.error(f"Failed to index {full_path}: {e}")
            state.last_error = str(e)
            raise
        finally:
            state.indexing_in_progress = False

    # Run indexing in background
    background_tasks.add_task(
        asyncio.to_thread,
        lambda: asyncio.run(do_index_pdf()),
    )

    return {"status": "indexing_started", "document": request.pdf_path}


@app.post("/index/directory")
async def index_directory(
    request: IndexDirectoryRequest,
    background_tasks: BackgroundTasks,
):
    """Index all PDFs in a directory."""
    ensure_model_loaded()

    full_path = config.MEDIA_DIR / request.directory

    if not full_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Directory not found: {request.directory}"
        )

    # Find all PDFs
    pattern = "**/*.pdf" if request.recursive else "*.pdf"
    pdf_files = list(full_path.glob(pattern))

    if not pdf_files:
        raise HTTPException(
            status_code=404,
            detail=f"No PDF files found in: {request.directory}"
        )

    async def do_batch_index():
        state.indexing_in_progress = True
        try:
            logger.info(
                f"Batch indexing {len(pdf_files)} PDFs from: "
                f"{full_path}"
            )

            # Index the directory
            state.model.index(
                input_path=str(full_path),
                index_name=config.DEFAULT_INDEX_NAME,
                store_collection_with_index=config.STORE_COLLECTION,
                overwrite=True  # Rebuild index for directory
            )

            state.index_loaded = True

            # Track indexed files
            for pdf_file in pdf_files:
                rel_path = pdf_file.relative_to(config.MEDIA_DIR)
                state.indexed_documents[str(rel_path)] = {
                    "source_path": str(rel_path)
                }

            logger.info(f"Successfully indexed {len(pdf_files)} documents")

        except Exception as e:
            logger.error(f"Failed to batch index: {e}")
            state.last_error = str(e)
            raise
        finally:
            state.indexing_in_progress = False

    background_tasks.add_task(
        asyncio.to_thread,
        lambda: asyncio.run(do_batch_index()),
    )

    return {
        "status": "indexing_started",
        "directory": request.directory,
        "pdf_count": len(pdf_files)
    }


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Search indexed documents visually using text OR image query."""
    ensure_model_loaded()

    if not state.index_loaded:
        raise HTTPException(
            status_code=400,
            detail="No documents indexed yet. Please index documents first."
        )

    if not request.query and not request.query_image:
        raise HTTPException(
            status_code=400,
            detail="Either 'query' (text) or 'query_image' (base64) must be provided."
        )

    try:
        # Determine query input (Text or Image)
        query_input: Union[str, Image.Image] = request.query
        
        if request.query_image:
            try:
                # Decode base64 image
                image_data = base64.b64decode(request.query_image)
                query_input = Image.open(io.BytesIO(image_data)).convert("RGB")
                logger.info("Performing Image-to-Image visual search")
            except Exception as e:
                logger.error(f"Failed to decode query image: {e}")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid base64 image string"
                )
        else:
            logger.info(f"Performing Text-to-Image search: {request.query}")

        # Perform search using Byaldi
        # Byaldi's search() method handles both text string and PIL.Image automatically
        raw_results = state.model.search(
            query_input,
            k=request.k
        )

        # Format results
        results = []
        for r in raw_results:
            # Extract document info
            doc_id = None
            file_path = ""
            metadata = r.get("metadata", {})

            if metadata:
                doc_id = metadata.get("paperless_doc_id")
                file_path = metadata.get("source_path", "")

            result = SearchResult(
                doc_id=doc_id,
                page_num=r.get("page_num", 1),
                score=r.get("score", 0.0),
                metadata=metadata,
                file_path=file_path,
                base64=r.get("base64") if request.include_base64 else None
            )
            results.append(result)

        logger.info(f"Found {len(results)} results")

        return SearchResponse(
            query=request.query or "[IMAGE]",
            results=results,
            total_results=len(results)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search failed: {str(e)}"
        )


@app.delete("/index")
async def clear_index():
    """Clear the current index."""
    ensure_model_loaded()

    import shutil

    index_path = config.INDEX_DIR / config.DEFAULT_INDEX_NAME

    if index_path.exists():
        shutil.rmtree(index_path)
        logger.info(f"Cleared index: {index_path}")

    state.index_loaded = False
    state.indexed_documents.clear()

    # Reload model without index
    from byaldi import RAGMultiModalModel
    state.model = RAGMultiModalModel.from_pretrained(
        config.MODEL_NAME,
        verbose=1
    )

    return {"status": "index_cleared"}


@app.get("/error")
async def get_last_error():
    """Get the last error message."""
    return {"last_error": state.last_error}


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=False,
        workers=1  # Single worker for GPU model
    )
