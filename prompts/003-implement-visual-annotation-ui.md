---
name: implement-visual-annotation-ui
stage: 050-implement
agent: implement-agent
prompt_id: 003-native-alpha-9-visual-ui
---

<objective>
Implement the "VisualAnnotationIsland" using Preact and Zod. This island 
replaces legacy scripts in the Manual Route to provide a high-fidelity 
"Red Pen" tool capable of capturing 320-dim visual fragments for 
ColQwen3-grounded analysis on the RTX 3090 Ti.
</objective>

<context>
Following `docs/FRONTEND_ARCHITECTURE.md`, we are moving to a decoupled 
Islands architecture. This island bridges the user's visual intent to the 
**Native Protocol Alpha-9** backend, ensuring that bounding boxes are 
normalized for the ColQwen3 model's 1,280 visual patch limit.

**Hardware:** RTX 3090 Ti (Ampere SM86).
**Protocol:** 320-dim Vector Normalization.

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **VisualAnnotation Island (Preact)**:
   - Create `src/islands/VisualAnnotationIsland.tsx`.
   - **Capability:** Implement a "Red Pen" mode using an HTML5 Canvas overlay.
   - **Normalization:** Ensure that captured bounding boxes are converted to 
     normalized image coordinates (0.0 to 1.0) before being sent to the 
     `POST /api/visual-rag/feedback` endpoint.
   - **Constraint:** The UI must handle aspect ratio normalization to 
     match the ColQwen3 processor's requirements.

2. **Zod Contract & Payload Mirroring**:
   - Create `src/ui/contracts/VisualAnnotation.contract.ts`.
   - **Schema:** Validate `documentId`, `page`, and an array of `annotations`.
   - **Alpha-9 Sync:** The contract must ensure that annotations include 
     a `label` field, which will be mirrored as a `tag_id` in the 
     Qdrant vector payload.

3. **Handshake & Feedback UI**:
   - The island must listen for the **503 Initializing** state from the 
     sidecar. If the user attempts an "AI Verify" on a crop while the 
     RTX 3090 Ti is warming up the 4B-AWQ model, show a "GPU Preparing" loader.
   - Implement "Confirm Match" buttons for each annotation to trigger the 
     **Hybrid SOT** update (Postgres + Qdrant).

4. **Template Integration & Registry**:
   - Mount the island in `views/manual.ejs` using the `data-island` anchor.
   - Map `visual-annotation-island` in `src/islands/runtime.browser.tsx / src/islands/runtime.js`.

5. **"Detox" Standards**:
   - Adhere to the 79-character line limit for all TypeScript logic.
   - Ensure strict typing for all Preact hooks and event handlers.
</requirements>



<implementation>
- **Island Registration:** Ensure the island is registered in the 
  client-side runtime for hydration.
- **Event Bus:** Use custom DOM events (`annotation:created`, 
  `visual-search:trigger`) to communicate with the orchestrator.
- **Canvas Logic:** Use an offscreen canvas for high-performance crop 
  extraction if the "Preview Match" feature is enabled.
</implementation>

<output>
- `src/islands/VisualAnnotationIsland.tsx`
- `src/ui/contracts/VisualAnnotation.contract.ts`
- `views/manual.ejs` (Modified for Island mounting)
- `src/islands/runtime.browser.tsx / src/islands/runtime.js` (Updated registration)
</output>

<verification>
- **Contract Test:** Run `npm test test/unit/contracts.spec.ts` to verify 
  Zod schema enforcement.
- **E2E Test:** Use Playwright to verify `data-testid="visual-annotation-island"` 
  mounts and that drawing a box emits a valid 320-dim-ready payload.
- **Hardware Check:** Verify that the UI remains responsive on the 
  RTX 3090 Ti even during model load (503 state).
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/003-visual-annotation-ui-summary.md`.
2. Update `docs/FRONTEND_ARCHITECTURE.md` to reflect the new island event schema.
3. Move to `prompts/completed/`.
</lifecycle>