---
name: implement-history-split-layout
stage: 050-implement
agent: implement-agent
prompt_id: 008-native-alpha-9-islands-refactor
---

<objective>
Refactor the History Document View into Preact Islands: `OverlayViewerIsland` 
and `HistoryTabsIsland`. Align the frontend with Native Protocol Alpha-9 by 
enabling 320-dim Visual RAG interactions and MaxSim-grounded "Similar" search.
</objective>

<context>
The History Route is being upgraded to support the **Native Protocol Alpha-9** standard. This requires a split layout where the left pane (Visual) can 
trigger retrieval requests and the right pane (Tabs) can render high-fidelity 
MaxSim results from the Python Sidecar (:8001).

**Hardware:** RTX 3090 Ti.
**Architecture:** Preact Islands + Zod Contracts + Unified Qdrant.
</context>

<requirements>
1. **OverlayViewerIsland (Visual Core)**:
   - Create `src/islands/OverlayViewerIsland.tsx` and its Zod contract.
   - **Capability:** Render base64 page images and Alpha-9 visual fragments.
   - **Interaction:** Implement the "Red Pen" selector. On selection, emit 
     a `visual-search-requested` custom event containing the crop's base64 data.
   - **Constraint:** Must handle 320-dim aspect ratio normalization for ColQwen3.

2. **HistoryTabsIsland (Result Orchestrator)**:
   - Create `src/islands/HistoryTabsIsland.tsx` and its Zod contract.
   - **Tabs:** Text, Metadata, and **Similar (Alpha-9)**.
   - **Similar Tab Logic:** - Listen for `visual-search-requested`.
     - Trigger `POST /api/visual-rag/search/visual` via `VisualSearchClient.js`.
     - **Handshake:** Display a "GPU Initializing..." loader if the sidecar 
       returns `503 Initializing` (RTX 3090 Ti model load state).
     - **Rendering:** Render MaxSim scores and document thumbnails.

3. **Hybrid SOT Integration**:
   - Ensure the `HistoryTabsIsland` metadata tab reflects the current 
     PostgreSQL SOT while allowing "Filter by this Correspondent" which 
     updates the `Payload` filter for subsequent visual searches.

4. **Template & Layout**:
   - Update `views/history-document.ejs` to use a responsive grid layout.
   - Implement "Detox" standards: Ensure no inline scripts exceed 
     maintainability limits; use the `data-props` pattern for island hydration.
</requirements>



<implementation>
- **Hydration:** Register islands in `src/islands/runtime.ts`.
- **Error Handling:** Gracefully handle 5-second timeouts with a "Visual 
  Search Unavailable" fallback message (Text RAG fallback).
- **Styling:** Use Tailwind CSS for the 5-column grid (3 for Visual, 2 for Tabs).
</implementation>

<output>
- `src/islands/OverlayViewerIsland.tsx`
- `src/islands/HistoryTabsIsland.tsx`
- `src/ui/contracts/OverlayViewer.contract.ts`
- `views/history-document.ejs` (Hydrated with Alpha-9 anchors)
</output>

<verification>
- **Contract Test:** Validate Zod schemas with malformed document IDs.
- **E2E Test:** Verify that selecting a region in `OverlayViewer` correctly 
  populates the "Similar" tab with MaxSim-scored results.
- **Resilience:** Simulate sidecar 503 and verify the "GPU Initializing" 
  UI state appears.
</verification>

<lifecycle>
1. Generate summary: `prompts/summaries/008-history-split-layout-summary.md`.
2. Update `docs/FRONTEND_ARCHITECTURE.md` to reflect the Alpha-9 event bus.
3. Move to `prompts/completed/`.
</lifecycle>