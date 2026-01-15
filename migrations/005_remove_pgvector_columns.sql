-- Migration: Remove pgvector columns from PostgreSQL
-- Context: Native Protocol Alpha-9 (Hybrid SOT)
-- Qdrant is now the SOT for vectors. Postgres retains metadata only.

-- Remove embedding column from visual_overlays
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding;

-- Add vector_id to link to Qdrant (if not already present)
-- This assumes pgcrypto extension is enabled for UUIDs
ALTER TABLE visual_overlays ADD COLUMN IF NOT EXISTS vector_id UUID;