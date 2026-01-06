# Verification: Telemetry, Request IDs & Prometheus Metrics

<objective>
Validate `request_id` propagation, required structured logging fields, and presence and correctness of Prometheus metrics for key events.
</objective>

<context>
Observability is critical for debugging and auditability. The checks below align with docs/OBSERVABILITY_AND_TELEMETRY.md and validate that tracing and metrics exist for feedback ingestion and visual pipeline events.
References: docs/OBSERVABILITY_AND_TELEMETRY.md, prompts/014-verification-checklist.md
</context>

<requirements>
1. Access to application logs (structured) and the `/metrics` endpoint.
2. Ability to run flows that generate telemetry (e.g., feedback ingest, simulated sidecar failures).
3. Test harness can intercept outgoing HTTP requests to assert `X-Request-Id` propagation.
</requirements>

<implementation>
- Add tests: `test/integration/telemetry.spec.js` that send requests with and without `X-Request-Id` and assert generation/propagation.
- Add a small metrics snapshot helper `test/helpers/metrics-snapshot.js` to compare metrics before/after flows.
- Ensure structured logs include mandatory fields and add parsers in tests to assert presence.
</implementation>

<output>
- `test/integration/telemetry.spec.js` (Created)
- `test/helpers/metrics-snapshot.js` (Created)
</output>

<verification>
- Send POST `/manual/updateDocument` with custom `X-Request-Id`; assert all downstream mocks received the header and DB row `context` contains `request_id`.
- Poll `/metrics` before and after flows and assert `feedback_ingest` and `integration_errors_total` counters changed appropriately.
- Parse logs to assert the presence of the required structured fields including `request_id`, `document_id`, `stage`.
</verification>

<lifecycle>
1. Add the telemetry test to `verification-fast` or `verification-e2e` depending on duration.
2. Update tests and metric names if observability contract changes.
3. Archive the prompt in `prompts/completed/` and add a verification summary to `prompts/summaries/` when CI is green.
