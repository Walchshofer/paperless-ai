# Verification: Database Schema & Qdrant Vector Store

**BREAKING CHANGE (2026-01):** Vector storage has migrated from pgVector to Qdrant. See `docs/QDRANT_MIGRATION.md`.

<objective>
Validate that:
1. PostgreSQL is configured for metadata storage (feedback_events, visual_overlays tables without vector columns)
2. Qdrant is running and collections are properly configured
3. Migrations/rollback scripts work in staging
</objective>

<context>
The FEEDBACK_PERSISTENCE_STRATEGY requires `feedback_events` for metadata; vector embeddings are now stored in **Qdrant** (not pgVector).
- PostgreSQL: Metadata storage only (feedback_events, visual_overlays without embedding column)
- Qdrant: Vector storage (document_embeddings, visual_overlays, visual_pages collections)

References:
- docs/FEEDBACK_PERSISTENCE_STRATEGY.md
- docs/DATABASE_SETUP.md
- docs/QDRANT_MIGRATION.md
</context>

<requirements>
1. Running Postgres instance accessible to tests with sufficient privileges to run migrations.
2. `pgcrypto` extension installable or present (for UUID generation).
3. **Qdrant** instance running and accessible (default: `localhost:6333`).
4. Ability to run and rollback migrations in a staging database.
</requirements>

<implementation>
- Add a DB validation script `scripts/check-db-schema.js` that verifies PostgreSQL extensions, table columns, and index existence.
- Add a Qdrant validation script `scripts/check-qdrant-collections.js` that verifies collections and vector dimensions.
- Add integration tests that apply `migrations/002_create_feedback_events.sql`, insert a sample row, validate indexes and types, then run rollback script to verify cleanup.
- Ensure migration files include `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` and use `UUID` primary keys and `JSONB` fields.
- **Note:** Vector columns (embedding) are NO LONGER in PostgreSQL - they are in Qdrant.
</implementation>

<output>
- `scripts/check-db-schema.js` (Created)
- `scripts/check-qdrant-collections.js` (Created)
- `test/integration/db-schema.spec.js` (Created)
- `test/integration/qdrant-collections.spec.js` (Created)
</output>

<verification>
- Execute `scripts/check-db-schema.js` against staging and confirm PostgreSQL checks pass.
- Execute `scripts/check-qdrant-collections.js` against staging and confirm Qdrant collections exist:
  - `document_embeddings` (384 dimensions, cosine distance)
  - `visual_overlays` (320 dimensions, cosine distance)
  - `visual_pages` (320 dimensions, dot product)
- Apply migration in a disposable DB, insert/read a sample `feedback_events` row, and run rollback script; confirm the table is removed.
- Confirm `visual_overlays` PostgreSQL table has metadata columns but **NO** embedding column (vectors are in Qdrant).
</verification>

<lifecycle>
1. Include `scripts/check-db-schema.js` and `scripts/check-qdrant-collections.js` in `verification-fast` CI job.
2. Update the check scripts when schema changes and add a line in migration docs noting the change.
3. Ensure Qdrant container is running before verification tests.
4. Archive prompt upon CI integration and add a summary to `prompts/summaries/`.
