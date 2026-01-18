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
| **Visual RAG Sidecar** 🔎 | Page-level element detection & visual indexing (tables, figures, zones) | `containers/visual-rag/main.py` — FastAPI endpoints: `/health`, `/index/document`, `/index/directory`, `/search`. Pydantic models: `IndexRequest`, `SearchRequest`, `SearchResponse`. **Qdrant**: `visual_pages` collection (320D, Dot) via `containers/text-rag/qdrant_adapter.py`. |
| **Ollama Visual / Visual OCR** 🖼️ | Vision-model-based OCR, geometry, overlay extraction (e.g., `qwen3-vl`) | `services/ollama/vision.js` (planner, rendering, `_callOllamaVisionAPI`, truncation+repair), `services/experts/ParallelOcrExecutor.js` (visual OCR track), `services/experts/normalization/PreVisionNormalizer.js` (geometry). Internal function contract: `ollamaService._callOllamaVisionAPI(prompt, images, options)` |
| **Text RAG Service** 📚 | Text semantic search / QA via **Qdrant** | `containers/text-rag/app.py`, `containers/text-rag/models.py` — endpoints: `/search`, `/context`, `/health`. Text RAG stores text vectors in **Qdrant** `document_embeddings` collection (384D, Cosine) via `containers/text-rag/qdrant_adapter.py`. |
| **Visual Overlay Repository** 🗂️ | Visual overlay embeddings for JS services | `services/visual-rag-client/VisualOverlayRepository.js`, `services/visual-rag-client/QdrantAdapter.js`. **Qdrant**: `visual_overlays` collection (320D, Cosine). PostgreSQL retains metadata only. |
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

## Service Separation and Vector Storage (Required)

Visual RAG and RAGZ are separate services with separate vector storage in **Qdrant**:

| Service | Qdrant Collection | Vector Size | Distance Metric | Adapter |
| --- | --- | --- | --- | --- |
| Visual RAG overlays | `visual_overlays` | 320 | Cosine | `services/visual-rag-client/QdrantAdapter.js` |
| Visual RAG pages | `visual_pages` | 320 | Dot | `containers/text-rag/qdrant_adapter.py` |
| Text RAG retrieval | `document_embeddings` | 384 | Cosine | `containers/text-rag/qdrant_adapter.py` |

Do not share collections across these services. Each service owns its own collection and lifecycle.

**PostgreSQL Role**: PostgreSQL is retained for metadata storage only (document info, overlay metadata, feedback events). All vector operations use Qdrant.

### Runtime Dimension Adaptation (Temporary Workaround)

The Visual RAG sidecar includes runtime dimension adaptation logic to handle embeddings that don't match the configured schema dimension. This is a **temporary workaround** to maintain backward compatibility during migration periods.

**Expected State:**
- `embedding_dimension_adapted` metric should be **0** in steady state
- All new embeddings should be 320-dimensional (matching `TomoroAI/tomoro-colqwen3-embed-8b`)
- No padding or truncation should occur during normal operation

**Action Required if `embedding_dimension_adapted` > 0:**
1. Check Visual RAG sidecar logs for dimension mismatch warnings
2. Verify `VISUAL_RAG_MODEL=TomoroAI/tomoro-colqwen3-embed-8b` is set correctly
3. Confirm Qdrant collections are 320D with correct distances (run `node scripts/check-qdrant-collections.js`)
4. Re-index affected documents to replace legacy embeddings
5. Monitor metric until it returns to 0

**Migration Context:**
- Legacy ColQwen2 embeddings were 768-dimensional
- Current ColQwen3 embeddings are 320-dimensional
- Qdrant is the vector SOT; PostgreSQL has no vector columns

---

## Visual Summary Metadata (Required)

Visual summary text must be preserved as metadata even when bounding boxes are
generated later. Store summaries in `visual_overlays` as part of the
`expert_metadata` payload (semantic_label `expert_knowledge`, page_number `0`).
Overlay boxes can be appended in later stages without replacing the summary
metadata.

---

## Text RAG Health Check (Required)

Text RAG must expose a `/health` endpoint that validates:
- Qdrant connectivity (`QDRANT_HOST:QDRANT_PORT`)
- `document_embeddings` collection exists and is ready
- Collection schema matches expected dimensions (384D, Cosine)

Health check example:
```python
from containers.text_rag.qdrant_adapter import qdrant_adapter

health = qdrant_adapter.health_check()
# Returns: { "healthy": true, "collections": { "document_embeddings": { "exists": true, "pointCount": 1234 } } }
```

---

## V2 Storage Schema (Qdrant + PostgreSQL)

Hybrid storage for Visual-first RAG using Qdrant for vectors and PostgreSQL for metadata:

### Qdrant Collections (Vector Storage)

| Collection | Dimensions | Distance | Purpose |
|------------|------------|----------|---------|
| `document_embeddings` | 384 | Cosine | Text RAG chunk embeddings |
| `visual_overlays` | 320 | Cosine | Visual overlay embeddings (JS) |
| `visual_pages` | 320 | Dot | Visual page embeddings (Python sidecar) |

### PostgreSQL Tables (Metadata Only)

```
documents(id, source, original_filename, mime_type, created_at, checksum_sha256,
  doc_type, tags[], storage_path, extracted_fields jsonb)

document_pages(id, document_id, page_number, width_px, height_px,
  image_uri, thumb_uri, ocr_text, text_layer, normalization jsonb)

visual_overlays(id, doc_id, page_number, overlay_data jsonb, semantic_label,
  enhanced_ocr_text, expert_metadata jsonb, domain_signals jsonb, created_at)
  -- Note: embedding column removed; vectors stored in Qdrant

document_actions(id, document_id, action_type, payload jsonb, status,
  confidence, evidence_refs jsonb, created_at, executed_at)
```

---

## Retrieval Queries (Visual-first) - Qdrant

Visual-first page retrieval using Qdrant:
```python
from qdrant_client import QdrantClient

client = QdrantClient(host="qdrant", port=6333)

# Visual page search (320D, Dot product)
results = client.search(
    collection_name="visual_pages",
    query_vector=query_embedding,  # 320D vector
    limit=k,
    with_payload=True
)
# Returns: [ScoredPoint(id, score, payload={document_id, page_id, ...})]
```

Hybrid fallback (visual narrows, text validates):
```python
# Text chunk search with document filter (384D, Cosine)
results = client.search(
    collection_name="document_embeddings",
    query_vector=query_embedding,  # 384D vector
    query_filter=Filter(
        must=[FieldCondition(key="document_id", match=MatchAny(any=candidate_docs))]
    ),
    limit=k,
    with_payload=True
)
```

JavaScript equivalent (using QdrantAdapter):
```javascript
const { qdrantAdapter } = require('./services/visual-rag-client/QdrantAdapter');

// Visual overlay search
const results = await qdrantAdapter.searchVisualOverlays(queryVector, { limit: 5 });
// Returns: [{ id, score, docId, pageNumber, semanticLabel, ... }]
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
- `docs/QDRANT_MIGRATION.md` - Migration guide from pgVector to Qdrant
- `services/visual-rag-client/QdrantAdapter.js` - JavaScript Qdrant adapter
- `containers/text-rag/qdrant_adapter.py` - Python Qdrant adapter
- `.github/knowledge/guidance-expert/references/litellm-ollama.md`


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

