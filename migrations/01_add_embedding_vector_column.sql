-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add the new vector column (nullable initially)
-- We do NOT create the index here to speed up the migration; index will be created after population
ALTER TABLE visual_overlays 
ADD COLUMN IF NOT EXISTS embedding_vector vector(768) DEFAULT NULL;
