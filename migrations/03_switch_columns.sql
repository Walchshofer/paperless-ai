BEGIN;

-- 1. Rename the old JSONB column to a backup name
ALTER TABLE visual_overlays 
RENAME COLUMN embedding TO embedding_jsonb_backup;

-- 2. Rename the new Vector column to the active name
ALTER TABLE visual_overlays 
RENAME COLUMN embedding_vector TO embedding;

-- 3. Optionally rename the index to match the new column name
ALTER INDEX IF EXISTS idx_visual_overlays_embedding_vector 
RENAME TO idx_visual_overlays_embedding;

COMMIT;
