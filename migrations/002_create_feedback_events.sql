-- Migration: create feedback_events table (PostgreSQL)
-- Use PostgreSQL schema with UUID primary key and JSONB columns per FEEDBACK_PERSISTENCE_STRATEGY.md

-- Ensure extension for gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS feedback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id INTEGER NOT NULL,
  user_id INTEGER,
  event_type VARCHAR(50) NOT NULL,
  field_name VARCHAR(100),
  original_value JSONB,
  corrected_value JSONB,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_feedback_doc_id ON feedback_events(doc_id);
CREATE INDEX IF NOT EXISTS idx_feedback_processed_false ON feedback_events(created_at) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_feedback_event_type ON feedback_events(event_type);

-- Ensure visual_overlays table exists and supports manual annotations
CREATE TABLE IF NOT EXISTS visual_overlays (
  id SERIAL PRIMARY KEY,
  doc_id INTEGER NOT NULL,
  page_number INTEGER DEFAULT 1,
  overlay_data JSONB,
  semantic_label TEXT,
  source VARCHAR(50),
  bbox JSONB,
  vector_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS visual_overlays ADD COLUMN IF NOT EXISTS source VARCHAR(50);
ALTER TABLE IF EXISTS visual_overlays ADD COLUMN IF NOT EXISTS bbox JSONB;
-- Add vector_id to link to Qdrant (UUID) and remove any legacy embedding column (pgvector/payload)
ALTER TABLE IF EXISTS visual_overlays ADD COLUMN IF NOT EXISTS vector_id UUID;
ALTER TABLE IF EXISTS visual_overlays DROP COLUMN IF EXISTS embedding;

-- Note: rollback script provided in migrations/002_rollback_feedback_events.sql
