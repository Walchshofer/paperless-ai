---
name: verify-visual-search-api
stage: 060-test
agent: test-agent
prompt_id: 007-native-alpha-9-verification
---

<objective>
Verify the Native Protocol Alpha-9 Visual Search API. Validate the 
handshake between Node.js and the Python Sidecar, ensuring MaxSim scores, 
collection routing, and hardware-aware fallbacks are deterministic.
</objective>

<context>
This prompt validates the implementation from `006-expose-visual-search-api.md`. 
We must ensure that retrieval across 320-dim Qdrant collections is accurate 
and that the orchestrator respects the RTX 3090 Ti hardware limits.

**Hardware Profile:** RTX 3090 Ti (Ampere SM86).
**SOT Check:** PostgreSQL (Metadata) vs. Qdrant (Vectors).

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **Contract & Multi-Vector Validation**:
   - Verify `POST /api/visual-rag/search/visual` correctly routes to either 
     `visual_pages` or `visual_overlays` based on the request.
   - Validate that the response includes the **MaxSim score** and that 
     it matches the value emitted by the Python sidecar.
   - Ensure `thumbnail_url` propagation works for visual fragments.

2. **Expert Filtering Verification (Hybrid SOT)**:
   - Perform a search with a `correspondent_id` or `tag_id` filter.
   - **Critical Check:** Query Qdrant directly to confirm that the payload 
     filter was actually applied (the results should NOT contain documents 
     outside that filter).

3. **Alpha-9 Fallback Handshake**:
   - Simulate a Sidecar `503 Initializing` state (e.g., during model load).
   - Verify Node.js returns a `SIDECAR_INITIALIZING` error and triggers 
     the Text-Only RAG fallback path.
   - Verify a 5-second timeout triggers a circuit breaker event.

4. **Hardware Performance & VRAM Stress**:
   - Record latency for 320-dim multi-vector retrieval (MaxSim is compute-heavy).
   - Verify that VRAM usage on the RTX 3090 Ti stays stable (~3.5GB baseline) 
     during concurrent visual queries.

5. **Linter & "Detox" Audit**:
   - Ensure the `VisualSearchClient.js` and test fixtures adhere to the 
     established codebase standards (No unused imports, strict typing).
</requirements>



<implementation>
- **Framework:** Mocha + Node `assert` (JS) and PyTest (Python).
- **New Test File:** `test/integration/alpha9-visual-search.test.js`.
- **Fixtures:** Add 320-dim dummy vectors and Base64 image crops to 
  `test/fixtures/visual_search/`.
- **Scripts:** Create `scripts/alpha9-stress-test.sh` to simulate 
  concurrent MaxSim lookups.
</implementation>

<output>
- `test/integration/alpha9-visual-search.test.js`
- `scripts/alpha9-stress-test.sh`
- `prompts/summaries/007-verify-visual-search-api-summary.md`
</output>

<verification>
- Run Alpha-9 integration suite: `npm test test/integration/alpha9-visual-search.test.js`.
- Execute stress test and monitor VRAM: `nvidia-smi` during `bash scripts/alpha9-stress-test.sh`.
- Confirm 100% pass rate on "Filter Mirroring" cases (Postgres filter -> Qdrant payload).
</verification>

<lifecycle>
1. Generate machine-readable summary in: `prompts/summaries/007-verify-visual-search-api-summary.md`.
2. Move to `prompts/completed/` after 100% verification pass.
</lifecycle>