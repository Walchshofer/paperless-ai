import argparse
from typing import Any

import uvicorn

from rag_service.app import app  # type: ignore
from rag_service.logging_utils import logger
from rag_service.startup import STARTUP_ACTION  # type: ignore


def _apply_startup_args(args: Any):
    if args.initialize:
        logger.info("Auto-initialization requested via command line")
        if args.skip_check:
            logger.info(
                "Will skip checking for new documents during initialization"
            )

        STARTUP_ACTION["mode"] = "initialize"
        STARTUP_ACTION["force_refresh"] = args.force_refresh
        STARTUP_ACTION["check_new"] = args.check_new
        STARTUP_ACTION["skip_check"] = args.skip_check
        STARTUP_ACTION["rebuild_indexes"] = args.rebuild_indexes
        return

    if args.check_new:
        logger.info("Check for new documents requested via command line")
        STARTUP_ACTION["mode"] = "check_new"
        return

    if args.rebuild_indexes:
        logger.info("Rebuild indexes requested via command line")
        STARTUP_ACTION["mode"] = "rebuild_indexes"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RAGZ Document Search API")
    parser.add_argument(
        "--port", type=int, default=8000, help="Port to run the server on"
    )
    parser.add_argument(
        "--host", type=str, default="0.0.0.0", help="Host to run the server on"
    )
    parser.add_argument(
        "--initialize",
        action="store_true",
        help="Initialize search engine on startup if needed",
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force refresh documents from API",
    )
    parser.add_argument(
        "--auto-load",
        action="store_true",
        default=True,
        help="Automatically load existing index if available",
    )
    parser.add_argument(
        "--check-new",
        action="store_true",
        help="Check for new documents on startup",
    )
    parser.add_argument(
        "--skip-check",
        action="store_true",
        help="Skip checking for new documents even with --initialize",
    )
    parser.add_argument(
        "--rebuild-indexes",
        action="store_true",
        help="Force rebuild of BM25 and vector indexes on startup",
    )

    args = parser.parse_args()
    _apply_startup_args(args)

    uvicorn.run(app, host=args.host, port=args.port, reload=False)
