import asyncio
import json
import os
import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .data_manager import DataManager
from .indexing import run_indexing
from .logging_utils import logger
from .search_engine import SearchEngine
from .settings import (
    DATA_DIR,
    DOCUMENTS_FILE,
    BM25_FILE,
)
from .state import global_state

POST_STARTUP_INDEX_INIT = False
STARTUP_ACTION = {
    "mode": None,
    "force_refresh": False,
    "check_new": False,
    "skip_check": False,
    "rebuild_indexes": False,
}


async def _run_post_startup_index_init():
    if not POST_STARTUP_INDEX_INIT:
        return
    await asyncio.sleep(2)
    logger.info("Post-startup initialization of search engine")
    run_indexing(force_update=False)


async def _run_startup_action():
    mode = STARTUP_ACTION["mode"]
    if mode is None:
        return

    if mode == "initialize":
        logger.info("Running initialization after startup")
        await asyncio.sleep(1)

        if (
            global_state.system_status.data_loaded
            and not STARTUP_ACTION["force_refresh"]
        ):
            logger.info(
                "Already have %s documents loaded",
                global_state.indexing_status.documents_count,
            )

            if (
                STARTUP_ACTION["skip_check"]
                and not STARTUP_ACTION["rebuild_indexes"]
            ):
                logger.info("Skipping document check due to --skip-check flag")

                if not global_state.system_status.index_ready:
                    logger.info(
                        "Initializing search engine with existing data"
                    )
                    global_state.search_engine.initialize(
                        force_update=STARTUP_ACTION["rebuild_indexes"]
                    )

                return

        run_indexing(
            STARTUP_ACTION["force_refresh"], STARTUP_ACTION["check_new"]
        )
        return

    if mode == "check_new":
        logger.info("Checking for new documents after startup")
        await asyncio.sleep(1)
        run_indexing(False, True)
        return

    if mode == "rebuild_indexes":
        logger.info("Rebuilding indexes after startup")
        await asyncio.sleep(2)
        if global_state.search_engine and global_state.data_manager.documents:
            logger.info("Rebuilding indexes with existing documents")
            global_state.search_engine.initialize(force_update=True)


async def startup_event():
    """Enhanced startup.

    Initialize global state and attempt to load existing data without
    reindexing.
    """
    global POST_STARTUP_INDEX_INIT

    logger.info("Starting RAGZ Document Search API")

    try:
        # Load saved system state if it exists
        global_state.load_state()

        # Verify loaded status values are consistent
        logger.info(
            "Loaded state has documents_count: %s",
            global_state.indexing_status.documents_count,
        )

        env_file_path = os.path.join(DATA_DIR, ".env")
        if not os.path.exists(env_file_path):
            logger.warning(
                ".env file not found at %s", os.path.abspath(env_file_path)
            )
            logger.info("Creating example .env file")

            os.makedirs(os.path.dirname(env_file_path), exist_ok=True)

            with open(env_file_path, "w") as handle:
                handle.write("# Paperless-NGX API configuration\n")
                handle.write("PAPERLESS_URL=https://your-paperless-instance\n")
                handle.write("PAPERLESS_API_TOKEN=your-api-token\n")
            logger.info(
                "Created example .env file at %s",
                os.path.abspath(env_file_path),
            )
            logger.info(
                "Please edit the .env file with your Paperless-NGX API "
                "configuration"
            )
            logger.warning(
                "Starting with limited functionality due to missing "
                "API configuration"
            )

            global_state.system_status.server_up = True
            global_state.indexing_status.message = (
                "API configuration missing in .env file"
            )
            global_state.save_state()
            return

        global_state.data_manager = DataManager(initialize_on_start=False)
        global_state.data_manager.initialize_models()

        documents_exist = os.path.exists(DOCUMENTS_FILE)
        bm25_exists = os.path.exists(BM25_FILE)
        pgvector_initialized = False

        if global_state.data_manager.db_pool:
            try:
                conn = global_state.data_manager.db_pool.getconn()
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM document_embeddings;")
                count = cursor.fetchone()[0]
                cursor.close()
                global_state.data_manager.db_pool.putconn(conn)
                pgvector_initialized = count > 0
            except Exception as exc:
                logger.error("Error checking pgvector table: %s", str(exc))
                logger.error(traceback.format_exc())
        global_state.system_status.pgvector_ready = pgvector_initialized

        if documents_exist:
            logger.info("Found existing data, loading without reindexing")

            # Always reload documents from JSON on startup - the in-memory list
            # is empty on process start even if data_loaded flag is True from
            # a previous session's persisted state
            try:
                global_state.data_manager.documents = []
                with open(DOCUMENTS_FILE, "r", encoding="utf-8") as handle:
                    loaded_docs = json.load(handle)

                    if not isinstance(loaded_docs, list) or (
                        loaded_docs
                        and not isinstance(loaded_docs[0], dict)
                    ):
                        logger.error(
                            "Invalid document structure in documents.json"
                        )
                        loaded_docs = []

                    global_state.data_manager.documents = loaded_docs

                if global_state.data_manager.documents:
                    global_state.system_status.data_loaded = True
                    global_state.indexing_status.documents_count = len(
                        global_state.data_manager.documents
                    )
                    global_state.save_state()
                    logger.info(
                        "Loaded %d documents from documents.json",
                        len(global_state.data_manager.documents)
                    )

            except Exception as exc:
                logger.error("Error loading documents: %s", str(exc))
                logger.error(traceback.format_exc())

            global_state.search_engine = SearchEngine(
                global_state.data_manager, initialize_on_start=False
            )

            # Sync search engine documents with data manager documents
            # This is needed because SearchEngine is created with
            # initialize_on_start=False
            if global_state.data_manager.documents:
                global_state.search_engine.documents = (
                    global_state.data_manager.documents
                )

            if (
                global_state.data_manager.documents
                and len(global_state.data_manager.documents) > 0
                and pgvector_initialized
                and bm25_exists
            ):

                logger.info(
                    "Found valid documents and indexes, attempting to load"
                )
                global_state.system_status.pgvector_ready = True

                if bm25_exists and global_state.search_engine:
                    try:
                        global_state.search_engine._load_bm25()

                        if global_state.search_engine.tokenized_corpus and len(
                            global_state.search_engine.tokenized_corpus
                        ) != len(global_state.data_manager.documents):
                            logger.warning(
                                "BM25 corpus size mismatch: %s vs %s "
                                "documents",
                                len(
                                    global_state.search_engine.tokenized_corpus
                                ),
                                len(global_state.data_manager.documents),
                            )
                            logger.info(
                                "Will rebuild BM25 index after startup"
                            )
                        else:
                            global_state.search_engine.is_initialized = True
                            global_state.system_status.index_ready = True
                            logger.info("Loaded existing BM25 index")
                    except Exception as exc:
                        logger.error("Error loading BM25 index: %s", str(exc))
                        logger.error(traceback.format_exc())

                if global_state.search_engine:
                    valid = global_state.search_engine.validate_state()
                    if not valid:
                        logger.warning("Search engine validation failed")

            logger.info("Loaded existing data")

            doc_count = (
                len(global_state.data_manager.documents)
                if global_state.data_manager.documents
                else 0
            )
            if global_state.indexing_status.documents_count != doc_count:
                logger.warning(
                    "Final fix for document count: %s -> %s",
                    global_state.indexing_status.documents_count,
                    doc_count,
                )
                global_state.indexing_status.documents_count = doc_count

            global_state.save_state()

            if (
                not global_state.search_engine.is_initialized
                or not global_state.search_engine.bm25_initialized
                or not pgvector_initialized
            ):

                logger.info("Search engine needs initialization after startup")
                POST_STARTUP_INDEX_INIT = True
        else:
            logger.info("Not all required data found for auto-loading")
            if not documents_exist:
                logger.info("Documents file not found")
            if not pgvector_initialized:
                logger.info("pgvector table not initialized")

            global_state.search_engine = SearchEngine(
                global_state.data_manager, initialize_on_start=False
            )
            logger.info("API ready but needs initialization before use")

        logger.info("RAGZ Document Search API startup completed")
        logger.info(
            "Final documents_count in indexing_status: %s",
            global_state.indexing_status.documents_count,
        )

    except Exception as exc:
        logger.error("Error during startup: %s", str(exc))
        logger.error(traceback.format_exc())
        global_state.system_status.server_up = True
        global_state.indexing_status.message = (
            f"Error during startup: {str(exc)}"
        )
        global_state.save_state()

        if not global_state.data_manager:
            try:
                global_state.data_manager = DataManager(
                    initialize_on_start=False
                )
            except Exception as dm_error:
                logger.error(
                    "Failed to initialize DataManager: %s", str(dm_error)
                )

        if not global_state.search_engine and global_state.data_manager:
            try:
                global_state.search_engine = SearchEngine(
                    global_state.data_manager, initialize_on_start=False
                )
            except Exception as se_error:
                logger.error(
                    "Failed to initialize SearchEngine: %s", str(se_error)
                )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await startup_event()
    await _run_startup_action()
    if STARTUP_ACTION["mode"] is None:
        await _run_post_startup_index_init()
    yield
