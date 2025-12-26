-- init_council_storage.sql
-- Migration: Create storage for visual overlays and enable vector extension
-- Purpose: Link Visual Retrieval (Tomoro/Byaldi) overlays with Paperless-NGX documents
-- Date: 2025-12-25
-- Updated: 2025-12-26 - Removed FK constraint for standalone operation

-- Enable pgvector (used for vector/text fallbacks where applicable)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create visual_overlays table
-- Stores bounding boxes / labels produced by qwen3-vl / Tomoro visual pipelines
-- Example overlay_data: {"label": "signature", "box": [ymin, xmin, ymax, xmax]}
--
-- NOTE: doc_id logically references paperless-ngx documents(id) but we do NOT
-- enforce FK constraint because:
-- 1. paperless-ai runs as a separate application
-- 2. May not have direct access to enforce FK on paperless-ngx database
-- 3. Application layer handles document lifecycle and cleanup

CREATE TABLE IF NOT EXISTS visual_overlays (
    id BIGSERIAL PRIMARY KEY,
    -- Logical reference to Paperless-NGX document ID (no FK constraint)
    doc_id BIGINT NOT NULL,
    page_number INTEGER NOT NULL,
    overlay_data JSONB NOT NULL,
    semantic_label VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
-- Composite index for quick lookup by document and page (typical access pattern)
CREATE INDEX IF NOT EXISTS idx_visual_overlays_doc_page ON visual_overlays (doc_id, page_number);

-- GIN index to speed up JSONB containment/lookup on overlay_data
CREATE INDEX IF NOT EXISTS idx_visual_overlays_overlay_data_gin ON visual_overlays USING gin (overlay_data jsonb_path_ops);

-- Index on semantic_label to support semantic categorization and lookups
CREATE INDEX IF NOT EXISTS idx_visual_overlays_semantic_label ON visual_overlays (semantic_label);

-- Tomoro indexer compatibility: many visual indexers identify items by a string combining document id and page,
-- e.g. "<doc_id>:<page_number>". Provide an expression index that supports that lookup format.
CREATE INDEX IF NOT EXISTS idx_visual_overlays_tomoro_id ON visual_overlays ((doc_id::text || ':' || page_number::text));

-- Optional: small integrity check to ensure overlay JSON has expected keys when present
-- (keeps migrations non-strict; remove or tighten if you want stricter validation)
ALTER TABLE visual_overlays
    ADD CONSTRAINT visual_overlays_overlay_keys_check
    CHECK (overlay_data ? 'label' AND overlay_data ? 'box')
    NOT VALID;

-- NOTE:
-- - doc_id values should match Paperless-NGX document IDs for proper cross-referencing.
-- - No FK constraint means orphaned overlays won't auto-delete; use deleteByDocId() when documents are removed.
-- - If your Tomoro indexer uses a different ID format (for example including prefixes or different separators),
--   adjust the expression index above accordingly (or add a dedicated `tomoro_doc_id` column).

-- End of migration
