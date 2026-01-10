Progress update - Visual RAG implementation

Timestamp: 2026-01-08T15:xx:00Z

Completed:
- Added `/detect_elements` endpoint and `/ready` endpoint to sidecar with fallback behavior when model detection API not present.
- Surface `state.last_error` on `/status`.
- Implemented concurrency limiter and query-level timeout (default 500ms) in `VisualSearchClient` and added config variables `VISUAL_RAG_QUERY_TIMEOUT` and `VISUAL_RAG_MAX_CONCURRENT`.
- Added integration tests for sidecar readiness and detect_elements.
- Added a GitHub Actions workflow skeleton and healthcheck compose snippet documentation.

Next steps:
- Add Prometheus metric assertions to integration tests.
- Coordinate PR to `paperless-ngx` compose to add the healthcheck and pre-seeding guidance for CI.
- Consider production-grade concurrency limiter if needed.
