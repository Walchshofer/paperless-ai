# Handoff: Frontend Visual-RAG Implementation (to frontend-design-implementer)

[meta]
timestamp: 2026-01-25T00:00:00Z
agent: Optimize
stage: 050-implement
prompt_ref: prompts/summaries/018-visual-text-rag-ingestion-audit.md

[summary]
Implement UI wiring to fully integrate Manual, Chat, History, and Playground routes with the Visual-RAG pipeline. Remove legacy inline/vanilla duplication and add Playwright tests to validate overlay search and fallback behavior using real Paperless originals.

[what_to_do]
- Wire `views/manual.ejs`, `views/history-document.ejs`, `views/playground.ejs`, and chat route to use Visual-RAG overlay search endpoints, ensuring ORIGINAL document rendering is used (not thumbnails).
- Implement or update Preact islands for visual overlay UI; ensure islands mount via `data-island` anchors and use the island runtime (`src/islands/runtime.ts`).
- Remove legacy inline JS that duplicates island functionality; ensure islands are single source of truth.
- Add UI tests (Playwright):
  - Reingest a Paperless doc and assert overlays rendered in viewer (`data-testid` checks).
  - Simulate sidecar 503 and assert fallback banner `visual_503_fallback_text` is shown and text fallback is used.
  - Assert overlay positions correspond to metadata from `visual_overlays` and Qdrant points.
- Ensure all EJS pages declare `data-page`, use `vm.*` Zod-validated fields, and include stable `data-testid` for interactive elements.
- Add brief docs and acceptance checklist in `prompts/summaries/<prompt-id>-summary.md` and update `run-active` memory on completion.

[context]
- docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md
- docs/EXPERT_PIPELINE_DECISION_TABLE.md
- docs/EXPERT_PIPELINE_FLOW.md
- prompts/summaries/018-visual-text-rag-ingestion-audit.md
- views/manual.ejs, views/history-document.ejs, views/playground.ejs
- src/islands/runtime.ts and island implementations
- services/visual-rag-client/*
- test/e2e/reingest-verify.spec.ts

[acceptance_criteria]
- Manual / Chat / History / Playground pages perform overlay search against ORIGINAL and render overlays.
- No legacy duplicate client-side code remains for overlay UI; island code is authoritative.
- Playwright tests cover success and fallback cases and pass in infra environment.
- UI adheres to frontend guardrails (Zod contracts, `data-page`, `data-testid`, islands mounting).

[next]
- Implementer: begin with `views/manual.ejs` and `views/playground.ejs`, add tests for the manual viewer flow, then extend to history and chat. Report progress in `run-active` and create a `prompts/summaries/<prompt-id>-summary.md` on completion.

[implementation_tasks]
1. Manual, Chat, History, Playground wiring
   - Replace inline vanilla behavior with a `VisualOverlays` island that accepts `docId`, `page`, `originalUrl` via `data-props`.
   - Ensure `data-page` attribute exists on EJS page root and interactive elements have `data-testid` anchors.
   - Provide a small client API on the island: `searchOverlays(query, options)` that calls `/api/visual-rag/search` via `VisualSearchClient`.

2. Islands & runtime
   - Register `VisualOverlays` island in `src/islands/runtime.ts` and ensure `mountIslands()` is called once.
   - Islands should render overlays using semantic HTML with ARIA (e.g., `role="article" aria-label="visual overlay"`) and `data-testid` on each overlay element.

3. Fallback UX
   - Implement a visible banner component in the island UI that displays `visual_503_fallback_text` when sidecar returns 503, and includes a button to run text fallback search via `/api/rag/search`.
   - Emit telemetry events: `visual_rag_fallback_triggered` with reason code and `request_id`.

4. Tests (Playwright)
   - Test A: Successful overlay render (requires Paperless original and sidecar reachable). Assert overlays exist and `data-testid` elements present.
   - Test B: Simulate sidecar 503 (mock `VisualSearchClient` in test), assert banner `visual_503_fallback_text` visible and fallback is executed.
   - Test C: Overlay position verification: fetch `visual_overlays` via API or DB fixture, assert DOM overlay coords match stored `box` within tolerance (IoU check).

5. Cleanup
   - Remove legacy inline scripts that manipulate overlay DOM in `views/*.ejs`. Leave server-rendered placeholders only.
   - Update Zod view contracts (`src/ui/contracts/*.contract.ts`) to expose required `vm.*` fields for the islands (docId, original_url, page_count).

[pr_requirements]
- Include changes, tests, and Playwright report artifacts in the PR.
- Add a short checklist in PR description mapping to acceptance criteria above.
- Request a review from `frontend-design-auditor` and `qa`.

[assignee]
- frontend-design-implementer
