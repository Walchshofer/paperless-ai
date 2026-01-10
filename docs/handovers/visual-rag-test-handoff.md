# Visual RAG Test Handoff (for `test-agent`)

**Goal:** Add robust integration tests and metric assertions for Visual RAG and ensure CI runs the tests against a real sidecar. Provide reproducible steps to validate correct behavior for readiness, element detection, and circuit-breaker metrics.

## Scope & Objectives
- Execute and validate: `health.test.js`, `detect_elements.test.js` (already present).
- Add Prometheus metric checks for: `visual_queries_executed_total`, `visual_query_execution_time_ms`, `sidecar_availability`, `circuit_breaker_open_total` and `circuit_breaker_transitions_total`.
- Add circuit-breaker open/close tests by simulating sidecar unavailability and recovery.
- Make CI run these tests reliably (wait for `/ready` / `/health` → `model_loaded:true`), or pre-seed indices for offline CI.

## Step-by-step (local reproduction)
1. Start services (local/dev):
   - Start the visual sidecar:
     - If using compose: `docker compose up -d visual-rag` (or start container directly from `services/visual-rag-sidecar` Dockerfile).
     - Confirm readiness: `curl -fsS http://localhost:8001/ready` returns 200 or `curl http://localhost:8001/health` shows `model_loaded:true`.
2. Run integration tests:
   - `npm ci` (or `npm install`)
   - `npm test -- test/integration/visual-rag --reporter spec`
3. Metric assertions (example approach):
   - After running a visual query (or tests that run queries), poll Prometheus metrics endpoint (default: `http://localhost:9091/metrics`) and assert:
     - `visual_queries_executed_total{document_type="..."}` increased
     - `visual_query_execution_time_ms_bucket{}` has non-zero counts for query type
     - `sidecar_availability{service="visual-rag"} 1` when healthy
   - Example tool: use HTTP polling with a short timeout and retry loop up to N seconds to avoid flakiness.
4. Circuit breaker tests:
   - Simulate sidecar unavailability:
     - Option A: Stop container: `docker stop visual-rag`
     - Option B: Override `VISUAL_RAG_URL` to an invalid address for the Node process
   - Send multiple image queries (enough to exceed `failureThreshold`) and assert:
     - The API returns 503 with `{ circuit_breaker: 'open' }`
     - `circuit_breaker_open_total{service="visual-rag"}` incremented
     - Once sidecar is restored, assert that `circuit_breaker_transitions_total` shows recovery transitions.

## Tests to add (suggestions)
- `test/integration/visual-rag/metrics.test.js`
  - Runs a visual query, then polls Prometheus for `visual_queries_executed_total` and `visual_query_execution_time_ms`.
- `test/integration/visual-rag/circuit_breaker.test.js`
  - Simulate sidecar failure and recovery then assert metrics and API responses.
- Improve existing tests to be robust with retries/polling and clear assertion messages for logs.

## CI Integration
- Update `.github/workflows/visual-rag-e2e.yml` (or integrate into existing test workflow):
  - Step: start sidecar container
  - Step: wait for readiness: poll `/ready` (preferred) or `/health` until `model_loaded:true` or timeout
  - Step: run `npm test -- test/integration/visual-rag`
- Add `pre-seed` option in CI (artifact or script) to create `.hf_hub_download_complete` and a small index to avoid long first-run downloads.

## Acceptance Criteria
- Integration tests (including metric checks and circuit-breaker tests) pass locally and in CI against a real sidecar.
- Metrics assertions reliably pass (use polling and timeouts to avoid flakiness).
- The CI job times out with clear diagnostics if sidecar does not reach readiness.
- A PR is opened & merged with the tests and CI updates.

## Context & Files
- Implementation & tests: `services/visual-rag-sidecar/main.py`, `services/visual-rag/VisualSearchClient.js`, `test/integration/visual-rag/*`.
- Metrics: `services/metrics/PrometheusMetrics.js`.
- CI: `.github/workflows/visual-rag-e2e.yml` and `docs/handovers/visual-rag-healthcheck-snippet.md`.

---

If you pick this up, please reply to confirm and I will mark the `handoff-next` memory as `in-progress` for `test-agent` and follow up on any implementation questions.