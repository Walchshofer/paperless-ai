import os
import traceback
from typing import Any, Dict, List, Optional, cast

from fastapi import Depends, FastAPI, HTTPException  # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore

from dependencies import get_search_engine
from indexing import run_indexing
from logging_utils import logger
from models import (
    AskQuestionRequest,
    IndexingRequest,
    IndexingStatus,
    SearchRequest,
    SearchResult,
)
from qdrant_adapter import qdrant_adapter
from search_engine import SearchEngine
from startup import lifespan  # type: ignore
from state import global_state
from settings import DATA_DIR

app: Any = cast(Any, FastAPI)(
    title="RAGZ Document Search API", lifespan=cast(Any, lifespan)
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/search", response_model=List[SearchResult])  # type: ignore
async def search_documents(
    request: SearchRequest,
    search_engine: SearchEngine = Depends(get_search_engine),
) -> List[SearchResult]:
    """Search documents with the given query and filters"""
    try:
        logger.info(f"Search request: {request}")
        return search_engine.search(request)
    except Exception as exc:
        logger.error(f"Search error: {str(exc)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/context", response_model=dict)  # type: ignore
async def get_context(
    request: AskQuestionRequest,
    search_engine: SearchEngine = Depends(get_search_engine),
) -> Dict[str, Any]:
    """Get context for a question without answering it"""
    try:
        logger.info(f"Context request: {request.question}")

        if (
            not search_engine.is_initialized
            or not search_engine.validate_state()
        ):
            logger.warning(
                "Search engine validation failed, attempting to reinitialize"
            )
            search_engine.initialize(force_update=False)

        search_results = search_engine.search(
            SearchRequest(query=request.question)
        )

        if not search_results or len(search_results) == 0:
            logger.warning("No search results found for context request")
            return {
                "context": "No relevant documents found.",
                "sources": [],
                "query": request.question,
            }

        max_sources = min(request.max_sources, len(search_results))

        sources: List[Dict[str, Any]] = []
        context = ""

        for i, result in enumerate(search_results[:max_sources]):
            if not hasattr(result, "title") or not hasattr(result, "snippet"):
                logger.error(f"Invalid search result at index {i}")
                continue

            context += (
                f"Document {i + 1}: {result.title}\n"
                f"{result.snippet}\n\n"
            )
            sources.append(
                {
                    "title": result.title,
                    "correspondent": result.correspondent,
                    "date": result.date,
                    "snippet": result.snippet,
                    "doc_id": result.doc_id,
                }
            )

        return {
            "context": context,
            "sources": sources,
            "query": request.question,
        }
    except Exception as exc:
        logger.error(f"Context error: {str(exc)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/status", response_model=dict)  # type: ignore
async def get_status() -> Dict[str, Any]:
    """Get system status with accurate document count and additional fields"""
    global_state.system_status.indexing_status = global_state.indexing_status

    if (
        global_state.data_manager
        and hasattr(global_state.data_manager, "documents")
        and global_state.data_manager.documents
    ):
        doc_count = len(global_state.data_manager.documents)
        if (
            doc_count > 0
            and global_state.indexing_status.documents_count != doc_count
        ):
            logger.warning(
                "Correcting document count discrepancy in status response: "
                "%s -> %s",
                global_state.indexing_status.documents_count,
                doc_count,
            )
            global_state.indexing_status.documents_count = doc_count
            global_state.system_status.indexing_status.documents_count = (
                doc_count
            )
    elif global_state.indexing_status.documents_count > 0:
        logger.info(
            "Preserving document count in status response: %s",
            global_state.indexing_status.documents_count,
        )
        global_state.system_status.indexing_status.documents_count = (
            global_state.indexing_status.documents_count
        )

    logger.info(
        "Status API returning documents_count: %s",
        global_state.system_status.indexing_status.documents_count,
    )

    status_dict = global_state.system_status.model_dump()
    status_dict["ai_status"] = "ok"
    status_dict["ai_model"] = "sauerkraut-llama3.1:8b"

    return status_dict


@app.get("/indexing/status", response_model=IndexingStatus)  # type: ignore
async def get_indexing_status() -> IndexingStatus:
    """Get indexing status"""
    return global_state.indexing_status


@app.post("/indexing/check")  # type: ignore
async def check_for_updates() -> Dict[str, Any]:
    """Check if updates are available"""
    if global_state.indexing_status.running:
        return {"status": "running", "message": "Indexing already in progress"}

    needs_update, message = global_state.data_manager.check_for_updates()
    return {"needs_update": needs_update, "message": message}


@app.post("/indexing/start")  # type: ignore
async def start_indexing(
    request: IndexingRequest, background_tasks: Any
) -> Dict[str, str]:
    """Start indexing process"""
    if global_state.indexing_status.running:
        return {"status": "running", "message": "Indexing already in progress"}

    if not global_state.data_manager.is_initialized:
        global_state.data_manager.initialize_models()

    if request.background:
        background_tasks.add_task(run_indexing, request.force, False)
        return {
            "status": "started",
            "message": "Indexing started in background",
        }

    run_indexing(request.force, False)
    return {"status": "completed", "message": "Indexing completed"}


@app.post("/initialize")  # type: ignore
async def initialize_system(
    force: bool = False,
    background: bool = True,
    background_tasks: Optional[Any] = None,
) -> Dict[str, Any]:
    """Initialize the system and check environment variables"""
    env_vars = {
        "PAPERLESS_URL": os.getenv("PAPERLESS_URL"),
        "PAPERLESS_NGX_URL": os.getenv("PAPERLESS_NGX_URL"),
        "PAPERLESS_HOST": os.getenv("PAPERLESS_HOST"),
        "PAPERLESS_TOKEN": (
            "[HIDDEN]" if os.getenv("PAPERLESS_TOKEN") else None
        ),
        "PAPERLESS_API_TOKEN": (
            "[HIDDEN]" if os.getenv("PAPERLESS_API_TOKEN") else None
        ),
        "PAPERLESS_APIKEY": (
            "[HIDDEN]" if os.getenv("PAPERLESS_APIKEY") else None
        ),
    }

    env_file_path = os.path.join(DATA_DIR, ".env")
    env_file_exists = os.path.exists(env_file_path)

    if global_state.indexing_status.running:
        return {
            "status": "running",
            "message": "Indexing already in progress",
            "env_file_exists": env_file_exists,
            "env_file_path": env_file_path if env_file_exists else None,
            "environment_variables": env_vars,
            "working_directory": os.getcwd(),
            "config_valid": bool(
                global_state.data_manager
                and global_state.data_manager.paperless_url
                and global_state.data_manager.paperless_token
            ),
        }

    if not global_state.data_manager.is_initialized:
        global_state.data_manager.initialize_models()

    if not global_state.system_status.data_loaded or force:
        global_state.data_manager.load_documents(
            force_refresh=force, check_new=False
        )

    if background and background_tasks:
        background_tasks.add_task(run_indexing, force, False)
        status = "initializing"
        message = "System initialization started in background"
    else:
        run_indexing(force, False)
        status = "initialized"
        message = "System initialized"

    return {
        "status": status,
        "message": message,
        "data_loaded": global_state.system_status.data_loaded,
        "index_ready": global_state.system_status.index_ready,
        "env_file_exists": env_file_exists,
        "env_file_path": env_file_path if env_file_exists else None,
        "environment_variables": env_vars,
        "working_directory": os.getcwd(),
        "config_valid": bool(
            global_state.data_manager
            and global_state.data_manager.paperless_url
            and global_state.data_manager.paperless_token
        ),
    }


@app.post("/check_health")  # type: ignore
async def check_health() -> Dict[str, Any]:
    """Perform a comprehensive health check of the system"""
    health_status: Dict[str, Any] = {
        "server_status": "ok",
        "data_manager": "unknown",
        "search_engine": "unknown",
        "documents_loaded": False,
        "qdrant_initialized": False,
        "bm25_initialized": False,
        "issues": [],  # type: ignore
        "recommendations": [],  # type: ignore
    }

    try:
        if not global_state.data_manager:
            health_status["issues"].append("DataManager not initialized")
            health_status["recommendations"].append(
                "Call /initialize endpoint"
            )
            health_status["data_manager"] = "missing"
        elif not global_state.data_manager.is_initialized:
            health_status["issues"].append(
                "DataManager models not initialized"
            )
            health_status["recommendations"].append(
                "Call /initialize endpoint"
            )
            health_status["data_manager"] = "partial"
        else:
            health_status["data_manager"] = "ok"

        if global_state.data_manager and global_state.data_manager.documents:
            health_status["documents_loaded"] = True

        if not global_state.search_engine:
            health_status["issues"].append("Search engine not initialized")
            health_status["recommendations"].append(
                "Call /indexing/start endpoint"
            )
            health_status["search_engine"] = "missing"
        elif not global_state.search_engine.is_initialized:
            health_status["issues"].append("Search engine not initialized")
            health_status["recommendations"].append(
                "Call /indexing/start endpoint"
            )
            health_status["search_engine"] = "partial"
        else:
            health_status["search_engine"] = "ok"

        # Check Qdrant
        try:
            qdrant_health = qdrant_adapter.health_check()
            if not qdrant_health.get("healthy"):
                health_status["issues"].append("Qdrant not initialized")
                health_status["recommendations"].append(
                    "Start Qdrant and run /indexing/start"
                )
                health_status["search_engine"] = "missing"
            else:
                doc_coll = qdrant_health.get("collections", {}).get(
                    "document_embeddings",
                    {},
                )
                count = doc_coll.get("point_count", 0)
                health_status["qdrant_initialized"] = doc_coll.get(
                    "exists",
                    False,
                )
                if count == 0:
                    health_status["issues"].append(
                        "Qdrant document_embeddings is empty"
                    )
                    health_status["recommendations"].append(
                        "Call /indexing/start with force=true to rebuild "
                        "embeddings"
                    )
                else:
                    health_status["search_engine"] = "ok"
        except Exception as exc:
            logger.error("Error checking Qdrant: %s", str(exc))
            health_status["issues"].append("Error checking Qdrant")

        if (
            global_state.search_engine
            and global_state.search_engine.bm25
            and global_state.search_engine.tokenized_corpus
        ):
            bm25_count = len(global_state.search_engine.tokenized_corpus)
            health_status["bm25_initialized"] = bm25_count > 0
            if bm25_count == 0:
                health_status["issues"].append("BM25 index is empty")
                health_status["recommendations"].append(
                    "Call /indexing/start with force=true to rebuild BM25"
                )
        else:
            health_status["issues"].append("BM25 index not initialized")
            health_status["recommendations"].append(
                "Call /indexing/start endpoint"
            )

        if not health_status["issues"]:
            health_status["overall_status"] = "healthy"
        elif len(health_status["issues"]) <= 2:
            health_status["overall_status"] = "warning"
        else:
            health_status["overall_status"] = "critical"

    except Exception as exc:
        health_status["server_status"] = "error"
        health_status["error"] = str(exc)
        health_status["overall_status"] = "critical"
        health_status["issues"].append(
            f"Error during health check: {str(exc)}"
        )
        health_status["recommendations"].append(
            "Restart the server and call /initialize with force=true"
        )

    return health_status


@app.get("/health")  # type: ignore
async def health() -> Dict[str, Any]:
    """Alias for health check (read-only)"""
    return await check_health()
