<!-- STARTED: 2026-01-07 - lifecycle initiated (scaffolding & tests) -->

<objective>
Implement Preact Islands for feedback controls and the unified manual editor: `FeedbackControlsIsland` and `ManualEditorIsland`, each with Zod contracts and `data-testid` markers for automated auditing.
This aligns Manual UI behavior with `docs/FRONTEND_ARCHITECTURE.md` (Islands, Zod contracts, data-island mounting strategy).
</objective>

<context>
Moving interactive bits into islands improves testability and reduces fragile inline scripts. This prompt details creation of `src/islands/FeedbackControlsIsland.tsx`, `src/islands/ManualEditorIsland.tsx` and accompanying Zod contracts in `src/ui/contracts/`.

**References:**
- Architecture: `docs/FRONTEND_ARCHITECTURE.md`
- Manual Route Plan: `prompts/planning/MANUAL-ROUTE-UI-ENHANCEMENT-PLAN.md`
</context>

<requirements>
1. **Feedback Controls Island**:
   - Create `src/islands/FeedbackControlsIsland.tsx` and `src/ui/contracts/FeedbackControls.contract.ts`.
   - UI: Thumbs Up / Thumbs Down per card (Tags, Custom Fields, Summary). Each control emits an event (`feedback:updated`) with `{ component, feedback_type }`.
   - Elements must include `data-testid` attributes (e.g., `data-testid="thumbs-up-tags"`).

2. **Manual Editor Island**:
   - Create `src/islands/ManualEditorIsland.tsx` and `src/ui/contracts/ManualEditor.contract.ts`.
   - Responsibilities: provide the tabbed editor (Metadata, Content, Fields), validate inputs against a Zod contract at save time, and expose a `getUnifiedPayload()` method or event `payload:ready` that returns the unified payload.
   - Add `data-testid` attributes for tabs and important controls.

3. **Template Integration**:
   - Update `views/manual.ejs` to add anchors for the islands:
     - `<div data-island="feedback-controls-island" data-testid="feedback-controls-island" data-props='<%- JSON.stringify({ documentId: vm.documentId || null }) %>'></div>`
     - `<div data-island="manual-editor-island" data-testid="manual-editor-island" data-props='<%- JSON.stringify({ documentId: vm.documentId || null }) %>'></div>`
   - **Registry**: Register both `FeedbackControlsIsland` and `ManualEditorIsland` in `src/islands/runtime.browser.tsx / src/islands/runtime.js` mapping to their respective IDs (`feedback-controls-island`, `manual-editor-island`).

4. **Testing**:
   - Add contract unit tests for `FeedbackControls` and `ManualEditor`.
   - Add E2E test skeleton verifying `data-testid` presence and that `payload:ready` event provides the unified payload when Save is clicked.

5. **Accessibility & Auditability**:
   - Ensure all interactive elements have `aria-*` where appropriate and `data-testid` for Playwright crawling.
</requirements>

<output>
- `src/islands/FeedbackControlsIsland.tsx` (Created)
- `src/ui/contracts/FeedbackControls.contract.ts` (Created)
- `src/islands/ManualEditorIsland.tsx` (Created)
- `src/ui/contracts/ManualEditor.contract.ts` (Created)
- `views/manual.ejs` (Updated to include islands)
- `test/e2e/manual_save_payload.spec.js` (Created - E2E skeleton)
</output>

<verification>
- Unit: Run contract tests for Feedback and ManualEditor contracts.
- E2E: Run the Save flow skeleton and confirm `data-testid="manual-editor-island"` and that `payload:ready` yields the unified payload.
- Manual: Toggle thumbs up/down and confirm they are present in the unified payload before submission.
</verification>
