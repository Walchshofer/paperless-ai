import traceback

from fastapi import HTTPException

from .logging_utils import logger
from .state import global_state


def get_search_engine():
    if not global_state.search_engine:
        logger.error("Search engine not initialized")
        raise HTTPException(
            status_code=503,
            detail=(
                "Search engine not initialized. "
                "Please initialize the engine first."
            ),
        )

    if global_state.search_engine.is_initialized:
        if (
            not global_state.search_engine.bm25_initialized
            or not global_state.system_status.qdrant_ready
        ):
            logger.error(
                "Search engine components are missing, trying to reinitialize"
            )
            try:
                global_state.search_engine.initialize(force_update=False)
            except Exception as exc:
                logger.error(
                    "Failed to reinitialize search engine: %s", str(exc)
                )
                try:
                    global_state.search_engine.initialize(force_update=True)
                except Exception as exc2:
                    logger.error(
                        "Forced reinitialization failed: %s", str(exc2)
                    )
                    logger.error(traceback.format_exc())
                    raise HTTPException(
                        status_code=503,
                        detail=(
                            "Search engine is corrupted and could not be "
                            "reinitialized."
                        ),
                    )

    if not global_state.search_engine.is_initialized:
        logger.warning(
            "Search engine not initialized, attempting to initialize on demand"
        )
        try:
            global_state.search_engine.initialize(force_update=False)
            if not global_state.search_engine.is_initialized:
                raise Exception("Initialization failed")
        except Exception as exc:
            logger.error("Failed to initialize search engine: %s", str(exc))
            raise HTTPException(
                status_code=503,
                detail=(
                    "Search engine initialization failed. "
                    "Please try again."
                ),
            )

    return global_state.search_engine
