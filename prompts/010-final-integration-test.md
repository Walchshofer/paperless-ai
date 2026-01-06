<objective>
Perform end-to-end integration and acceptance verification for the History Split Layout (Prompt 008) and the Visual Search pipeline (Prompts 005-006).
This final integration test ensures that the user flow (UI draw → search API → results UI) works end-to-end and that telemetry, persistence, and error handling are correct.
</objective>

<context>
This prompt validates the integration between the history split layout, the visual search API, and the visual "Red Pen" tool (Prompt 009). It should be executed after Prompts 005, 006, 008, and 009 are implemented and after `007-verify-visual-search-api.md` has run.

**References:**
- `prompts/008-implement-history-split-layout.md`
- `prompts/009-implement-visual-red-pen.md`
- `prompts/007-verify-visual-search-api.md`
- Architecture: `docs/VISUAL_RAG_INTEGRATION.md`
</context>

<requirements>
1. **E2E Flow Coverage**:
   - Verify a user can open a history document, switch to Red Pen mode, draw a bounding box, and trigger a search.
   - Verify the API call is made and proxied to the sidecar with correct payload.
   - Verify search results appear in the "Similar" tab with expected schema.

2. **Persistence and Feedback**:
   - If feedback actions (e.g., thumbs up) are available, verify they persist to `feedback_events` table.
   - Verify that any saved feedback references the correct document and coordinates.

3. **Telemetry & Logging**:
   - Confirm telemetry events are emitted for search requests and feedback saves.
   - Verify structured logs contain request-id and error contexts for failures.

4. **Failure Modes**:
   - Verify graceful degradation when sidecar fails (UI shows an informative message, no uncaught errors).
   - Verify partial failures (search returns empty results) handled gracefully.
</requirements>

<implementation>
- Add E2E tests (Cypress or Playwright) under `test/e2e/history_visual_search.spec.js` that simulate user interaction.
- Add fixture data to `test/fixtures/e2e/` and a mock sidecar for deterministic E2E runs.
- If E2E is not practical locally, add integration harness that exercises UI layer via headless browser and asserts API traffic.
</implementation>

<output>
- `test/e2e/history_visual_search.spec.js` (Created)
- `test/fixtures/e2e/*` (Created)
- `prompts/summaries/010-final-integration-test-summary.md` (Created after verification)
</output>

<verification>
- Run E2E: `npm run test:e2e -- test/e2e/history_visual_search.spec.js` (expect pass).
- Manually: Open a history document, draw a box, confirm network tab shows `POST /api/visual-rag/search/visual` with payload; confirm results render.
- Verify `feedback_events` contains expected entries for any feedback action.
- Verify telemetry events logged in metrics backend for search and feedback.
</verification>

<lifecycle>
1. Upon completion, generate summary: `prompts/summaries/010-final-integration-test-summary.md`.
2. Move this prompt to `prompts/completed/010-final-integration-test.md` after successful verification.
</lifecycle>