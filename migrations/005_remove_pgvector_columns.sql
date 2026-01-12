BEGIN;

-- Drop vector indexes (if any remain)
DROP INDEX IF EXISTS idx_visual_overlays_embedding;
DROP INDEX IF EXISTS idx_visual_overlays_embedding_hnsw;
DROP INDEX IF EXISTS idx_visual_overlays_embedding_ivfflat;
DROP INDEX IF EXISTS idx_visual_overlays_embedding_vector;
DROP INDEX IF EXISTS idx_embedding_cosine;

-- Remove vector columns from visual_overlays
ALTER TABLE visual_overlays
    DROP COLUMN IF EXISTS embedding,
    DROP COLUMN IF EXISTS embedding_vector,
    DROP COLUMN IF EXISTS embedding_jsonb_backup,
    DROP COLUMN IF EXISTS embedding_legacy_backup,
    DROP COLUMN IF EXISTS embedding_vector_legacy_backup,
    DROP COLUMN IF EXISTS vector_320;

-- Remove text embeddings table (Qdrant is the vector SOT)
DROP TABLE IF EXISTS document_embeddings;

COMMIT;
