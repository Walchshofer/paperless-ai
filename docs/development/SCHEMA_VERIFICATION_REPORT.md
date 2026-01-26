# Schema Verification Report: visual_overlays.embedding Dimension
**Date**: 2026-01-10
**Issue**: Incorrect vector dimension for ColQwen3 embeddings

---

## Executive Summary

**Current State**: `visual_overlays.embedding` is likely `vector(768)` (incorrect)
**Target State**: `visual_overlays.embedding` should be `vector(320)` (correct for ColQwen3)
**Solution**: Migration 04 already exists and is ready to execute
**Risk Level**: LOW (migration preserves data in backup columns with transaction safety)

---

## Investigation Findings

### 1. Migration File Review
**File**: `migrations/04_change_embeddings_to_320.js`

**Assessment**: EXCELLENT
- Well-designed with transaction safety (BEGIN/COMMIT/ROLLBACK)
- Preserves existing data in backup columns
- Idempotent (safe to run multiple times)
- Supports dry-run mode
- Creates both HNSW and IVFFLAT indexes
- Includes bonus: feedback_events table creation

**What it does**:
1. Drops old vector indexes
2. Renames `embedding` → `embedding_legacy_backup`
3. Renames `embedding_vector` → `embedding_vector_legacy_backup`
4. Creates new `embedding vector(320)` column
5. Creates new `embedding_vector vector(320)` column
6. Rebuilds HNSW and IVFFLAT indexes for 320-d vectors
7. Creates feedback_events table if not exists

**Note**: Does NOT attempt to convert existing vectors. Correct approach - requires re-ingestion with new model.

### 2. Schema State Analysis

#### Current Schema (Expected Before Migration)
```sql
-- From migrations 01-03 (historical):
visual_overlays {
  embedding: vector(768)  -- INCORRECT for ColQwen3
}
```

#### Historical Migration Path
- **Migration 01**: Added `embedding_vector vector(768)` column
- **Migration 02**: Converted JSONB embeddings to vector(768)
- **Migration 03**: Renamed columns:
  - `embedding` (JSONB) → `embedding_jsonb_backup`
  - `embedding_vector` → `embedding` (now the active column)
- **Migration 04**: Changes dimension 768 → 320

#### Target Schema (After Migration 04)
```sql
visual_overlays {
  embedding: vector(320),                         -- NEW, active
  embedding_vector: vector(320),                  -- NEW, unused
  embedding_legacy_backup: vector(768),           -- BACKUP from migration 04
  embedding_vector_legacy_backup: vector(768),    -- BACKUP from migration 04
  embedding_jsonb_backup: jsonb                   -- BACKUP from migration 03
}
```

### 3. Dual Column Investigation

**Question**: Why does migration 04 create TWO vector columns?

**Answer**: Historical artifact from migrations 01-03 pattern.

**Current Code Usage** (from `services/visual-rag/VisualOverlayRepository.js`):
```javascript
// Line 745: Schema definition
{ name: 'embedding', type: 'vector(320)' }

// Line 373: INSERT query
INSERT INTO visual_overlays (..., embedding) VALUES (..., $8)

// Line 450: Batch INSERT query
INSERT INTO visual_overlays (..., embedding) VALUES (..., $4)

// Line 634: Search query
1 - (embedding <=> $1::vector) as similarity

// Line 772-773: Index creation
CREATE INDEX idx_visual_overlays_embedding
ON visual_overlays USING hnsw (embedding vector_cosine_ops)
```

**Search Results**: ZERO references to `embedding_vector` in visual-rag service code.

**Conclusion**:
- **embedding** column: ACTIVELY USED
- **embedding_vector** column: NOT USED (can be dropped in future cleanup)

### 4. Text RAG Separation Confirmed

**Text RAG**: Uses `document_embeddings` table with 384-d vectors (separate system)
**Visual RAG**: Uses `visual_overlays` table with 320-d vectors (ColQwen3)

No conflict between systems. They operate independently.

---

## Verification Scripts Created

### Script 1: `scripts/verify_visual_overlays_schema.js`
**Purpose**: Check current schema state before/after migration
**Features**:
- Detects vector dimension (768 vs 320)
- Lists all embedding columns (including backups)
- Shows all embedding indexes
- Provides analysis and recommendations
- Exit codes: 0 (success), 1 (error)

**Usage**:
```bash
node scripts/verify_visual_overlays_schema.js
```

**Output Analysis**:
- ✓ CORRECT: embedding is vector(320) → Migration successful
- ✗ INCORRECT: embedding is vector(768) → Migration needed
- ⚠ FOUND: embedding_vector column → Can be dropped (not used)
- ✓ FOUND: Legacy backup columns → Safe to drop after verification period

---

## Implementation Plan Summary

### Phase 1: Pre-Migration (5 minutes)
1. Run `node scripts/verify_visual_overlays_schema.js`
2. Confirm current dimension is 768
3. Review dry-run output

### Phase 2: Migration (10 minutes)
1. Dry-run: `node migrations/04_change_embeddings_to_320.js --dry-run`
2. Execute: `node migrations/04_change_embeddings_to_320.js`
3. Verify: `node scripts/verify_visual_overlays_schema.js`

### Phase 3: Re-ingestion (Variable)
1. Run: `node scripts/migrate_visual_rag_colqwen3.js`
2. Populate new 320-d embeddings for all documents
3. Verify: `node scripts/check_pgvector.js`

### Phase 4: Testing (15 minutes)
1. Integration tests: `npm run test:integration`
2. Manual Visual RAG query test
3. Check vector similarity search results

### Phase 5: Monitoring (1-4 weeks)
1. Week 1: Monitor logs for vector dimension errors
2. Week 2: Verify Visual RAG accuracy
3. Week 4+: Consider cleanup of backup columns

---

## Rollback Strategy

### Automatic Rollback (If Migration Fails)
Transaction-based migration will auto-ROLLBACK on error. No manual action needed.

### Manual Rollback (If Issues Discovered Post-Migration)
```sql
BEGIN;
DROP INDEX IF EXISTS idx_visual_overlays_embedding_ivfflat;
DROP INDEX IF EXISTS idx_visual_overlays_embedding;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE visual_overlays RENAME COLUMN embedding_legacy_backup TO embedding;
ALTER TABLE visual_overlays RENAME COLUMN embedding_vector_legacy_backup TO embedding_vector;
CREATE INDEX idx_visual_overlays_embedding ON visual_overlays USING hnsw (embedding vector_cosine_ops);
COMMIT;
```

Time to rollback: < 5 minutes

---

## Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Migration fails mid-execution | LOW | LOW | Transaction auto-rollback |
| Data loss | NONE | NONE | Backup columns preserve original data |
| Downtime | MINIMAL | LOW | Migration runs in seconds; re-ingestion can be async |
| Wrong dimension | NONE | NONE | Verification scripts confirm before/after |
| Text RAG conflict | NONE | NONE | Separate tables (document_embeddings vs visual_overlays) |
| Production errors | LOW | LOW | Dry-run mode + verification scripts + rollback plan |

**Overall Risk**: LOW

---

## Recommendations

### Immediate Actions (Today)
1. ✅ Run verification script to confirm current state
2. ✅ Execute migration 04 (with dry-run first)
3. ✅ Run re-ingestion script to populate 320-d embeddings
4. ✅ Run integration tests

### Short-Term Actions (Week 1)
1. Monitor Visual RAG query logs for errors
2. Verify embedding similarity scores are reasonable
3. Check HNSW/IVFFLAT index performance

### Long-Term Actions (Week 4+)
1. Drop unused `embedding_vector` column
2. Drop backup columns after verification period:
   - `embedding_legacy_backup`
   - `embedding_vector_legacy_backup`
   - `embedding_jsonb_backup` (if still present)

### Future Cleanup Migration (Optional)
Create `migrations/05_cleanup_legacy_embeddings.sql`:
```sql
BEGIN;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_legacy_backup;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector_legacy_backup;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_jsonb_backup;
COMMIT;
```

---

## Documentation References

| Document | Path |
|----------|------|
| Migration 04 | `migrations/04_change_embeddings_to_320.js` |
| Verification Script | `scripts/verify_visual_overlays_schema.js` |
| Implementation Plan | `MIGRATION_04_IMPLEMENTATION_PLAN.md` |
| Repository Code | `services/visual-rag/VisualOverlayRepository.js` |
| ColQwen3 Architecture | `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` |
| RAG Systems Reference | `docs/RAG_SYSTEMS_REFERENCE.md` |
| Database Setup | `docs/DATABASE_SETUP.md` |

---

## Approval Checklist

- [x] Migration reviewed and assessed as safe
- [x] Verification scripts created
- [x] Implementation plan documented
- [x] Rollback strategy defined
- [x] Risk assessment completed
- [x] Documentation references provided
- [x] Dual column issue investigated and explained
- [x] Text RAG separation confirmed (no conflict)
- [ ] **USER APPROVAL REQUIRED TO PROCEED**

---

## Next Steps

**AWAITING USER CONFIRMATION** to proceed with:

1. Running pre-migration verification script
2. Executing migration 04 (dry-run first)
3. Re-ingesting documents with ColQwen3 (320-d)
4. Running integration tests
5. Monitoring results

**Estimated Total Time**: 30-60 minutes (excluding re-ingestion, which depends on document count)

---

## Questions for User

Before proceeding, please confirm:

1. **Database Access**: Do you have PostgreSQL credentials in `data/runtime.env` or docker-compose.env?
2. **Backup Status**: Do you have a recent database backup? (recommended but not required due to backup columns)
3. **Downtime Window**: Can Visual RAG service be temporarily unavailable during re-ingestion?
4. **Document Count**: Approximately how many documents need re-ingestion? (affects timeline)
5. **Approval**: Are you ready to proceed with migration execution?

---

**Report Prepared By**: Schema Evolution Agent
**Confidence Level**: HIGH (migration is well-designed and low-risk)
**Recommendation**: PROCEED with migration
