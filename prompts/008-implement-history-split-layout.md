<objective>
Refactor the History Document View into Preact Islands: `OverlayViewerIsland` and `HistoryTabsIsland`, each validated by Zod contracts and mountable via `data-island` anchors.
This aligns the History Route with the Islands architecture for better testability and maintainability.
</objective>

<context>
Per `docs/FRONTEND_ARCHITECTURE.md`, History view interactive pieces should be implemented as islands. This prompt will create `src/islands/OverlayViewerIsland.tsx` and `src/islands/HistoryTabsIsland.tsx` and corresponding contracts under `src/ui/contracts/` and update `views/history-document.ejs` to mount them.

**References:**
- Architecture: `docs/FRONTEND_ARCHITECTURE.md`
- History Route Plan: `prompts/planning/HISTORY-ROUTE-ENHANCEMENT-PLAN.md`
</context>

<requirements>
1. **OverlayViewer Island**:
   - Create `src/islands/OverlayViewerIsland.tsx` and `src/ui/contracts/OverlayViewer.contract.ts`.
   - Props: `{ documentId: number, page?: number }` validated by Zod.
   - Responsibilities: load page image, render overlays, and expose methods/events for the Red Pen island to use.
   - Add `data-testid="overlay-viewer"` to the island root.

2. **HistoryTabs Island**:
   - Create `src/islands/HistoryTabsIsland.tsx` and `src/ui/contracts/HistoryTabs.contract.ts`.
   - Render tabs: Text, Metadata, Similar. The Similar tab will accept search results and render them.
   - Add `data-testid="history-tabs"` to the island root.

3. **Template Integration**:
   - Replace the existing single `<pre>` content area in `views/history-document.ejs` with a split layout that mounts the two islands:
     ```html
     <div class="grid md:grid-cols-5 gap-4">
       <div class="md:col-span-3" data-island="overlay-viewer-island" data-testid="overlay-viewer" data-props='<%- JSON.stringify({ documentId, page: 1 }) %>'></div>
       <div class="md:col-span-2" data-island="history-tabs-island" data-testid="history-tabs" data-props='<%- JSON.stringify({ documentId, content }) %>'></div>
     </div>
     ```
   - **Registry**: Register `OverlayViewerIsland` and `HistoryTabsIsland` in `src/islands/runtime.ts` mapping to `overlay-viewer-island` and `history-tabs-island`.

4. **Testing & Automation**:
   - Add Zod contract unit tests and an E2E skeleton that verifies `data-testid` values and that tabs render correctly.
   - Ensure `history-tabs-island` has `data-testid` for each tab (e.g., `data-testid="tab-similar"`).

5. **Documentation**:
   - Update prompt content and add example `data-island` mounting snippets to `prompts/008-implement-history-split-layout.md`.
</requirements>

<implementation>
- Islands must validate props at mount using Zod and throw console warnings on invalid props.
- Ensure `overlay-viewer-island` exposes an API (custom events) for the Red Pen island to request crops and triggers search calls.
</implementation>

<output>
- `src/islands/OverlayViewerIsland.tsx` (Created)
- `src/ui/contracts/OverlayViewer.contract.ts` (Created)
- `src/islands/HistoryTabsIsland.tsx` (Created)
- `src/ui/contracts/HistoryTabs.contract.ts` (Created)
- `views/history-document.ejs` (Updated to mount islands and include `data-testid` attributes)
- `test/e2e/history_islands.spec.js` (Created - E2E skeleton)
</output>

<verification>
- Unit: Run contract tests for OverlayViewer and HistoryTabs contracts.
- E2E: Run the history islands spec and assert `data-testid="overlay-viewer"` and `data-testid="history-tabs"` exist and that `tab-similar` can accept and render a stubbed result set.
- Manual: Open a history document and verify the split layout renders and islands mount in their respective anchors.
</verification>