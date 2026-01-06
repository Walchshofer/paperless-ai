-- Rollback migration for feedback_events (drops table and associated indexes)
-- Use with caution: this will remove persisted feedback_events data

BEGIN;

DROP INDEX IF EXISTS idx_feedback_event_type;
DROP INDEX IF EXISTS idx_feedback_processed_false;
DROP INDEX IF EXISTS idx_feedback_doc_id;

DROP TABLE IF EXISTS feedback_events;

COMMIT;

-- Note: this rollback does not remove columns added to other tables (e.g., visual_overlays).
-- Review and remove those changes manually if desired, ensuring no dependent data exists.