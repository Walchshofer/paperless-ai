#!/usr/bin/env python3
"""
Re-ingestion script for migrating text embeddings to Qdrant.
Fetches all documents from Paperless-ngx and upserts them to Qdrant.
"""

import logging
import os
import sys

# Add parent directory to path to import rag_service
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ragz_service.data_manager import DataManager
from ragz_service.qdrant_adapter import qdrant_adapter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("ReingestText")


def main():
    logger.info("Starting text embedding re-ingestion...")

    # Initialize DataManager
    try:
        data_manager = DataManager(initialize_on_start=True)
    except Exception as e:
        logger.error(f"Failed to initialize DataManager: {e}")
        sys.exit(1)

    # Fetch all documents
    logger.info("Fetching documents from Paperless-ngx...")
    try:
        documents = data_manager.fetch_documents_from_api()
        logger.info(f"Fetched {len(documents)} documents.")
    except Exception as e:
        logger.error(f"Failed to fetch documents: {e}")
        sys.exit(1)

    if not documents:
        logger.warning("No documents found to ingest.")
        sys.exit(0)

    # Upsert to Qdrant
    logger.info("Upserting documents to Qdrant...")
    success = data_manager._add_documents_to_qdrant(documents)

    if success:
        stats = qdrant_adapter.get_collection_stats()
        logger.info("Re-ingestion complete successfully.")
        logger.info(f"Qdrant Collection Stats: {stats}")
    else:
        logger.error("Re-ingestion failed during upsert.")
        sys.exit(1)


if __name__ == "__main__":
    main()