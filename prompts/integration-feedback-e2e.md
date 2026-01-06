# Integration Test Prompt: Feedback Flow E2E

Objective: Verify the full feedback ingestion path end-to-end from UI action through API and DB persistence, including Paperless-ngx metadata updates and telemetry.

Scenario: User corrects a field in the Manual Editor and submits feedback; system updates Paperless metadata and creates a `feedback_events` row.

Preconditions:
- Test environment with a running Postgres DB (migration `002_create_feedback_events.sql` applied)
- A Paperless-ngx test instance or a mocked Paperless API available
- The test user has a document (doc_id) to operate on
- `VISUAL_RAG` sidecar may be stubbed/mocked if needed

Steps:

1. UI Interaction (Playwright/Cypress)
  - Visit manual editor page for `doc_id` (e.g., `/manual/${doc_id}`)
  - Assert island anchors are present and `data-props` contain minimal props
  - Simulate user editing a field (e.g., `total_amount`) via the island UI and submit (click Save or Submit)
  - Confirm UI shows success and includes `request_id` in returned headers or client logs where available (response header `X-Request-Id`)

2. API Endpoint
  - Intercept POST to `/manual/updateDocument` or `/api/feedback` and record payload
  - Assert payload includes: `doc_id`, `user_id` (or null), `events` array with `event_type` = `correction`, `field_name`, and `corrected_value`

3. Paperless-ngx update
  - Assert backend made a request to Paperless-ngx to update document metadata (simulate/mocked) with updated field.
  - Confirm `X-Request-Id` header propagated to Paperless call.

4. Database Persistence
  - Poll or query `feedback_events` table for a new row: verify `doc_id`, `event_type`, `corrected_value`, `context` includes `request_id` and minimal evidence (e.g., page_number).
  - Verify `processed` is false by default.

5. Telemetry & Logs
  - Confirm `/metrics` shows `feedback_ingest` incremented or a custom metric for test flows.
  - Confirm structured logs include `request_id`, `document_id`, `stage`, and `action_status`.

6. Cleanup
  - Remove inserted test row(s) from `feedback_events` and revert Paperless metadata changes if operating against a real instance.

Assertions:
- End-to-end flow completes with HTTP 200/202 where appropriate.
- `feedback_events` row exists and matches payload.
- `X-Request-Id` is present and consistent across UI→API→Paperless calls and stored in DB context.
- No PII is leaked to logs; sensitive fields are masked or omitted from structured logs.

Suggested Automation:
- Implement this as a Playwright test that can run against a local integration environment. Use service mocks for Paperless-ngx and Visual Sidecar when needed.
- Parameterize `doc_id` and `user_id` for CI runs.
- Add retries for DB polling with a short timeout (e.g., retry for up to 10s) to account for async processing.

Notes:
- For transactional=true flows: add a variant that sets `transactional=true` and asserts that on DB failure the Paperless metadata update is rolled back or the request reports failure with an appropriate HTTP 4xx/5xx and logs.
- For best-effort flows: assert UI returns success even if DB persistence fails, and the failure is recorded in metrics and logs.