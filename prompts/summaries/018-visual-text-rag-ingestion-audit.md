# Visual + Text RAG Ingestion Audit — Initial Findings

[meta]
timestamp: 2026-01-25T00:00:00Z
agent: Optimize
stage: 010-docs
prompt_ref: prompts/KICKOFF.md

[summary]
Initial doc-first audit and runtime validation for ORIGINAL document ingestion paths for Text RAG and Visual RAG.

[findings]
- Docs reviewed (authoritative): `docs/QDRANT_MIGRATION.md`, `docs/EXPERT_PIPELINE_DECISION_TABLE.md`, `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md`, `docs/EXPERT_PIPELINE_FLOW.md`.
- Visual ingestion (ORIGINAL PDFs):
  - API: Visual RAG Sidecar `/index/pdf` (accepts base64 PDF), `/index/document` (accepts base64 images or pdf_path).
  - Processing: `containers/visual-rag/main.py` -> `_process_images()` -> computes ColQwen3 embeddings and upserts to Qdrant `visual_pages` (mean page vector + payload with `tensor_b64` and `page_count`).
  - Overlays: `OverlayExtractor` (Qwen3-VL) → `VisualOverlayRepository.saveOverlays()` stores metadata in PostgreSQL table `visual_overlays` (no embedding column) and uses `QdrantAdapter.upsertVisualOverlays()` to upsert overlay vectors to Qdrant collection `visual_overlays`.
  - Tools: `services/visual-rag-client/IngestionManager.ingestDocument()` is the dual-path ingestion orchestrator (visual index + overlay extraction).
  - Re-ingest triggers: manual `/index/pdf`, `scripts/reingest_to_qdrant.js`, `BatchIngestionJob`, DocumentProcessor when `ImageNormalizer` applies changes, and Paperless `reprocess` bulk_edit.

- Text ingestion (ORIGINALS → document-level embeddings):
  - `containers/text-rag/data_manager.py` fetches documents from Paperless API, computes sentence-transformer embeddings and upserts to Qdrant `document_embeddings` (384d, Cosine).
  - Re-ingest triggers: `ragService.indexDocuments()` → Text RAG `/indexing/start`, and migration scripts.

- Qdrant Collections & PG tables usage:
  - Qdrant SOT: `document_embeddings` (text), `visual_pages` (page-level), `visual_overlays` (overlays). Distance metric locks enforced in `QdrantAdapter.js`.
  - Postgres: `visual_overlays` stores metadata and `vector_id` (UUID) linking to Qdrant points; no pgvector columns are used for embeddings.

[evidence - e2e tests run]
- Attempted: Playwright e2e `test/e2e/reingest-verify.spec.ts` (Visual RAG reingest).  Result: FAILED due to missing infra in local environment; key log excerpts:

```
[e2e] Visual RAG sidecar host visual-rag not resolvable, trying fallback http://127.0.0.1:8001/health
[e2e] Docker available - attempting to start paperless_db via docker compose
no such service: paperless_db
[e2e] docker-compose start attempt failed: Command failed: docker-compose up -d paperless_db
FetchError: request to http://webserver:8000/api/documents/74/ failed, reason: getaddrinfo ENOTFOUND webserver
```

- Notes: Local test environment lacks resolvable `webserver` host and `paperless_db` docker service; tests are therefore skipped/failed in CI unless infra is provisioned.

[next]
- Run the Visual RAG reingest e2e test in an environment with `paperless-ngx`, `qdrant`, and `visual-rag` sidecar running; collect full Playwright report via `npx playwright show-report` and attach logs.
- If Qdrant collections missing or Distance Metric Lock issues are detected, delegate to `schema-evolution` to reconcile collection config or create migrations.
- If `visual_overlays.vector_id` column is missing in Postgres, update `services/visual-rag-client/VisualOverlayRepository.js` ensure logic (tests/fixtures already attempt to add column in test setup).
- Add an integration test that asserts `visual_pages` upsert includes `tensor_b64` payload and that `visual_overlays` metadata mirror includes `doc_id` and `tag_ids`.

[artifacts]
- See this repo files: `services/visual-rag-client/*`, `containers/visual-rag/main.py`, `containers/text-rag/data_manager.py`, `services/visual-rag-client/QdrantAdapter.js`.

```