# Migration 04: Change visual_overlays embeddings to 320-d (ColQwen3)

**Status**: Ready for execution
**Date**: 2026-01-10
**Migration File**: `migrations/04_change_embeddings_to_320.js`

## Context

### Current State (Incorrect)
- `visual_overlays.embedding` column exists as `vector(768)` (wrong dimension)
- This was created during migrations 01-03 which migrated from JSONB to pgvector
- ColQwen3 model produces 320-dimensional vectors, not 768-d

### Target State (Correct)
- `visual_overlays.embedding` column should be `vector(320)`
- Matches ColQwen3 model output dimension
- Separate from text RAG which uses `document_embeddings` table with 384-d vectors

### Documentation Confirmation
- docs-agent verified this is the correct approach (Option 2: Alter existing column)
- Text RAG uses separate table, no conflict
- Migration already exists and is well-designed

## Migration Strategy

### What Migration 04 Does

1. **Drops old indexes** (if present):
   - `idx_visual_overlays_embedding_ivfflat`
   - `idx_visual_overlays_embedding`
   - `idx_visual_overlays_embedding_vector`

2. **Renames legacy columns** (preserves data):
   - `embedding` → `embedding_legacy_backup`
   - `embedding_vector` → `embedding_vector_legacy_backup`

3. **Creates new 320-d columns**:
   - `embedding vector(320) DEFAULT NULL`
   - `embedding_vector vector(320) DEFAULT NULL`

4. **Creates new indexes**:
   - HNSW index for low-latency similarity: `idx_visual_overlays_embedding`
   - IVFFLAT index for batch retrieval: `idx_visual_overlays_embedding_ivfflat`

5. **Bonus**: Creates `feedback_events` table (if not exists)

### Safety Features

- Transaction-based (BEGIN/COMMIT/ROLLBACK)
- Dry-run mode available: `node migrations/04_change_embeddings_to_320.js --dry-run`
- Preserves existing data in backup columns
- Uses `IF NOT EXISTS` / `IF EXISTS` for idempotency
- Does NOT attempt to convert existing vectors (correct approach - re-ingest instead)

## Dual Column Issue

### Historical Context
Migrations 01-03 used two columns:
1. `embedding` (JSONB) → renamed to `embedding_jsonb_backup` in migration 03
2. `embedding_vector` (vector(768)) → renamed to `embedding` in migration 03

Migration 04 creates BOTH new columns again:
- `embedding vector(320)` - **actively used by current code**
- `embedding_vector vector(320)` - **not used by current code**

### Current Code Analysis
- **VisualOverlayRepository.js** line 745: Schema defines `embedding vector(320)`
- **VisualOverlayRepository.js** lines 373, 450, 634: All queries use `embedding` column only
- **No code references** to `embedding_vector` in visual-rag service

### Recommendation
- Keep `embedding` column (actively used)
- `embedding_vector` can be dropped in a future cleanup migration after verifying 04 works
- For now, migration creates both for backward compatibility

## Pre-Migration Verification

### Run verification script:
```bash
node scripts/verify_visual_overlays_schema.js
```

### Expected Output (if migration needed):
```
✓ pgvector extension: v0.x.x
✓ visual_overlays table: EXISTS

=== Embedding Columns ===
  embedding: vector(768)

=== Embedding Indexes ===
  idx_visual_overlays_embedding
    CREATE INDEX idx_visual_overlays_embedding ON visual_overlays USING hnsw (embedding vector_cosine_ops)

=== Analysis ===
✗ INCORRECT: embedding is vector(768) - should be 320 for ColQwen3

  ACTION REQUIRED: Run migration to convert to 320-d
  Command: node migrations/04_change_embeddings_to_320.js
```

## Migration Execution

### Step 1: Dry Run
```bash
cd C:\Users\pwalc\MyApps\paperless-ai
node migrations/04_change_embeddings_to_320.js --dry-run
```

Expected output:
```
[Migration] Start: change visual_overlays embedding to vector(320)
[Migration] ⚠️  DRY RUN MODE: No changes will be committed.
[Migration] Dropping old embedding indexes (if present)...
[Migration] Renaming legacy embedding columns (if present)...
[Migration] Renamed `embedding` to `embedding_legacy_backup`
[Migration] Creating new 320-d vector columns...
[Migration] Creating new indexes for 320-d embeddings...
[Migration] Creating feedback_events table (if not exists)...
[Migration] feedback_events table ensured
[Migration] Done.
```

### Step 2: Execute Migration
```bash
node migrations/04_change_embeddings_to_320.js
```

Monitor for:
- Successful BEGIN/COMMIT
- No ROLLBACK triggered
- All indexes created
- feedback_events table created

### Step 3: Verify Migration
```bash
node scripts/verify_visual_overlays_schema.js
```

Expected output:
```
✓ CORRECT: embedding is vector(320) - matches ColQwen3 spec

✓ FOUND: Legacy backup columns from migration 04
  - embedding_legacy_backup (vector)
  - embedding_vector_legacy_backup (vector)
  These can be dropped after verifying new 320-d embeddings work correctly.
```

## Post-Migration Steps

### Step 4: Re-ingest Documents
```bash
node scripts/migrate_visual_rag_colqwen3.js
```

This script will:
- Re-embed all documents with ColQwen3 model (320-d vectors)
- Populate new `embedding` column
- Build HNSW and IVFFLAT indexes

### Step 5: Validate Schema Again
```bash
node scripts/check_pgvector.js
```

Expected output:
```
Checking repository availability...
isAvailable: true
Checking pg_vector extension...
pgvector: { ... }
Ensuring enhanced schema (may log errors):
ensureEnhancedSchema: true
```

### Step 6: Run Integration Tests
```bash
npm run test:integration
```

Verify:
- Visual RAG queries work correctly
- Embedding similarity search returns results
- No errors related to vector dimensions

## Rollback Strategy

### If Migration Fails Mid-Execution
Transaction will auto-ROLLBACK. Schema remains unchanged.

### If Migration Succeeds But Causes Issues
Manual rollback:

```sql
BEGIN;

-- Drop new indexes
DROP INDEX IF EXISTS idx_visual_overlays_embedding_ivfflat;
DROP INDEX IF EXISTS idx_visual_overlays_embedding;

-- Drop new columns
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector;

-- Restore legacy columns
ALTER TABLE visual_overlays RENAME COLUMN embedding_legacy_backup TO embedding;
ALTER TABLE visual_overlays RENAME COLUMN embedding_vector_legacy_backup TO embedding_vector;

-- Recreate old indexes
CREATE INDEX idx_visual_overlays_embedding ON visual_overlays USING hnsw (embedding vector_cosine_ops);

COMMIT;
```

### After Successful Verification (Future Cleanup)

Once new 320-d embeddings are verified working:

```sql
-- Drop backup columns (optional, after 30+ days of successful operation)
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_legacy_backup;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector_legacy_backup;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_jsonb_backup;

-- Drop unused embedding_vector column (created by migration 04 but not used)
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector;
```

## Environment Configuration

### Required Environment Variables
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=paperless
POSTGRES_USER=elfman
POSTGRES_PASSWORD=<your_password>
```

Or use docker-compose.env variables:
```env
PAPERLESS_DBHOST=localhost
PAPERLESS_DBPORT=5432
PAPERLESS_DBNAME=paperless
PAPERLESS_DBUSER=elfman
PAPERLESS_DBPASS=<your_password>
```

Migration loads from `data/.env` if present.

## Success Criteria

- [ ] Pre-migration verification shows vector(768) dimension
- [ ] Dry-run completes without errors
- [ ] Migration executes successfully with COMMIT
- [ ] Post-migration verification shows vector(320) dimension
- [ ] Legacy backup columns exist
- [ ] New HNSW and IVFFLAT indexes created
- [ ] feedback_events table created
- [ ] Re-ingestion script populates new embeddings
- [ ] Integration tests pass
- [ ] Visual RAG queries return correct results

## Timeline

1. **Now**: Run pre-migration verification
2. **Today**: Execute migration (5-10 minutes)
3. **Today**: Re-ingest documents (time depends on document count)
4. **Today**: Run integration tests
5. **Week 1**: Monitor production for issues
6. **Week 4+**: Consider cleanup of backup columns

## References

- Migration file: `migrations/04_change_embeddings_to_320.js`
- Verification script: `scripts/verify_visual_overlays_schema.js`
- Re-ingestion script: `scripts/migrate_visual_rag_colqwen3.js`
- Repository code: `services/visual-rag/VisualOverlayRepository.js`
- Documentation: `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md`
- Previous migrations: `migrations/01_add_embedding_vector_column.sql`, `migrations/02_migrate_embeddings.js`, `migrations/03_switch_columns.sql`
