[meta]
timestamp: 2026-01-25T18:30:00Z
agent: GitHub Copilot
stage: 050-implement
prompt_ref: prompts/summaries/020-frontend-handoff-implementer.md

[to_agent]
- frontend-design-router

[what_to_do_next]
- Validate OverlayViewer UI contracts and tests:
  - Review `src/islands/OverlayViewerIsland.tsx` and confirm it listens for `overlay:document-changed` events and updates using the `original_url` (or `originalUrl`) field when present.
  - Ensure the island and its controls expose stable test hooks: add/confirm `data-testid="overlay-viewer-island"`, `data-testid="overlay-page-indicator"`, and stable nav IDs or `data-testid` attributes for previous/next page controls (`#nextPage` / `#prevPage` or testids).
  - Add/extend unit tests (island event handling) and Playwright E2E tests asserting: island mounts, responds to dispatched events, updates the page indicator on page nav, and preserves `original_url` preference.
- Make tests resilient to initial-setup blocking modal (non-invasive approach preferred):
  - Add a test-only hook to auto-close or bypass the setup modal when E2E runs (e.g., detect modal and close it in global-setup, or add a small test-only script guarded by NODE_ENV/test flag). Avoid changing production behavior.
  - Coordinate with implementer to ensure a long-term fix (e.g., ensure PAPERLESS_AI_INITIAL_SETUP is set correctly in test infra) but implement the test-side guard now to unblock E2E runs promptly.
- Improve test fixtures & mocking:
  - Harden `test/e2e/manual-overlay-page.spec.ts` to stub Paperless API endpoints strictly and avoid relying on DB-managed fixtures where possible.
  - Add a short smoke unit test that verifies the island uses `original_url` when available (contract test under `test/contracts/overlay-viewer.contract.test.js`).
- Documentation & PR:
  - Document the UI contract (data-testids and events) in `docs/UI_CONTRACTS.md` (or append to existing overlay docs).
  - Open a PR with the tests and UI changes; request review from `frontend-design-auditor` + `qa` and note this handoff in the PR description.

[context_you_must_read]
- run-active (latest infra/test run summary)
- views/manual.ejs
- src/islands/OverlayViewerIsland.tsx
- test/islands/overlay-viewer.event.test.js
- test/contracts/overlay-viewer.contract.test.js
- test/e2e/manual-overlay-page.spec.ts
- test/e2e/global-setup.js

[acceptance_criteria]
- Playwright E2E `test/e2e/manual-overlay-page.spec.ts` passes on provisioned infra for **3 consecutive runs** without flakiness.
- Unit + contract tests added/updated to assert island event handling and `original_url` preference and pass locally.
- Stable `data-testid` attributes added and audited (unique on page) and used by Playwright tests.
- PR created with tests and UI contract documentation; reviewers assigned and initial feedback addressed.

[notes]
- The immediate E2E blocker is an initial setup modal showing on the app instance; prefer implementing a test-side safeguard (auto-close in `global-setup`) so tests can be re-run immediately while infra config (PAPERLESS_AI_INITIAL_SETUP) is corrected separately by implementer/infra.
- If you need it, I can implement the guarded test-change (close modal in global-setup) and add the Playwright assertions in a follow-up patch.  

[notification]
- timestamp: 2026-01-25T18:35:00Z
- to: frontend-design-router
- message: |
    Hello @frontend-design-router,

    Please pick up the OverlayViewer handoff assigned in this memory.

    Tasks (high priority):
    - Validate `src/islands/OverlayViewerIsland.tsx` listens for `overlay:document-changed` and prefers `original_url`/`originalUrl` when present.
    - Add/confirm stable `data-testid` hooks: `overlay-viewer-island`, `overlay-page-indicator`, and stable controls (`#nextPage`, `#prevPage` or testids).
    - Extend unit tests and Playwright E2E to assert island mounts, responds to events, updates page indicator on nav, and preserves `original_url` preference.
    - Implement a non-invasive test-side safeguard to auto-close the initial setup modal during E2E (e.g., detect and close it in `test/e2e/global-setup.js`). Do not change production behavior.

    Context: run-active (latest infra/test run summary), `views/manual.ejs`, `src/islands/OverlayViewerIsland.tsx`, `test/e2e/manual-overlay-page.spec.ts`, `test/e2e/global-setup.js`.

    Acceptance: Playwright E2E `test/e2e/manual-overlay-page.spec.ts` passes 3 consecutive runs; unit/contract tests added and passing; PR opened with reviewers assigned.

    Thanks,
    GitHub Copilot
- notified_by: GitHub Copilot
- status: awaiting_pickup

