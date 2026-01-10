# Visual RAG Implementation Handoff

**Purpose:** Capture audit findings (docs ↔ code ↔ runtime), recommended fixes, test steps, and acceptance criteria for the implementation agent.

## Summary (Short)
The Visual RAG feature has working API routes and client code, but E2E verification is blocked because the visual-rag sidecar is not fully wired for the parallel OCR flow and CI. Key gaps: missing `/detect_elements` endpoint, circuit-breaker timeout mismatch, no readiness gating in docker/CI, and no concurrency limit for visual queries.

## Findings (Detailed)
- Missing endpoint: `ParallelOcrExecutor` posts to `/detect_elements` on the sidecar, but `services/visual-rag-sidecar/main.py` does not implement this endpoint.
- Circuit breaker mismatch: docs and `CircuitBreaker.DEFAULT_CONFIG` expect ~500ms latency budget, but `VisualSearchClient` constructs a `CircuitBreaker` using a 30s timeout by default (from config). Visual queries therefore won't fail-fast as documented.
- No CI readiness: sidecar writes `.hf_hub_download_complete` on first-run but CI lacks steps to allow initial model download or to wait for `model_loaded:true`. E2E tests time out when the sidecar is still loading.
- Concurrency: docs mention capped concurrency (max 5), but the codebase lacks a concrete limiter; this can cause resource contention during high throughput tests.
- Observability: sidecar exposes `/health` and `/status`, but startup import errors (e.g., Byaldi import) are not surfaced in a way CI can act upon; `state.last_error` exists but should be shown in `/status`.

## Files to Read
- `services/visual-rag-sidecar/main.py`
- `services/visual-rag/VisualSearchClient.js`
- `services/experts/ParallelOcrExecutor.js`
- `routes/api/visual-rag.js`
- `services/metrics/PrometheusMetrics.js`
- `test/visual-search.contract.test.js`
- `paperless-ngx/docker-compose.yml`
- `docs/VISUAL_RAG_INTEGRATION.md`

## Concrete Tasks (Implementation)
1. Implement `/detect_elements` in the sidecar with request/response shape (COMPLETED - prototype):
   - Request: `{ image: <base64>, detect_types: string[] }`
   - Response: `{ elements: Array<{bbox, type, confidence, metadata}>, layout: Object, confidence: number }`
   - Behavior: returns 503 if `model_loaded` is false. Prototype returns an empty array fallback if model API is not present.
2. Align circuit-breaker behavior (COMPLETED - query-level timeouts):
   - `VisualSearchClient` now uses a short `queryTimeout` (default 500ms) for query operations while health checks use longer timeouts.
3. Add concurrency limit to `VisualSearchClient` (COMPLETED - default 5):
   - In-process semaphore implemented; configurable via `VISUAL_RAG_MAX_CONCURRENT` / `config.visualRagSidecar.maxConcurrent`.
4. Add Docker `healthcheck` to `visual-rag` service that waits for `model_loaded:true` and ensure CI uses it before running E2E tests (DOCUMENTED - needs to be added to `paperless-ngx` compose file):
   - Snippet added to `docs/handovers/visual-rag-healthcheck-snippet.md` for operators to apply in compose.
5. Add integration tests (COMPLETED - tests added):
   - `test/integration/visual-rag/health.test.js` — waits for `model_loaded:true`.
   - `test/integration/visual-rag/detect_elements.test.js` — verifies endpoint response shape.
6. Improve sidecar observability (COMPLETED - partial):
   - `state.last_error` is returned in `/status`; `/ready` endpoint added for readiness probes.
7. Add CI job that:
   - A GitHub Actions job skeleton ` .github/workflows/visual-rag-e2e.yml` has been added; it brings up `visual-rag`, waits for `/ready` and runs integration tests. It may need adjustments to match the mono-repo compose layout.

**Remaining work / follow-up:**
- Ensure `paperless-ngx/docker-compose.yml` includes the healthcheck snippet (operator action or PR in the other repo).
- Add integration assertions for Prometheus metrics (verify `visual_query_execution_time_ms`, `visual_queries_executed_total`, `sidecar_availability`, `circuit_breaker_open_total`).
- Consider replacing the in-process semaphore with a robust limiter or moving to a shared queue if running multiple node worker processes.


## Acceptance Criteria
- Sidecar responds to `/detect_elements` with expected shape and passes integration test.
- `visual_search` E2E tests pass against a real sidecar in CI; `model_loaded:true` reached within CI timeout.
- Prometheus metrics for visual queries and circuit-breaker transitions are recorded during practical tests.
- Concurrency limit is enforced and configurable.

## Notes & Risks
- First-run downloads may require network access and additional time (minutes) in CI; prefer pre-seeding index during CI to keep test runtime reasonable.
- Updating client timeouts may change failure/retry behavior and require adjusting the fallback heuristics in the pipeline.

---

If you want, I can open a small PR that adds a minimal `/detect_elements` implementation and a CI job skeleton; confirm and I will implement it.
