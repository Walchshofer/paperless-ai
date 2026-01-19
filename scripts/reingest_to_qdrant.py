#!/usr/bin/env python3
import argparse
import logging
import sys
from pathlib import Path

# Add project root to Python path to allow importing rag_service
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(PROJECT_ROOT))

from ragz_service.data_manager import DataManager  # noqa: E402
from ragz_service.logging_utils import logger  # noqa: E402


def main():
    parser = argparse.ArgumentParser(
        description="Re-ingest documents from Paperless-NGX to Qdrant"
    )
    parser.add_argument(
        "--force-refresh",
        action="store_true",
        help="Force fetch documents from API instead of using local cache"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Process documents but do not upsert to Qdrant"
    )
    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    logger.info("Starting Qdrant re-ingestion process")

    try:
        # Initialize DataManager
        # This will also initialize the Qdrant adapter via initialize_models
        dm = DataManager(initialize_on_start=True)

        if not dm.is_initialized:
            logger.error(
                "Failed to initialize DataManager. Check configuration."
            )
            sys.exit(1)

        # Load documents
        logger.info("Loading documents...")
        documents = dm.load_documents(force_refresh=args.force_refresh)

        if not documents:
            logger.warning("No documents found to ingest.")
            return

        logger.info(f"Found {len(documents)} documents to process.")

        if args.dry_run:
            logger.info("Dry run enabled - skipping upsert.")
            return

        # Perform upsert
        # Accessing protected method as this is a maintenance script
        logger.info("Upserting documents to Qdrant...")
        success = dm._add_documents_to_qdrant(documents)  # type: ignore

        if success:
            logger.info(
                "✅ Successfully re-ingested all documents into Qdrant."
            )
        else:
            logger.error("❌ Failed to complete Qdrant ingestion.")
            sys.exit(1)

    except Exception as e:
        logger.exception(f"Fatal error during re-ingestion: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()