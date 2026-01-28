-- 007_create_user_annotations.sql
-- Creates a table for per-user visual annotations

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS user_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  page INTEGER NOT NULL,
  bbox JSONB NOT NULL,
  label VARCHAR(255),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_annotations_user_doc ON user_annotations(user_id, document_id);
CREATE INDEX IF NOT EXISTS idx_user_annotations_page ON user_annotations(document_id, page);
