# RAG Systems Reference

## Purpose
- Quick reference for Retrieval-Augmented Generation (RAG) and Visual RAG systems used across paperless-ai.
- Intended audience: engineers extending or integrating RAG (visual or text) providers.

## Key concepts
- **RAG**: combines retrieval (embeddings/index) + generation (LLM).
- **Visual RAG**: adds image-based retrieval & vision-model passes before or alongside textual RAG.
- **Guidance vs PromptRegistry**: PromptRegistry is authoritative; Guidance is an optional optimization. Always preserve fallback semantics and include a valid fallback mapping to PromptRegistry for Guidance templates.

---

## RAG systems & API contracts (quick reference)

| RAG System | Purpose | Key files / API contract |
|---|---|---|
| **Visual RAG Sidecar** 🔎 | Page-level element detection & visual indexing (tables, figures, zones) | `services/visual-rag-sidecar/main.py` — FastAPI endpoints: `/health`, `/index/document`, `/index/directory`, `/search`. Pydantic models: `IndexRequest`, `SearchRequest`, `SearchResponse`. Postgres overlays: `visual_overlays.embedding vector(320)` via `services/visual-rag/VisualOverlayRepository.js`. |
| **Ollama Visual / Visual OCR** 🖼️ | Vision-model-based OCR, geometry, overlay extraction (e.g., `qwen3-vl`) | `services/ollama/vision.js` (planner, rendering, `_callOllamaVisionAPI`, truncation+repair), `services/experts/ParallelOcrExecutor.js` (visual OCR track), `services/experts/normalization/PreVisionNormalizer.js` (geometry). Internal function contract: `ollamaService._callOllamaVisionAPI(prompt, images, options)` |
| **Python Text RAG (RAGZ)** 📚 | Text semantic search / QA (Postgres + `pgvector`) | `rag_service/app.py`, `rag_service/models.py` — endpoints: `/search`, `/context`. RAGZ stores text vectors in `document_embeddings.embedding vector(384)` via `rag_service/data_manager.py`. |
| **Internal Domain RAGs** 🗂️ | Local corpus retrievers (VAT, legal) used to augment prompts | `services/rag/InternalVatRag.js`, `services/rag/InternalLegalRag.js` — internal JS APIs (not HTTP) |

> See `docs/EXPERT_PIPELINE_DECISION_TABLE.md` for pipeline stage gating and retry semantics.

---

## Integration & pipeline points
- Typical pipeline stages that interact with RAG:
  - Visual OCR / Visual RAG (post-normalization / OCR)
  - Extraction / Reasoning (when contextual retrieval is needed)
  - Validation (RAG outputs may be validated/repaired)

- **Headers, caching, and propagation**
  - Always propagate `X-Request-Id` on cross-service calls.
  - Support `X-Cache-Namespace` header for isolation.
  - Cache keys must be deterministic and include namespace for multi-tenant isolation.

---

## Service Separation and Vector Columns (Required)

Visual RAG and RAGZ are separate services with separate vector storage:

| Service | Table | Column | Vector size | Index |
| --- | --- | --- | --- | --- |
| Visual RAG overlays | `visual_overlays` | `embedding` | `vector(320)` | HNSW + IVFFLAT |
| RAGZ text retrieval | `document_embeddings` | `embedding` | `vector(384)` | IVFFLAT |

Do not share vector columns or indexes across these services. Each service owns
its own schema and lifecycle.

---

## Visual Summary Metadata (Required)

Visual summary text must be preserved as metadata even when bounding boxes are
generated later. Store summaries in `visual_overlays` as part of the
`expert_metadata` payload (semantic_label `expert_knowledge`, page_number `0`).
Overlay boxes can be appended in later stages without replacing the summary
metadata.

---

## RAGZ Health Check (Required)

RAGZ must expose a `/health` endpoint that validates:
- PostgreSQL connectivity
- pgvector extension availability
- `document_embeddings` table readiness

---

## V2 Storage Schema (Planned)

Additive schema for Visual-first RAG:

```
documents(id, source, original_filename, mime_type, created_at, checksum_sha256,
  doc_type, tags[], storage_path, extracted_fields jsonb)

document_pages(id, document_id, page_number, width_px, height_px,
  image_uri, thumb_uri, ocr_text, text_layer, normalization jsonb)

text_chunks(id, document_id, page_id, chunk_index, content, span jsonb,
  embedding vector(384))

visual_pages(id, document_id, page_id, embedding vector(320), visual_meta jsonb)

visual_regions(id, document_id, page_id, bbox jsonb, label, score,
  embedding vector(320), meta jsonb)

document_actions(id, document_id, action_type, payload jsonb, status,
  confidence, evidence_refs jsonb, created_at, executed_at)
```

---

## Retrieval Queries (Visual-first)

Visual-first page retrieval:
```
SELECT vp.page_id, vp.document_id,
       1 - (vp.embedding <=> :query_embedding) AS score
FROM visual_pages vp
ORDER BY vp.embedding <=> :query_embedding
LIMIT :k;
```

Hybrid fallback (visual narrows, text validates):
```
SELECT tc.id, tc.document_id, tc.page_id,
       1 - (tc.embedding <=> :query_embedding) AS score
FROM text_chunks tc
WHERE tc.document_id = ANY(:candidate_docs)
ORDER BY tc.embedding <=> :query_embedding
LIMIT :k;
```

---

## Fallbacks & contracts
- **Authority**: `PromptRegistry` remains the source of truth for prompts and schemas.
- **Fallback chain**: Guidance (optional) → PromptRegistry → `JsonRepair`.
- **Prompt safety**: Preserve required schema fields and evidence constraints. Any prompt change must include tests and a PR note explaining behavioral impact.

---

## Ollama Visual — Integration summary & recommended enhancements

**Current state**
- Vision pipeline present in `services/ollama/vision.js` (planner, rendering, extraction, `_callOllamaVisionAPI`, truncation handling, JSON repair fallback).
- Parallel OCR orchestrated in `services/experts/ParallelOcrExecutor.js` (visual track uses Ollama), pre-normalization handled by `PreVisionNormalizer`.

**Recommended enhancements (priority order)**
1. Reliability: add retry/backoff + error classification for `_callOllamaVisionAPI` and emit clear telemetry reason codes (e.g., `vision_timeout`, `vision_model_unavailable`).
2. Profiles & prompts: map document profiles → model & guidance templates (e.g., `config.ollama.modelsByProfile`) and keep templates in `guidance_service/templates/`.
3. Structured outputs: define JSON schemas per profile and validate results; on validation failures, run `JsonRepairService`.
4. Caching: implement a content-addressed cache keyed by image hash + model + profile; honor `X-Cache-Namespace`.
5. Batching & streaming: support multi-page batch calls and streaming for large outputs, detect truncation early and repair accordingly.
6. Observability: add metrics (`vision_latency`, `vision_truncations`, `vision_cache_hit`) and Grafana panels; add a `VISION_RUNBOOK.md` with runbook steps.

---

## Schema evolution proposal (vision extraction)

**New table**: `vision_extractions` **(additive, backwards-compatible)**
- Columns: `id UUID`, `document_id VARCHAR(50) REFERENCES documents(document_id)`, `schema_version INT DEFAULT 1`, `profile VARCHAR(50)`, `model_name VARCHAR(100)`, `extracted_text TEXT`, `pages JSONB`, `metadata JSONB`, `status VARCHAR(20)`, `created_at`, `updated_at`.

**Per-page JSON shape (example)**
```json
{
  "page_number": 1,
  "text": "...",
  "confidence": 0.92,
  "has_table": true,
  "boxes": [{"xmin":10,"ymin":20,"xmax":200,"ymax":300,"type":"table","confidence":0.95}]
}
```

**SQL (example migration)**
```sql
CREATE TABLE vision_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id VARCHAR(50) NOT NULL REFERENCES documents(document_id),
  schema_version INT NOT NULL DEFAULT 1,
  profile VARCHAR(50),
  model_name VARCHAR(100),
  extracted_text TEXT,
  pages JSONB,
  metadata JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
CREATE INDEX idx_vision_pages_gin ON vision_extractions USING GIN(pages);
```

---

## Migration & re-ingest strategy (recommended)
- **Approach**: Re-ingest all documents end-to-end into the new `vision_extractions` table (do not reuse legacy embeddings; re-embed with the new model).
- **Steps**:
  1. Deploy migration SQL to create `vision_extractions` with feature flag disabled.
  2. Implement `scripts/reingest_documents.js` (idempotent, batched, `--dry-run`, `--verify`).
  3. Run in staging; perform parity checks (per-profile samples); fix issues.
  4. Canary re-ingest a subset in production; monitor metrics & sample quality.
  5. Flip feature flag to enable global reads/writes; deprecate legacy flow once validated.

**Verification**:
- Document counts vs completed `vision_extractions`.
- Sample extraction quality checks per profile.
- Search parity (where relevant).

---

## Tests & validation matrix
- **Unit tests**: retry/backoff, cache hit/miss, schema validation, `JsonRepairService` fallback.
- **Integration tests**: reingest smoke run (staged subset), end-to-end extraction persistence.
- **Contract tests**: Visual sidecar and Ollama function call contracts.

---

## Telemetry & observability
- Events: `vision_reingest.batch.start/complete`, `vision_extraction.created/validated/failed`, `vision_extraction.validation_error`.
- Metrics: `vision_reingested_documents_total`, `vision_extraction_failures_total`, `vision_extract_latency_ms`, `vision_pages_per_document_avg`.
- Alerts: high failure rate or large fraction in `status='failed'`.

---

## Tests & PR checklist (doc-first)
- Update docs first (doc-first rule).
- Add/update unit tests (Mocha + Node assert) where behavior changes.
- Add telemetry for request-id propagation and fallback reasons.
- Map PR checklist back to `docs/EXPERT_PIPELINE_DECISION_TABLE.md` (stage, retry scope).
- Preserve Guidance → PromptRegistry → JsonRepair fallback for any prompt changes.

---

## File-by-file plan (recommended PRs)
- Add: `migrations/XXXX_create_vision_extractions.sql`
- Add: `scripts/reingest_documents.js` (CLI with `--dry-run`/`--verify`)
- Add: `services/visionCache.js` and hook into `services/ollama/vision.js` and `services/experts/ParallelOcrExecutor.js`
- Update: `services/ollama/vision.js` (retry/backoff, cache, per-profile model selection, metrics)
- Update: `services/experts/ParallelOcrExecutor.js` (reference cache & config)
- Add tests: `test/unit/vision.retry.test.js`, `test/unit/vision.cache.test.js`, `test/integration/vision_reingest.test.js`
- Add docs: `docs/VISION_RUNBOOK.md`

---

## Next steps
Pick an implementation starting point (recommended):
1. PR #1 — retry/backoff + metrics + unit tests (small, high-impact)
2. PR #2 — caching + tests + integration with OCR executor
3. PR #3 — migrations + reingest script + integration tests

---

## Authoritative references
- `docs/EXPERT_PIPELINE_DECISION_TABLE.md`
- `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`
- `docs/SCHEMA_EVOLUTION_GUIDE.md`
- `.github/knowledge/guidance-expert/references/litellm-ollama.md`
- `.github/knowledge/guidance-expert/references/postgresql-pgvector.md`


---

*Document generated from an audit of code, tests and guidance knowledge artifacts. Follow doc-first rules when implementing.*

---

## Sidecar embedding model upgrade: tomoro-colqwen3-embed-8b

- Summary: We are upgrading the sidecar embedding model from `colqwen2-v1.0` to `tomoro-colqwen3-embed-8b`. This model provides approximately 13x storage efficiency for embeddings, enabling denser indexes and lower storage costs.
- Compatibility & migration:
  - New embeddings are not byte-compatible with the old index. We recommend a planned re-ingest of documents to refresh vectors with `tomoro-colqwen3-embed-8b`.
  - Migration steps (high level):
    1. Tag existing indexes as `archive/colqwen2-*` and keep them as a rollback snapshot.
    2. Confirm the Visual RAG sidecar is locked to `TomoroAI/tomoro-colqwen3-embed-8b`. Do not set `VISUAL_RAG_MODEL=vidore/colqwen2-v1.0` (startup will fail).
    3. Re-ingest documents in batches (run `node scripts/migrate_visual_rag_colqwen3.js --doc-ids 1,2,3` first, then full migration).
    4. Monitor telemetry reason codes (`sidecar_upgrade`, `sidecar_migration`) and fallback metrics.
  - If re-ingest is infeasible, consider a phased approach: re-ingest high-value docs first and keep the old index referenced as a fallback during the transition.
- Schema & vision:
  - Ensure `vision_extractions` schema continues to carry `embedding_model` metadata so we can detect which vectors need re-ingestion.
  - Update any Ollama Visual adapters to propagate the `X-Request-Id` and include the `embedding_model` field in telemetry events.
- Observability & rollback:
  - Add telemetry counters for `sidecar_upgrade_attempt`, `sidecar_upgrade_success`, and `sidecar_upgrade_failure`.
  - Log a clear fallback reason when queries hit mixed-embedding indexes (e.g., `fallback_reason: mixed_embedding_models`).
- Tests & PR checklist:
  - Update docs to mention the new model and migration guidance.
  - Add unit test asserting docs include `tomoro-colqwen3-embed-8b`, `13x`, and migration/re-ingest guidance.
  - Validate end-to-end ingestion with new model in a staging run before production cutover.
  - Map this change back to `docs/EXPERT_PIPELINE_DECISION_TABLE.md` under "Embedding model changes" gate and follow existing retry/validation policies.

