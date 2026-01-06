<objective>
Verify the Visual Search API contracts, behavior, and resilience (endpoints proxied by Node.js to the visual-sidecar).
This standalone verification prompt validates that the API implemented in Prompt 006 meets contract, error handling, and performance expectations.
</objective>

<context>
This prompt validates `006-expose-visual-search-api.md` implementation and the sidecar integration (Prompt 005). It focuses on API contract tests, error cases, and basic performance checks.

**References:**
- Implementation: `prompts/006-expose-visual-search-api.md`
- Sidecar: `prompts/005-upgrade-visual-sidecar.md`
- Architecture: `docs/VISUAL_RAG_INTEGRATION.md`
</context>

<requirements>
1. **Contract Tests**:
   - Verify `POST /api/visual-rag/search/visual` accepts a JSON payload with fields `document_id` (UUID) or `image_base64` (string) and optional `top_k` (int).
   - Expected response: HTTP 200 with JSON `{ results: [{ document_id, score, thumbnail_url }], meta: { count, query_time_ms } }`.
   - Verify response fields types and presence for successful queries.

2. **Error Handling**:
   - Test invalid payloads (missing image/document_id) return HTTP 400 with clear error message.
   - Simulate sidecar unavailability and verify Node.js API returns a 503 with a clear fallback message.

3. **Edge Cases**:
   - Large payload handling (image sizes up to configured limit) should either succeed or return a 413 with clear guidance.
   - Empty or low-quality images return HTTP 200 with `results: []` and no server error.

4. **Performance Baseline**:
   - Single query latency should be under X ms (set baseline per infra; track and document actuals).
   - Under small concurrent load (e.g., 10 RPS), API should not error.

5. **Security & Validation**:
   - Verify CORS header presence for expected origins.
   - Verify request validation prevents SSRF or unexpected payloads.
</requirements>

<implementation>
- Implement automated contract tests using Mocha + Node assert (new file: `test/visual-search.contract.test.js`).
- Add sample payloads (fixtures) under `test/fixtures/visual_search/` including a small PNG/JPEG base64 string for integration tests.
- Add integration script `scripts/test_visual_search.sh` with `curl` samples to exercise common scenarios.
- Add a small health-check script to simulate sidecar down scenarios (mocking/proxying as needed).
</implementation>

<output>
- `test/visual-search.contract.test.js` (Created)
- `test/fixtures/visual_search/*` (Created)
- `scripts/test_visual_search.sh` (Created)
- `prompts/summaries/007-verify-visual-search-api-summary.md` (Created after verification)
</output>

<verification>
- Run contract tests: `npm test -- test/visual-search.contract.test.js` (expect all tests pass).
- Run curl sample: `bash scripts/test_visual_search.sh success` (expect HTTP 200 and response structure per contract).
- Simulate invalid payload: `bash scripts/test_visual_search.sh bad_payload` (expect HTTP 400 and adequate error message).
- Simulate sidecar down: use proxy to block sidecar and run `bash scripts/test_visual_search.sh sidecar_down` (expect HTTP 503 and clear message).
- Record latency and count metrics for a small 10-request run: `bash scripts/test_visual_search.sh perf_test` (capture and include results in summary).
</verification>

<lifecycle>
1. Upon completion, generate summary: `prompts/summaries/007-verify-visual-search-api-summary.md` with test results and metrics.
2. Move this prompt to `prompts/completed/007-verify-visual-search-api.md` after successful verification.
</lifecycle>