import traceback
from datetime import datetime

from .logging_utils import logger
from .state import global_state


def run_indexing(
    force_update: bool = False, check_new: bool = False
) -> None:
    """Führt die Indexierung als Hintergrundaufgabe aus.

    Fokus liegt auf neuen Dokumenten.
    """
    try:
        global_state.indexing_status.running = True
        global_state.indexing_status.message = "Indexierung gestartet"
        global_state.save_state()

        # Check if models are initialized
        if not global_state.data_manager.is_initialized:
            global_state.indexing_status.message = "Initializing models"
            global_state.save_state()
            global_state.data_manager.initialize_models()

        # Dokumente aktualisieren
        if force_update:
            global_state.indexing_status.message = (
                "Vollständige Neuindexierung wird durchgeführt"
            )
            global_state.save_state()
            # Force refresh will reindex everything
            global_state.data_manager.load_documents(force_refresh=True)
        else:
            # Check if we need to check for new documents
            should_check = (
                global_state.system_status.data_loaded == False or check_new
            )

            if should_check:
                global_state.indexing_status.message = (
                    "Prüfe auf neue Dokumente"
                )
                global_state.save_state()
                # Explicitly check for new documents
                global_state.data_manager.load_documents(
                    force_refresh=False, check_new=True
                )
            else:
                global_state.indexing_status.message = (
                    "Lade vorhandene Dokumente ohne Aktualisierung"
                )
                global_state.save_state()
                # Load documents without checking for new ones
                global_state.data_manager.load_documents(
                    force_refresh=False, check_new=False
                )

        # Determine if new documents were found
        new_docs_count = len(global_state.data_manager.new_document_ids)

        # Update the status message based on whether new documents were found
        if new_docs_count > 0:
            global_state.indexing_status.message = (
                f"Indexiere {new_docs_count} neue Dokumente"
            )
            global_state.save_state()

            # Initialize or update the search engine
            # The force_update parameter will be passed through to control
            # whether to do a full rebuild or just add new documents.
            global_state.search_engine.initialize(force_update=force_update)

            global_state.indexing_status.message = (
                "Indexierung abgeschlossen - "
                f"{new_docs_count} neue Dokumente hinzugefügt"
            )
        else:
            # If we have documents loaded and search engine not initialized,
            # load existing indexes
            if (
                global_state.system_status.data_loaded
                and not global_state.search_engine.is_initialized
            ):
                # Just load existing indexes without rebuilding
                global_state.indexing_status.message = (
                    "Lade vorhandene Indizes"
                )
                global_state.save_state()
                global_state.search_engine.initialize(force_update=False)

            global_state.indexing_status.message = (
                "Keine neuen Dokumente gefunden, Suchindex ist aktuell"
            )

        # Validate the search engine after indexing
        if (
            not global_state.search_engine.is_initialized
            or not global_state.search_engine.validate_state()
        ):
            logger.warning(
                "Search engine validation failed after indexing, "
                "forcing rebuild"
            )
            global_state.indexing_status.message = (
                "Validation failed, rebuilding index"
            )
            global_state.save_state()

            # Force rebuild of search engine
            global_state.search_engine.initialize(force_update=True)

            if global_state.search_engine.is_initialized:
                global_state.indexing_status.message = (
                    "Index rebuilt successfully"
                )
            else:
                global_state.indexing_status.message = (
                    "Failed to rebuild index"
                )

        # Status aktualisieren
        global_state.indexing_status.running = False
        global_state.indexing_status.last_indexed = datetime.now().isoformat()
        global_state.indexing_status.up_to_date = True
        global_state.save_state()

    except Exception as e:
        global_state.indexing_status.running = False
        global_state.indexing_status.message = (
            f"Fehler bei der Indexierung: {str(e)}"
        )
        global_state.save_state()
        logger.error(f"Indexing error: {str(e)}")
        logger.error(traceback.format_exc())
