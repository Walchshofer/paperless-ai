---
name: expose-visual-search-api
stage: 080-paperless-api
agent: implement-agent
prompt_id: 006-native-alpha-9-api-exposure
---

<objective>
Update the Node.js API Gateway and VisualSearchClient to expose the Native 
Protocol Alpha-9 image-search capability. Bridge the UI to the 320-dim 
Qdrant collections via the Python Sidecar.
</objective>

<context>
The Python sidecar now supports ColQwen3-4B-AWQ image queries (Alpha-9). 
The Node.js layer must now handle the routing, circuit breaking, and 
metadata mirroring between PostgreSQL and Qdrant payloads.

**Hardware Baseline:** RTX 3090 Ti (Ampere SM86).
**Retrieval Logic:** Native MaxSim (Late Interaction) via Sidecar :8001.

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **Update VisualSearchClient.js**:
   - **Method:** `searchImage(base64Image, collection, filters, limit=5)`.
   - **Payload:** Must support `collection_name` (e.g., `visual_pages`) to 
     target specific Alpha-9 collections.
   - **Timeout:** Implement a strict 5000ms timeout for sidecar calls.
   - **Handshake:** Correctly parse the `503 Initializing` response from the 
     sidecar and bubble it up as a `SIDECAR_INITIALIZING` error type.

2. **Update API Route (visual-rag.js)**:
   - **Endpoint:** `POST /api/visual-rag/search/visual`.
   - **Hybrid SOT Mirroring:** If the request includes metadata filters 
     (e.g., `correspondent_id`), the route must ensure these are passed 
     in the `Payload` filter to Qdrant to satisfy the "Expert Filtering" rule.
   - **Circuit Breaker:** If the sidecar is offline or returning 503, the 
     gateway must emit `circuit_breaker_open_total` and return a clear 
     fallback to the Text-Only RAG path.

3. **Telemetry & Propagation**:
   - Propagate `X-Request-Id` to the Python sidecar.
   - Log `visual_query_execution_time_ms` and `maxsim_score_mean`.
   - Ensure logs include the target hardware profile (RTX 3090 Ti).

4. **Documentation**:
   - Update `docs/VISUAL_RAG_INTEGRATION.md` with the new POST schema.
</requirements>

<implementation>
- **Node.js:** Use `axios` or `fetch` with AbortController for timeouts.
- **Error Handling:** Follow `VALIDATION_AND_RETRY_POLICY.md` for 
  deterministic error states.
- **Filtering:** Use the mirrored payload fields (Alpha-9 standard) for 
  all visual lookups.
</implementation>



<output>
- ``services/VisualSearchClient.js`` (Modified)
- ``routes/api/visual-rag.js`` (Modified)
- ``docs/VISUAL_RAG_INTEGRATION.md`` (Updated)
</output>

<verification>
- Start Sidecar (RTX 3090 Ti) and Node.js.
- CURL a Base64 image + `correspondent_id` filter.
- Confirm results match the 320-dim ColQwen3 MaxSim scores.
- Simulate Sidecar downtime and verify 503 fallback to Text RAG.
</verification>

<lifecycle>
1. Generate summary: ``prompts/summaries/006-expose-visual-search-api-summary.md``
2. Update ``docs/EXPERT_PIPELINE_DECISION_TABLE.md`` if API gates changed.
3. Move to ``prompts/completed/``
</lifecycle>