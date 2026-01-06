# Verification: Database Schema & pg_vector

<objective>
Validate that PostgreSQL and pg_vector are installed and configured, the `feedback_events` and `visual_overlays` schemas match the spec, and migrations/rollback scripts work in staging.
</objective>

<context>
The FEEDBACK_PERSISTENCE_STRATEGY requires `feedback_events` and visual overlay indexes; these checks ensure Postgres readiness and migration correctness.
References: docs/FEEDBACK_PERSISTENCE_STRATEGY.md, docs/DATABASE_SETUP.md
</context>

<requirements>
1. Running Postgres instance accessible to tests with sufficient privileges to run migrations.
2. `pgvector` and `pgcrypto` extensions installable or present.
3. Ability to run and rollback migrations in a staging database.
</requirements>

<implementation>
- Add a DB validation script `scripts/check-db-schema.js` that verifies extensions, table columns, and index existence and reports actionable errors.
- Add integration tests that apply `migrations/002_create_feedback_events.sql`, insert a sample row, validate indexes and types, then run rollback script to verify cleanup.
- Ensure migration files include `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` and use `UUID` primary keys and `JSONB` fields.
</implementation>

<output>
- `scripts/check-db-schema.js` (Created)
- `test/integration/db-schema.spec.js` (Created)
</output>

<verification>
- Execute `scripts/check-db-schema.js` against staging and confirm all checks pass.
- Apply migration in a disposable DB, insert/read a sample `feedback_events` row, and run rollback script; confirm the table is removed.
- Confirm `visual_overlays` embedding column has the correct `vector(320)` type and that index `idx_visual_overlays_embedding` exists.
</verification>

<lifecycle>
1. Include `scripts/check-db-schema.js` in `verification-fast` CI job.
2. Update the DB check script when schema changes and add a line in migration docs noting the change.
3. Archive prompt upon CI integration and add a summary to `prompts/summaries/`.
