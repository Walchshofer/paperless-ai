# Verification: Telemetry, Request IDs & Prometheus Metrics

Goal: Ensure `request_id` propagation, structured logging fields, and Prometheus metrics exist and are being emitted for key events.

Checks:

- Request ID Propagation
  - Verify each incoming HTTP request receives a `request_id` (header `X-Request-Id` or internal generator).
  - Verify `request_id` is propagated to outgoing requests (Paperless-ngx, Visual RAG sidecar, Guidance) via `X-Request-Id` headers.
  - Verify `request_id` is stored in DB entries where applicable (e.g., `feedback_events` context or metadata).

- Structured Logging
  - Confirm logs include mandatory fields from `docs/OBSERVABILITY_AND_TELEMETRY.md`: `request_id`, `document_id`, `pipeline_id`, `stage`, `retry_count`, `fallback_reason`, `ocr_source_selected`.
  - Verify log lines are JSON structured in production (or structured fields are present) and not free-form strings for pipeline events.

- Prometheus Metrics
  - Confirm exporter is available at `/metrics` and returns HTTP 200 (or 204 if disabled).
  - Confirm key metrics exist and update under load: `feedback_ingest`, `integration_errors_total`, `pipeline_stage_latency_ms`, `circuit_breaker_open_total`, `sidecar_availability`.
  - For counters/histograms: confirm labels include the recommended labels (e.g., `stage_name`, `service`).

- Observability Events
  - Trigger example flows (successful feedback ingest, sidecar failure) and confirm corresponding metrics increment and log entries appear with `request_id`.
  - Confirm metrics and logs are non-blocking (failures to push metrics do not block request handling).

Suggested Test Steps:

1. End-to-end: Send a POST to `/manual/updateDocument` with `X-Request-Id` set and assert downstream services received the header (mocking or intercepting Paperless calls).
2. Metrics: Use a small script to poll `/metrics` before/after test flows and confirm counters/histograms changed.
3. Logs: Use test logger or local file to assert structured logs exist for the flow and contain the required fields.

Notes:
- Avoid logging PII in `original_value`/`corrected_value` fields; log `masked:true` or a placeholder where required.
- Add tests that assert missing `request_id` results in the server generating one and returning it via response header.