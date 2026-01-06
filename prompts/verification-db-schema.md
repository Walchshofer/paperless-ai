# Verification: Database Schema & pg_vector

Goal: Ensure the Postgres schema and vector extension required by Visual RAG and feedback persistence are installed and configured correctly.

Checks:

- Verify pg_vector extension is installed and active
  - Query: `SELECT extversion FROM pg_extension WHERE extname = 'vector';`
  - Expected: returns a version string and not empty.

- Verify `pgcrypto` or `gen_random_uuid()` availability
  - Query: `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` (dry-run) or check `pg_extension`.

- Verify `feedback_events` table exists and structure matches spec
  - Columns: `id UUID PRIMARY KEY`, `doc_id INT NOT NULL`, `user_id INT`, `event_type VARCHAR(50)`, `field_name VARCHAR(100)`, `original_value JSONB`, `corrected_value JSONB`, `context JSONB`, `created_at TIMESTAMPTZ`, `processed BOOLEAN`
  - Indexes: `idx_feedback_doc_id`, `idx_feedback_processed_false` (partial index), `idx_feedback_event_type`.

- Verify `visual_overlays` table/vector column
  - Column `embedding vector(320)` exists
  - HNSW index exists and is healthy (e.g., check `pg_indexes` for `idx_visual_overlays_embedding`).

- Verify migration artifacts present and rollback script works
  - Confirm `migrations/002_create_feedback_events.sql` and `migrations/002_rollback_feedback_events.sql` are present and runnable.

- Versioning & backward-compatibility
  - Confirm the migration uses `UUID` primary keys and `JSONB` for flexible fields.

Suggested Test Steps (Manual / Automated):

1. Run health check: `GET /health/database` and assert `pgvector` available and `schema.ready` true.
2. Run a DB check script that runs the queries above and reports mismatches with actionable output.
3. For integration: run migration against a staging DB, validate schema, insert a sample `feedback_events` row, read it back, and then run rollback script and verify schema removed.

Notes:
- Use least-privileged credentials where possible; for migrations, require adequate privileges.
- Avoid logging PII values from `original_value` / `corrected_value` fields.