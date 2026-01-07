# Integration Test Prompt: Feedback Flow E2E

<objective>
Verify the full feedback ingestion path end-to-end from UI action through API and DB persistence, including Paperless-ngx metadata updates, `request_id` propagation, and telemetry.
</objective>

<context>
The `feedback_events` migration is in the repo and front-end Islands scaffolding exists. This test validates the user journey (Manual Editor → API → DB) and ensures telemetry and Paperless metadata updates are performed.
References:
- docs/FEEDBACK_PERSISTENCE_STRATEGY.md
- docs/OBSERVABILITY_AND_TELEMETRY.md
- prompts/016-verification-checklist.md
</context>

<requirements>
1. Test environment with Postgres and `migrations/002_create_feedback_events.sql` applied.
2. Paperless-ngx test instance or a mocked Paperless API reachable from the test harness.
3. Playwright/Cypress available in CI and a test user/document (`doc_id`) for the flow.
4. Ability to query DB (connection string) and access `/metrics` endpoint.
</requirements>

<implementation>
- Implement a Playwright test `test/e2e/feedback.flow.spec.ts` that performs the UI interactions and intercepts network requests.
- Use a lightweight mock for Paperless-ngx (or an HTTP test double) to assert `X-Request-Id` propagation and metadata update attempts.
- Poll the DB for `feedback_events` inserts with a retry loop (max 10s) and assert expected fields.
- Parameterize the test by `doc_id` and enable a `transactional` variant to test rollback behavior.
- Capture logs and `/metrics` snapshots before and after the test to assert telemetry changes.
</implementation>

<output>
- `test/e2e/feedback.flow.spec.ts` (Created)
- Optional test helper: `test/helpers/db-poll.js` (Created)
- Test discovery entry in `package.json` (e.g., `npm run test:e2e`)
</output>

<verification>
- Run the Playwright test against an integration environment; it should pass within the retry timeouts.
- Verify inserted `feedback_events` row contains `doc_id`, `event_type='correction'`, `corrected_value`, and `context.request_id`.
- Confirm `X-Request-Id` header is present on Paperless mock calls.
- Confirm `/metrics` shows `feedback_ingest` increment.
</verification>

<lifecycle>
1. On completion, create a short summary `prompts/summaries/015-feedback-e2e-summary.md`.
2. Add the test to CI job `verification-e2e` (gated) and mark prompt as completed in `prompts/completed/`.
3. Update docs if additional fields were required to support the test (e.g., retention cleanup guidance).
</lifecycle>