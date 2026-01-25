# Migration 04 Quick Reference Card

## One-Command Summary
```bash
# Verify → Dry-Run → Execute → Verify → Re-ingest → Test
node scripts/verify_visual_overlays_schema.js && \
node migrations/04_change_embeddings_to_320.js --dry-run && \
node migrations/04_change_embeddings_to_320.js && \
node scripts/verify_visual_overlays_schema.js && \
node scripts/migrate_visual_rag_colqwen3.js && \
npm run test:integration
```

---

## Step-by-Step Commands

### 1. Check Current State
```bash
node scripts/verify_visual_overlays_schema.js
```
**Look for**: "✗ INCORRECT: embedding is vector(768)"

### 2. Dry Run
```bash
node migrations/04_change_embeddings_to_320.js --dry-run
```
**Look for**: "DRY RUN MODE: No changes will be committed"

### 3. Execute Migration
```bash
node migrations/04_change_embeddings_to_320.js
```
**Look for**: "Done. Note: Existing embeddings are preserved as backups"

### 4. Verify Migration
```bash
node scripts/verify_visual_overlays_schema.js
```
**Look for**: "✓ CORRECT: embedding is vector(320)"

### 5. Re-ingest with ColQwen3
```bash
node scripts/migrate_visual_rag_colqwen3.js
```
**Look for**: Successful re-embedding of all documents

### 6. Run Tests
```bash
npm run test:integration
```
**Look for**: All tests passing

### 7. Final Validation
```bash
node scripts/check_pgvector.js
```
**Look for**: "ensureEnhancedSchema: true"

---

## Quick Rollback (If Needed)
```sql
psql -U elfman -d paperless -c "
BEGIN;
DROP INDEX IF EXISTS idx_visual_overlays_embedding_ivfflat;
DROP INDEX IF EXISTS idx_visual_overlays_embedding;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE visual_overlays RENAME COLUMN embedding_legacy_backup TO embedding;
CREATE INDEX idx_visual_overlays_embedding ON visual_overlays USING hnsw (embedding vector_cosine_ops);
COMMIT;
"
```

---

## Files Created

| File | Purpose |
|------|---------|
| `scripts/verify_visual_overlays_schema.js` | Check schema before/after migration |
| `MIGRATION_04_IMPLEMENTATION_PLAN.md` | Full migration documentation |
| `SCHEMA_VERIFICATION_REPORT.md` | Investigation findings and analysis |
| `MIGRATION_04_QUICK_REFERENCE.md` | This quick reference card |

---

## Expected Timeline

| Phase | Duration | Can Run Async? |
|-------|----------|----------------|
| Verification | 1 min | No |
| Dry-run | 1 min | No |
| Migration | 2-5 min | No |
| Re-verification | 1 min | No |
| Re-ingestion | Variable (depends on doc count) | Yes |
| Testing | 5-15 min | No |

**Total Critical Path**: ~10 minutes (excluding re-ingestion)

---

## Success Indicators

### Before Migration
```
✗ INCORRECT: embedding is vector(768) - should be 320 for ColQwen3
```

### After Migration
```
✓ CORRECT: embedding is vector(320) - matches ColQwen3 spec
✓ FOUND: Legacy backup columns from migration 04
```

### After Re-ingestion
```
ensureEnhancedSchema: true
isAvailable: true
```

---

## Troubleshooting

### Migration Fails
**Check**: Error message in console
**Action**: Transaction auto-rolled back, safe to retry
**Common Issues**:
- Database connection failed → Check `data/runtime.env` credentials
- Permission denied → Check PostgreSQL user privileges
- Extension not found → Run `CREATE EXTENSION vector;`

### Wrong Dimension After Migration
**Check**: `node scripts/verify_visual_overlays_schema.js`
**Action**: Re-run migration (idempotent)

### Re-ingestion Fails
**Check**: ColQwen3 model availability
**Action**: Verify visual-rag service is running
**Fallback**: Can run later, migration already complete

### Tests Fail
**Check**: Error messages in test output
**Action**: Verify vector dimension is correct
**Rollback**: Use SQL rollback command if needed

---

## Environment Requirements

### Required Variables (in data/runtime.env or docker-compose.env)
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=paperless
POSTGRES_USER=elfman
POSTGRES_PASSWORD=<your_password>
```

### Optional Variables
```env
VISUAL_RAG_URL=http://visual-rag:8001
OLLAMA_API_URL=http://host.docker.internal:11434
```

---

## Safety Notes

- ✅ Migration uses transactions (auto-rollback on failure)
- ✅ Original data preserved in backup columns
- ✅ Idempotent (safe to run multiple times)
- ✅ Dry-run mode available
- ✅ Verification scripts validate state
- ✅ Rollback script ready if needed
- ⚠️ Re-ingestion required to populate new embeddings
- ⚠️ Visual RAG queries return empty until re-ingestion completes

---

## Post-Migration Cleanup (Optional, Week 4+)

```sql
-- After verifying 320-d embeddings work correctly for 30+ days
BEGIN;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_legacy_backup;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_vector_legacy_backup;
ALTER TABLE visual_overlays DROP COLUMN IF EXISTS embedding_jsonb_backup;
COMMIT;
```

---

## Contact / References

- **Full Plan**: `MIGRATION_04_IMPLEMENTATION_PLAN.md`
- **Investigation Report**: `SCHEMA_VERIFICATION_REPORT.md`
- **Migration File**: `migrations/04_change_embeddings_to_320.js`
- **Repository Code**: `services/visual-rag/VisualOverlayRepository.js`
- **Documentation**: `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md`
