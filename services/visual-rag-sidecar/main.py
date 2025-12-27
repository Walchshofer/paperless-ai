"""
Visual RAG Sidecar Service

A FastAPI service that provides visual document retrieval using ColQwen2/ColPali
via the Byaldi library. This service indexes PDF pages as images and enables
semantic search that understands document layout, tables, charts, and formatting.

Architecture:
- Runs as a Docker sidecar alongside paperless-ngx
- Shares GPU with Ollama (RTX 3090 Ti 24GB)
- Stores indices in /data/indices (persisted volume)
- Reads PDFs from /media/paperless (read-only mount)
"""

import os
import logging
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("visual_rag")

# =============================================================================
# Configuration
# =============================================================================

class Config:
    """Service configuration from environment variables."""

    # Model settings
    MODEL_NAME = os.getenv("VISUAL_RAG_MODEL", "vidore/colqwen2-v1.0")

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
    pdf_path: str = Field(..., description="Path to PDF file (relative to /media/paperless)")
    doc_id: Optional[int] = Field(None, description="Document ID from Paperless-ngx")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


class IndexDirectoryRequest(BaseModel):
    directory: str = Field("documents/originals", description="Directory to index (relative to /media/paperless)")
    recursive: bool = Field(True, description="Index subdirectories")


class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query text")
    k: int = Field(5, ge=1, le=50, description="Number of results to return")
    include_base64: bool = Field(False, description="Include base64 image in results")


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
        logger.info(f"This may take 30-60 seconds on first load...")

        # Import here to avoid startup delay if model not needed
        from byaldi import RAGMultiModalModel

        # Check if existing index exists
        index_path = config.INDEX_DIR / config.DEFAULT_INDEX_NAME

        if index_path.exists():
            logger.info(f"Loading existing index from: {index_path}")
            state.model = RAGMultiModalModel.from_index(
                str(index_path),
                verbose=1
            )
            state.index_loaded = True
            logger.info("Existing index loaded successfully")
        else:
            logger.info("No existing index found, loading model for new indexing")
            state.model = RAGMultiModalModel.from_pretrained(
                config.MODEL_NAME,
                verbose=1
            )

        state.model_loaded = True
        logger.info("Visual retrieval model loaded successfully")

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

    # Ensure directories exist
    config.INDEX_DIR.mkdir(parents=True, exist_ok=True)

    # Load model in background to not block startup
    asyncio.create_task(asyncio.to_thread(load_model))

    yield

    # Shutdown
    logger.info("Shutting down Visual RAG Sidecar Service")
    state.model = None
    state.model_loaded = False


app = FastAPI(
    title="Visual RAG Sidecar",
    description="Visual document retrieval service using ColQwen2/ColPali",
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
async def index_document(request: IndexRequest, background_tasks: BackgroundTasks):
    """Index a single PDF document."""
    ensure_model_loaded()

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

    async def do_index():
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
    background_tasks.add_task(asyncio.to_thread, lambda: asyncio.run(do_index()))

    return {"status": "indexing_started", "document": request.pdf_path}


@app.post("/index/directory")
async def index_directory(request: IndexDirectoryRequest, background_tasks: BackgroundTasks):
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
            logger.info(f"Batch indexing {len(pdf_files)} PDFs from: {full_path}")

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

    background_tasks.add_task(asyncio.to_thread, lambda: asyncio.run(do_batch_index()))

    return {
        "status": "indexing_started",
        "directory": request.directory,
        "pdf_count": len(pdf_files)
    }


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Search indexed documents visually."""
    ensure_model_loaded()

    if not state.index_loaded:
        raise HTTPException(
            status_code=400,
            detail="No documents indexed yet. Please index documents first."
        )

    try:
        logger.info(f"Searching for: {request.query}")

        # Perform search
        raw_results = state.model.search(
            request.query,
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

        logger.info(f"Found {len(results)} results for query: {request.query}")

        return SearchResponse(
            query=request.query,
            results=results,
            total_results=len(results)
        )

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
