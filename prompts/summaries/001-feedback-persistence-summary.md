# Feedback Persistence (Native Protocol Alpha-9) — Summary

[what]
Implemented Hybrid SOT feedback persistence: PostgreSQL stores feedback events and visual overlay metadata while Qdrant stores 320-dim visual overlay vectors.

[changes]
- migrations/002_create_feedback_events.sql: Added `vector_id UUID` to `visual_overlays` and removed any legacy `embedding` column.
- services/feedback/FeedbackService.js: Implemented `recordGranularFeedback` improvements:
  - Deterministic `vector_id` (UUID) generation for Qdrant points and mirroring back to Postgres `visual_overlays.vector_id`.
  - Retry logic for Qdrant upserts with exponential backoff for handling `503 Initializing` sidecar states; records deferred ingestion events on persistent failures.
  - Logs include `requestId` and `hardware_target: "RTX 3090 Ti"` for telemetry.
- services/visual-rag/QdrantAdapter.js: Ensure initialization logs include `hardware_target` and verify collection specs (320D / Cosine for `visual_overlays`).
- routes/api/visual-rag.js: `POST /api/visual-rag/feedback` endpoint returns `202` when ingestion is deferred; includes `request_id` and hardware target in logs.
- test/integration/feedback_persistence.test.js: Integration test to verify
  - feedback_events row creation in Postgres
  - visual_overlays entry with `vector_id`
  - Qdrant point payload contains mirrored `correspondent_id` and `tag_ids`
- docs/QDRANT_MIGRATION.md: Documented payload mirroring and `vector_id` link and explicit requirements for `visual_overlays` collection.

[next]
- Run migrations and verify DB schema contains no embedding columns for `visual_overlays`.
- Run `npm test -- test/integration/feedback_persistence.test.js` (requires Qdrant + Postgres accessible).
- Update any downstream consumers to use `visual_overlays.vector_id` to correlate with Qdrant points.
