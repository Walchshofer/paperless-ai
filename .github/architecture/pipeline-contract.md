# Pipeline Contract (Short)

This file captures high-level, non-negotiable runtime contracts for the Expert Pipeline.
It is an index of crucial operational invariants; it should be kept short and refer to authoritative docs for details.

## Vector Store SOT (Qdrant)
- **Qdrant is the Source of Truth (SOT) for vectors.** All vector embeddings must live in Qdrant collections and be treated as authoritative for similarity and retrieval.
- **Collections:** `document_embeddings` (text, 384d Cosine), `visual_pages` (page multi-vector, 320d Dot), and `visual_overlays` (overlays, 320d Cosine).
- **Distance Metric Locks:** Collections' distance metrics must match the expected semantics (e.g., Dot for `visual_pages`). Any mismatch is a critical error.
- **Payload Mirroring:** Minimal payload mirroring to Postgres is required (e.g., `doc_id`, `correspondent_id`, `tag_ids`) and a `vector_id` UUID should be stored in the corresponding relational row to allow auditability and reverse lookups.
- **Postgres Role:** PostgreSQL is metadata-only for vectors and must not contain embedding vectors (`pgvector` columns are forbidden at runtime).

## Health & Enforcements
- Startup health checks MUST validate the presence of required collections and verify vector size/distance per collection (see `docs/QDRANT_MIGRATION.md`).
- CI/integration tests must include a lightweight validation that collection configs match contract (distance, dims).

## Re-ingestion & Migration Requirements
- Any change that affects vector collection schema, embedding models, or ingestion behavior **must** include a documented migration/re-ingestion plan in `docs/QDRANT_MIGRATION.md` detailing:
  - Backup steps for Postgres and Qdrant data,
  - A dry-run re-ingestion plan and checkpoints for large corpora,
  - Verification criteria (Qdrant point counts, Postgres `vector_id` population, and search smoke tests),
  - Rollback instructions.
- An automated e2e re-ingest test (e.g., `test/e2e/reingest-verify.spec.js`) demonstrating PDF → Qdrant point → Postgres `vector_id` mapping is required before merging changes that touch vector behavior.
- CI must provide an opt-in gating job for full re-ingest tests (large corpora) and require a lightweight collection validation job on merge to protect production SOT.

## References
- docs/QDRANT_MIGRATION.md (collection definitions and migration plan)
- docs/EXPERT_PIPELINE_DECISION_TABLE.md (pipeline precedence and orchestration)
