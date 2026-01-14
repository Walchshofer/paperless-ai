name: implement-feedback-persistence
stage: 020-schema
agent: schema-evolution
prompt_id: 001-native-alpha-9-feedback-sot
status: completed

summary: Implemented Hybrid SOT feedback persistence with Postgres and Qdrant, added migration, service changes, tests, and docs updates.
files_changed:
  - migrations/002_create_feedback_events.sql
  - services/feedback/FeedbackService.js
  - services/visual-rag/QdrantAdapter.js
  - routes/api/visual-rag.js
  - test/integration/feedback_persistence.test.js
  - docs/QDRANT_MIGRATION.md
  - prompts/summaries/001-feedback-persistence-summary.md
next_steps:
  - Run migrations and integration tests in CI (requires Qdrant + Postgres)
  - Monitor VRAM usage on RTX 3090 Ti during sidecar startup and embed operations
  - Update any downstream consumers to use `visual_overlays.vector_id` for correlation
