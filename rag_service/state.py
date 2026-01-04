import json
import os

from .logging_utils import logger
from .models import IndexingStatus, SystemStatus
from .settings import STATE_FILE


class GlobalState:
    def __init__(self):
        self.data_manager = None
        self.search_engine = None
        self.system_status = SystemStatus()
        self.indexing_status = IndexingStatus()
        self.state_schema_version = 2
        self._indexed_document_ids = set()

    def save_state(self):
        """Save global state to disk with schema version"""
        try:
            state_dict = {
                "schema_version": self.state_schema_version,
                "indexing_status": {
                    "running": self.indexing_status.running,
                    "last_indexed": self.indexing_status.last_indexed,
                    "documents_count": self.indexing_status.documents_count,
                    "up_to_date": self.indexing_status.up_to_date,
                    "message": self.indexing_status.message,
                },
                "system_status": {
                    "data_loaded": self.system_status.data_loaded,
                    "index_ready": self.system_status.index_ready,
                    "pgvector_ready": self.system_status.pgvector_ready,
                    "bm25_ready": self.system_status.bm25_ready,
                },
                "indexed_document_ids": (
                    list(self.data_manager.indexed_document_ids)
                    if self.data_manager
                    else list(self._indexed_document_ids)
                ),
            }

            os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
            with open(STATE_FILE, "w", encoding="utf-8") as handle:
                json.dump(state_dict, handle, ensure_ascii=False, indent=2)

            logger.info(f"System state saved to {STATE_FILE}")
            return True
        except Exception as exc:
            logger.error(f"Error saving system state: {str(exc)}")
            return False

    def load_state(self):
        """Load global state from disk with schema version check"""
        try:
            if os.path.exists(STATE_FILE):
                with open(STATE_FILE, "r", encoding="utf-8") as handle:
                    state_dict = json.load(handle)

                schema_version = state_dict.get("schema_version", 0)
                if schema_version != self.state_schema_version:
                    logger.warning(
                        "State file schema version mismatch: %s vs %s",
                        schema_version,
                        self.state_schema_version,
                    )

                if "indexing_status" in state_dict:
                    idx_status = state_dict["indexing_status"]
                    self.indexing_status.last_indexed = idx_status.get(
                        "last_indexed"
                    )
                    self.indexing_status.documents_count = idx_status.get(
                        "documents_count", 0
                    )
                    self.indexing_status.up_to_date = idx_status.get(
                        "up_to_date", False
                    )
                    self.indexing_status.message = idx_status.get(
                        "message", ""
                    )
                    self.indexing_status.running = False

                    logger.info(
                        "Loaded indexing status: %s documents, last "
                        "indexed: %s",
                        self.indexing_status.documents_count,
                        self.indexing_status.last_indexed,
                    )

                if "system_status" in state_dict:
                    sys_status = state_dict["system_status"]
                    self.system_status.data_loaded = sys_status.get(
                        "data_loaded", False
                    )
                    self.system_status.index_ready = sys_status.get(
                        "index_ready", False
                    )
                    self.system_status.pgvector_ready = sys_status.get(
                        "pgvector_ready", False
                    )
                    self.system_status.bm25_ready = sys_status.get(
                        "bm25_ready", False
                    )

                self._indexed_document_ids = set(
                    state_dict.get("indexed_document_ids", [])
                )

                logger.info(
                    "System state loaded from %s with %s indexed document IDs",
                    STATE_FILE,
                    len(self._indexed_document_ids),
                )
                return True

            logger.info(
                "No system state file found, starting with default state"
            )
            return False
        except Exception as exc:
            logger.error(f"Error loading system state: {str(exc)}")
            return False


global_state = GlobalState()
