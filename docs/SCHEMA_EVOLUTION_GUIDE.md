### 📄 Final content (copy & paste verbatim)


# Schema Evolution Guide

This document governs how schemas may evolve in the paperless-ai system.

Schemas are shared contracts across services. Changes must be deliberate,  
compatible, and auditable.

This document is authoritative and must be followed for any schema change.

---

## Covered Schemas

This guide applies to changes in:

- SYS_ROUTER_V1 output  
- ValidationEngine output  
- PromptRegistry output schemas  
- Guidance template variables and outputs  
- Visual RAG overlay schemas  
- Pipeline `primary_output` structures  
- Paperless PATCH payloads

---

## Core Rules

1. **No breaking changes by default**  
2. **Additive changes are preferred**  
3. **Absence-tolerant consumers are mandatory**  
4. **Feature flags before behavior changes**  
5. **Rollback must be possible**

If a change violates any rule above, it must be versioned explicitly.

---

## Versioning Strategy

### Allowed (Preferred)
- Add new optional fields  
- Extend objects with backward-compatible data  
- Dual-read logic

### Required (If Breaking)
- Schema version field (e.g. `schema_version`)  
- Parallel V1 / V2 fields  
- Feature-flagged rollout

---

## Example: Router Page-Level Signals

**Current**

```json
{
  "primary_domain": "financial",
  "quality_assessment": {
    "needs_rotation": false
  }
}
```

**Future (Additive)**

```json
{
  "primary_domain": "financial",
  "quality_assessment": {
    "needs_rotation": false
  },
  "pages": [
    {
      "page_number": 1,
      "has_table": true,
      "confidence": 0.92
    }
  ]
}
```

Rules:

- `pages` must be optional  
- Executor must fall back to document-level logic if absent  
- Targeted OCR must be feature-flagged

---

## Guidance Template Evolution (V1 → V2)

- V2 templates may change internal schema  
- PromptRegistry fallback remains V1-compatible  
- Executor must not assume V2 presence  
- Validation must accept both outputs

---

## Validation Schema Changes

- Field-level confidence extensions are allowed  
- Page-level attribution requires schema versioning  
- Retry semantics must not change implicitly

---

## Visual RAG Schema Changes

- Overlays must remain evidence-only
- No extraction or OCR fields may be added
- Missing overlays must not fail pipelines

---

## Vector Column Dimension Changes (Breaking)

Changes to vector column dimensions are **breaking changes** and require careful migration planning.

### Why Vector Dimension Changes Are Breaking

- Vector dimensions are part of the type definition (`vector(N)`)
- Existing embeddings cannot be reused with a new dimension
- Indexes must be rebuilt for the new dimension
- Similarity search results are incompatible across dimensions

### Migration Pattern: 768-d to 320-d Example

This example shows the migration from ColQwen2 (768-d) to ColQwen3 (320-d) embeddings in the `visual_overlays` table.

#### Phase 1: Schema Migration

**File:** `migrations/04_change_embeddings_to_320.js`

```javascript
// Migration: Change embedding dimension from 768 to 320
exports.up = async (db) => {
  await db.query(`
    -- Drop existing indexes
    DROP INDEX IF EXISTS idx_visual_overlays_embedding_hnsw;
    DROP INDEX IF EXISTS idx_visual_overlays_embedding_ivfflat;

    -- Drop and recreate column with new dimension
    ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding;
    ALTER TABLE visual_overlays ADD COLUMN embedding vector(320);

    -- Recreate indexes for new dimension
    CREATE INDEX idx_visual_overlays_embedding_hnsw
      ON visual_overlays USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX idx_visual_overlays_embedding_ivfflat
      ON visual_overlays USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
  `);
};

exports.down = async (db) => {
  await db.query(`
    -- Rollback to 768 dimensions
    DROP INDEX IF EXISTS idx_visual_overlays_embedding_hnsw;
    DROP INDEX IF EXISTS idx_visual_overlays_embedding_ivfflat;

    ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding;
    ALTER TABLE visual_overlays ADD COLUMN embedding vector(768);

    CREATE INDEX idx_visual_overlays_embedding_hnsw
      ON visual_overlays USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX idx_visual_overlays_embedding_ivfflat
      ON visual_overlays USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
  `);
};
```

#### Phase 2: Data Re-indexing

After schema migration, **all documents must be re-indexed** with the new model:

```bash
# Re-index all documents with new 320-d embeddings
node scripts/reingest_visual_overlays.js --all

# Or re-index specific documents
node scripts/reingest_visual_overlays.js --doc-ids 1,2,3
```

#### Phase 3: Verification

```sql
-- Verify column dimension
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_name = 'visual_overlays' AND column_name = 'embedding';
-- Expected: embedding | vector (with dimension 320)

-- Verify index presence
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'visual_overlays' AND indexname LIKE '%embedding%';
-- Expected: idx_visual_overlays_embedding_hnsw, idx_visual_overlays_embedding_ivfflat

-- Check embedding dimensions in stored data
SELECT
  id,
  array_length(embedding::real[], 1) as dimension,
  document_id
FROM visual_overlays
WHERE embedding IS NOT NULL
LIMIT 10;
-- Expected: All rows show dimension = 320
```

### Rollback Procedure

If rollback is needed after dimension change:

1. **Stop all services** that write to the affected table
2. **Run rollback migration** (`exports.down` function)
3. **Restore from backup** or re-index with original model
4. **Verify data integrity** before resuming service

**Critical:** You **cannot** rollback dimension changes without losing existing embeddings. Always maintain a backup before migration.

### Runtime Adaptation (Temporary)

For gradual migrations, runtime dimension adaptation can be used:

- Detect incoming embedding dimension
- Pad (zeros) or truncate to match schema dimension
- Emit `embedding_dimension_adapted` metric
- **This is a temporary workaround** and should not be used in steady state

See `docs/RAG_SYSTEMS_REFERENCE.md` for runtime adaptation monitoring.

---

## Required Process for Schema Changes

1. Update this document (or relevant section)  
2. Update `EXPERT_PIPELINE_DECISION_TABLE.md`  
3. Add or update tests  
4. Add migration / rollback notes  
5. Use the Schema Evolution Agent for implementation

---

## Non-Negotiable Guarantees

- Consumers must tolerate missing fields  
- Producers must not assume new fields are used  
- All schema changes must be documented
