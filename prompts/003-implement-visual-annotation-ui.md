<objective>
Create a Preact "VisualAnnotation" Island component and Zod contract, then integrate it via the Islands mounting strategy into the Manual UI (`manual.ejs`).
This replaces the previous inline script approach with a mountable island that provides the Red Pen drawing tool in the Manual Route Visual Preview.
</objective>

<context>
Per `docs/FRONTEND_ARCHITECTURE.md`, complex interactive UI should be implemented as Preact Islands and validated with Zod contracts. This prompt implements `VisualAnnotationIsland.tsx` and `src/ui/contracts/VisualAnnotation.contract.ts` and updates `manual.ejs` to include a `data-island` anchor and `data-testid` values for automated auditing.

**References:**
- Architecture: `docs/FRONTEND_ARCHITECTURE.md`
- Manual Route Plan: `prompts/planning/MANUAL-ROUTE-UI-ENHANCEMENT-PLAN.md`
</context>

<requirements>
1. **Island Component**:
   - Create `src/islands/VisualAnnotationIsland.tsx` (Preact component, default export).
   - Component props must conform to a Zod schema exported from `src/ui/contracts/VisualAnnotation.contract.ts`.
   - Component responsibilities: mount `OverlayViewer` (or accept an existing viewer), provide Draw Mode toggle, capture bbox in natural image coordinates, display persistent overlays, and emit events for saved annotations.

2. **Zod Contract**:
   - Create `src/ui/contracts/VisualAnnotation.contract.ts` and export a Zod schema describing `{ documentId: number, page?: number, initialAnnotations?: Annotation[] }` where `Annotation = { bbox: [x,y,w,h], comment?: string, page?: number }`.
   - Add a Type export for the contract (`export type VisualAnnotationContract = z.infer<typeof VisualAnnotationSchema>`).

3. **Template Integration**:
   - Update `views/manual.ejs` to add an island anchor:
     `<div data-island="visual-annotation-island" data-testid="visual-annotation-island" data-props='<%- JSON.stringify({ documentId: vm.documentId || null }) %>'></div>`
   - Ensure the island anchor is placed in the Visual Preview area and that `OverlayViewer` continues to be used or is delegated to the island.

4. **Testing & Test IDs**:
   - Add `data-testid` attributes to interactive elements inside the island (e.g., draw-toggle, save-annotation-btn).
   - Add unit tests for the Zod contract (`test/contracts/visual-annotation.contract.test.js`) and a small integration test skeleton for the island (Playwright or Cypress) that asserts DOM mount and `data-testid` presence.

5. **Accessibility & Responsiveness**:
   - Ensure keyboard accessibility for toggles and that the bounding box logic works with touch and mouse.

6. **Documentation**:
   - Update `prompts/003-implement-visual-annotation-ui.md` with the island/component/contract plan and add `output` and `verification` sections per the prompt template.
</requirements>

<implementation>
- Prefer a minimal Preact component that mounts into the anchor and validates `data-props` against the Zod schema at mount time, rejecting invalid props with a console warning.
- Keep the island self-contained: it should import `OverlayViewer` from `public/js/components/OverlayViewer.js` if needed, but it can also implement a minimal canvas if simpler.
- Export a small event API: custom DOM events `annotation:created`, `annotation:deleted`, `annotations:save`.
</implementation>

<output>
- `src/islands/VisualAnnotationIsland.tsx` (Created)
- `src/ui/contracts/VisualAnnotation.contract.ts` (Created)
- `views/manual.ejs` (Updated to include `data-island` anchor)
- `test/contracts/visual-annotation.contract.test.js` (Created - Zod contract tests)
- `test/e2e/manual_visual_annotation.spec.js` (Created - E2E skeleton checks `data-testid` presence)
</output>

<verification>
- Unit: `npm test -- test/contracts/visual-annotation.contract.test.js` (Zod schema validation tests should pass).
- Integration: Run E2E skeleton (`npm run test:e2e -- test/e2e/manual_visual_annotation.spec.js`) to assert the island mounts and `data-testid="visual-annotation-island"` exists.
- Manual: Open Manual UI, enable Draw Mode (via toggle), draw a bounding box, enter comment, and verify `annotation:created` events are emitted with bbox normalized to image natural size.
</verification> 
