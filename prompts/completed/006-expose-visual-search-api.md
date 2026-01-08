<objective>
Update the Node.js API Gateway and Client to expose the new image-based search capability to the frontend.
This is Phase 2 of the History Route Enhancement Plan.
</objective>

<context>
The Python sidecar now supports image queries (from Prompt 005). The Node.js application needs to bridge this capability to the client so the UI can send cropped regions for analysis.
**Plan Reference:** @paperless-ai/prompts/planning/HISTORY-ROUTE-ENHANCEMENT-PLAN.md (Phase 2)
**Previous Context:** Read the summary of the Sidecar upgrade: @paperless-ai/prompts/summaries/005-upgrade-visual-sidecar-summary.md
</context>

<requirements>
1. **Update Visual Search Client**:
   - Modify ``paperless-ai/services/VisualSearchClient.js`` (or equivalent internal service wrapper).
   - Add a method `searchImage(base64Image, k=5)` that constructs the payload matching the sidecar's new schema.

2. **Create API Endpoint**:
   - Create or update ``paperless-ai/routes/api/visual-rag.js``.
   - Add ``POST /api/visual-rag/search/visual``.
   - Body: `{ image: "base64...", limit: 5 }`.
   - Validation: Ensure image data is present and valid.
   - Implementation: Call ``VisualSearchClient.searchImage`` and return results.   - **Circuit Breaker:** Integrate a circuit breaker on this API route so that if the Visual Sidecar is unavailable or repeatedly failing, this endpoint returns a graceful 503 with a clear fallback message and emits `circuit_breaker_open_total` and `sidecar_availability` metrics per `docs/VISUAL_RAG_INTEGRATION.md`.
- **Telemetry & Request Propagation:** Propagate `X-Request-Id` to the sidecar, include `request_id` in structured logs for each request, and record visual query metrics (`visual_query_execution_time_ms`, `visual_queries_executed_total`).
3. **Documentation**:
   - Update ``paperless-ai/docs/VISUAL_RAG_INTEGRATION.md`` to document this new internal API contract.
</requirements>

<implementation>
- Follow existing error handling patterns (try-catch with standardized error responses).
- Ensure the route is protected if other RAG routes are protected.
</implementation>

<output>
- ``./paperless-ai/services/VisualSearchClient.js`` (Modified)
- ``./paperless-ai/routes/api/visual-rag.js`` (Modified)
</output>

<verification>
- Start the server and sidecar.
- Send a request to `http:/`/localhost`:`3000/api/visual-rag/search/visual`` using Postman or curl.
- Confirm it proxies correctly to the sidecar and returns results.
</verification>

<lifecycle>
1. Upon completion, generate a concise machine-readable summary: ``./paperless-ai/prompts/summaries/006-expose-visual-search-api-summary.md``
2. Move this prompt to ``./paperless-ai/prompts/completed`/`
</lifecycle>
