# Stateless Visual RAG Sidecar — Design Proposal

Status: Draft
Owner: @implement
Target milestone: Migrate visual sidecar to stateless compute-only (proposal)

## Motivation

The current Visual RAG sidecar is stateful: it persists per-document `.pt` tensors into `INDEX_DIR` and synchronizes mean-pooled vectors to Qdrant as the single source of truth (SOT). While this supports native MaxSim scoring and a local fallback search, it introduces operational complexity:

- Requires a persistent host volume mounted to `/data/indices` to avoid data loss on restart
- Potential for split-brain or duplication if ingestion and syncing are not coordinated
- Poor horizontal scalability when multiple replicas with local indices run concurrently

Converting to a stateless compute-only sidecar simplifies operations, improves scalability, and aligns with the principle that persistent vector storage is managed by Qdrant (SOT).

## Goals

- Make the sidecar operate in a *stateless* mode by default when configured (feature-flagged)
- Provide a backward-compatible transition path for current deployments
- Preserve native MaxSim scoring where required, while moving persistent storage responsibility to the main Paperless application or a dedicated ingestion service

## Non-goals

- Replace Qdrant as the primary SOT
- Remove MaxSim scoring capability (we will support on-demand MaxSim by fetching per-document tensors from Qdrant or an external object store)

## Proposed Changes

1. Configuration
   - Add `VISUAL_RAG_STATELESS` (boolean env var, default: `no`), and `VISUAL_RAG_TENSOR_BUCKET` optional (S3/MinIO path or other object store) for long-term multi-vector storage if required.
   - Preserve `INDEX_DIR` and the current stateful behavior unless `VISUAL_RAG_STATELESS=yes`.

2. API surface changes (minimal, additive)
   - Add `POST /embed/document` (or make `/index/document` honor `VISUAL_RAG_STATELESS`) to return an object with `doc_id`, `page_embeddings` (serialized multi-vector patch tensors, base64) and `page_mean_vector` (float[]). When stateless, the sidecar will NOT write `.pt` files; instead it will return embeddings for the caller to persist into Qdrant.
   - Keep `/search` endpoint behavior unchanged for deployments that still use local registry (stateful). When stateless, `/search` will default to calling Qdrant for retrieval.

3. Runtime behavior
   - If `VISUAL_RAG_STATELESS=yes`:
     - Do not create or use `INDEX_DIR` or local registry
     - On `/index/document` or `/index/pdf`, process images and immediately upsert to Qdrant (retaining current payload schema) OR return embeddings to caller depending on `VISUAL_RAG_PERSIST_TO_QDRANT` flag
     - On `/search`, use Qdrant exclusively; for MaxSim native scoring, fetch required tensors or perform approximate fallback (documented trade-offs).
   - Backwards compatibility: support `VISUAL_RAG_STATELESS=no` and keep local registry behavior unchanged.

4. Storage & Migration
   - Option A (preferred for minimal change): Sidecar calls Qdrant on index time to upsert mean vectors and does not persist `.pt` locally when stateless. The main app will be the only authoritative persister.
   - Option B (advanced): Provide optional upload of full tensor (`tensor_b64`) to S3/MinIO for later native MaxSim rehydration; Qdrant payload keeps `tensor_b64` (base64 serialized tensor) as today but ensure object store reference support for large datasets.

5. Tests
   - Unit tests for stateless code paths
   - Integration tests that simulate `VISUAL_RAG_STATELESS=yes` and verify:
     - No `.pt` files created under `INDEX_DIR`
     - Qdrant receives upserted points (or the sidecar returns embeddings to caller)
     - `/search` routes to Qdrant and returns coherent results

6. Docs & Deployment
   - Update `services/visual-rag-sidecar/README.md` with a "How to run stateless" recipe and configuration examples
   - Update `docs/ENVIRONMENT_VARIABLES.md` and `docs/VISUAL_RAG_INTEGRATION.md`
   - Provide a migration guide for operators to switch to stateless mode

## Acceptance criteria

- New env var `VISUAL_RAG_STATELESS` exists and is respected during runtime
- When stateless, the sidecar does not write `.pt` files and either upserts vectors to Qdrant or returns embeddings to the caller (configurable)
- Integration tests pass for both stateful and stateless modes
- Documentation updated with clear guidance and migration steps

## Risks & Mitigations

- Loss of native MaxSim accuracy if tensors are not available locally; mitigate by uploading `tensor_b64` to Qdrant or S3 and enabling on-demand fetch for MaxSim operations.
- Increased Qdrant ingestion load; mitigate by batching upserts and monitoring `qdrant_payload_sync_total` metrics.

## Implementation plan (Phased)

1. Add env variables and small API contract changes; add unit tests and docs (small PR)
2. Implement `VISUAL_RAG_STATELESS` logic: no local writes; choose default persistent behavior (sidecar upserts to Qdrant) (medium PR)
3. Add optional S3/MinIO upload for full tensors and provide utilities for rehydration for MaxSim (large PR)
4. Integration testing & CI updates; publish migration guide (docs PR)

## Impacted files (initial)

- `services/visual-rag-sidecar/main.py`
- `services/visual-rag-sidecar/Dockerfile`
- `services/visual-rag-sidecar/requirements.txt` (if object store libs needed)
- `services/visual-rag-sidecar/README.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- Integration tests in `test/` or `test/integration/`

---

Please review this design and, if approved, I'll open a tracking PR with small incremental changes (env var and docs first) and assign work to the `implement` and `test` agents.