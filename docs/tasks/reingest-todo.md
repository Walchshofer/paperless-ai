# Reingest & E2E TODO

Priority: High → Low

1. Validate Qdrant Collections (Low)
   - Command: `docker-compose up -d qdrant && curl -fsS http://localhost:6333/collections | jq '.'`
   - Verify: `document_embeddings`, `visual_pages`, `visual_overlays` exist with correct distances and sizes.
   - Files: `services/visual-rag-client/QdrantAdapter.js`, `docs/QDRANT_MIGRATION.md`

2. Single-Doc Reingest Manual (Low)
   - Command: `node test/manual/test-visual-rag-ingestion.js <DOC_ID>` or POST `/api/visual-rag/batch/start` with `ids:[<DOC_ID>]`
   - Verify: Qdrant point(s) upserted; `visual_overlays.vector_id` in Postgres populated.

3. Add Single-Doc E2E Test (Medium)
   - Create: `test/e2e/reingest-verify.spec.js`
   - Steps: trigger single-doc reingest; wait for completion; assert Qdrant point_count > 0 and `SELECT count(vector_id) > 0` in Postgres for doc_id; cleanup.
   - Expected runtime: 10–20 minutes to implement + local run.

4. CI Health Check for Collections (Low)
   - Add a lightweight startup health check in test setup that validates collection presence and correct distance metric.
   - Files: `test/setup-env.js`, GitHub Actions workflow for integration tests.

5. Improve Reingest Scripts (Medium)
   - Add `--doc-id`, `--dry-run`, and checkpointing to `scripts/reingest_to_qdrant.js` and `containers/text-rag/reingest-text-embeddings.py`.

6. Documentation Sync & Guardrails (Low)
   - Add explicit note to `docs/EXPERT_PIPELINE_DECISION_TABLE.md` referencing collection separation and SOT ownership.
   - Ensure `.github/architecture/pipeline-contract.md` exists or add pointer (Repo guardrail).

---

Assign owners and estimate times in next planning session. Save this file as the canonical task list for the small reingest experiment.