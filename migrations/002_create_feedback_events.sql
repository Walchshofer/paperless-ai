-- Migration: create feedback_events table
-- Supports both PostgreSQL and SQLite variants for local/dev and production

-- PostgreSQL DDL
-- Uncomment for Postgres-managed deployments
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CREATE TABLE IF NOT EXISTS feedback_events (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   doc_id INTEGER NOT NULL,
--   user_id INTEGER,
--   event_type VARCHAR(50) NOT NULL,
--   field_name VARCHAR(100),
--   original_value JSONB,
--   corrected_value JSONB,
--   context JSONB,
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   processed BOOLEAN DEFAULT FALSE
-- );
-- CREATE INDEX IF NOT EXISTS idx_feedback_doc_id ON feedback_events(doc_id);
-- CREATE INDEX IF NOT EXISTS idx_feedback_processed_false ON feedback_events(created_at) WHERE processed = FALSE;
-- CREATE INDEX IF NOT EXISTS idx_feedback_event_type ON feedback_events(event_type);

-- SQLite DDL (for local dev and tests)
CREATE TABLE IF NOT EXISTS feedback_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL,
  user_id INTEGER,
  event_type TEXT NOT NULL,
  field_name TEXT,
  original_value TEXT,
  corrected_value TEXT,
  context TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_feedback_document_id ON feedback_events(document_id);
CREATE INDEX IF NOT EXISTS idx_feedback_processed ON feedback_events(processed);
