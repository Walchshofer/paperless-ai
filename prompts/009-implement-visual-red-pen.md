---
name: implement-visual-red-pen
stage: 050-implement
agent: implement-agent
prompt_id: 009-native-alpha-9-visual-interaction
---

<objective>
Implement the "Red Pen" interactive search tool within the 
`OverlayViewerIsland`. Enable users to draw bounding boxes to trigger 
320-dim Visual RAG searches via the ColQwen3-4B-AWQ sidecar.
</objective>

<context>
The layout is established (Prompt 008) and the API is ready (Prompts 005-006). 
We now implement the client-side interaction logic that bridges the visual 
canvas to the MaxSim retrieval system on the RTX 3090 Ti.

**Hardware:** RTX 3090 Ti (Ampere SM86).
**Retrieval Logic:** Native MaxSim (Late Interaction).
**Architecture:** Preact Island Event Bus.
</context>

<requirements>
1. **Canvas Interaction (OverlayViewerIsland)**:
   - Implement a "Red Pen" mode using the HTML5 Canvas API.
   - **Interaction:** On `mousedown`, start a bounding box; on `mouseup`, 
     calculate coordinates and perform a client-side crop.
   - **Normalization:** Ensure the crop is normalized to the aspect ratio 
     expected by ColQwen3 (max 1,280 visual patches).

2. **Event Handshake (Cross-Island)**:
   - Convert the crop to a Base64 string.
   - Emit the `visual-search-requested` custom event.
   - **Payload:** `{ image: "base64...", collection: "visual_pages", filters: {} }`.

3. **Search Execution & Feedback (HistoryTabsIsland)**:
   - The "Similar" tab must listen for the search event.
   - Implement the **Alpha-9 Handshake**:
     - Display "GPU Initializing..." if the sidecar returns 503.
     - Display a progress bar for the MaxSim calculation latency.
   - **Hybrid SOT Feedback:** Include a "Confirm Match" button on results 
     which writes to the PostgreSQL `feedback_events` table for RLHF.

4. **UI/UX Guardrails**:
   - Provide a "Clear Pen" button to reset the canvas.
   - Handle "Low Quality" crops (e.g., very small boxes) by warning the user 
     before sending the request to save VRAM/compute.

5. **"Detox" Standards**:
   - Ensure the Preact component adheres to strict typing in 
     `OverlayViewerIsland.tsx`.
   - Lines must not exceed 79 characters in the logic sections.
</requirements>



<implementation>
- **Cropping:** Use an offscreen canvas for the `base64` extraction.
- **State Management:** Use the `useSignal` or `useState` hooks to manage 
  the active drawing state.
- **Communication:** Use `window.dispatchEvent` for the cross-island 
  communication to keep the components decoupled.
</implementation>

<output>
- `src/islands/OverlayViewerIsland.tsx` (Enhanced with Pen Logic)
- `src/islands/HistoryTabsIsland.tsx` (Enhanced with Result Rendering)
- `src/ui/contracts/VisualSearch.contract.ts` (New for Search payloads)
</output>

<verification>
- Draw a box around a logo/signature in the UI.
- Verify `visual-search-requested` event is fired with valid Base64.
- Confirm the "Similar" tab enters a loading state and renders MaxSim scores.
- Simulate an RTX 3090 Ti model swap and verify the "GPU Initializing" state.
</verification>

<lifecycle>
1. Generate summary: `prompts/summaries/009-visual-red-pen-summary.md`.
2. Update `docs/VISUAL_RAG_INTEGRATION.md` with the client-side event schema.
3. Move to `prompts/completed/`.
</lifecycle>