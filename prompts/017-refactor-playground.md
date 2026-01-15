---
name: refactor-playground
stage: 050-implement
agent: implement-agent
prompt_id: 017-native-alpha-9-playground-refactor
---

<objective>
Refactor the "Playground" route to strictly adhere to the Native Protocol 
Alpha-9 architecture. Remove all proprietary AI code, modernize with 
Preact Islands, and transform the UI into a visual debugger for 
320-dim ColQwen3 retrieval and MaxSim scoring.
</objective>

<context>
The `/playground` route is currently a legacy artifact containing OpenAI/Azure 
references. This refactor "detoxes" the route, locks it to the 
**RTX 3090 Ti** local stack, and implements the Islands architecture 
mandated by `docs/FRONTEND_ARCHITECTURE.md`.

**Hardware:** RTX 3090 Ti (Ampere SM86).
**Retrieval SOT:** Unified Qdrant (320-dim).

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **Proprietary Code Removal (The Detox)**:
   - Edit `routes/setup.js`: Remove all imports/logic for `openaiService`, 
     `azureService`, and `customService`.
   - **Enforcement:** Hardcode the playground to use only `ollamaService` 
     (for text) and `VisualSearchClient.js` (for visual RAG).

2. **Modernize with Alpha-9 Islands**:
   - Create `src/islands/PlaygroundIsland.tsx` and its Zod contract.
   - **Feature: Visual Debugger:** Add a canvas area to the playground 
     allowing users to upload an image and draw a bounding box.
   - **Action:** Trigger `POST /api/visual-rag/search/visual` directly 
     from the playground.
   - **Display:** Show raw MaxSim scores and retrieval latency in a 
     dedicated "Hardware Telemetry" panel.

3. **Handshake Verification Logic**:
   - The Playground must explicitly handle the `503 Initializing` state. 
     If the sidecar is warming up the 4B-AWQ model, the UI must show the 
     "GPU Preparing" loader.

4. **Hybrid SOT Integration**:
   - Add a "Payload Inspector" to the playground results. This allows 
     viewing the Qdrant metadata (Correspondent, Tags) alongside the 
     visual result to verify **Expert Filtering** logic.

5. **"Detox" Standards**:
   - Apply strict 79-character line limits in `PlaygroundIsland.tsx`.
   - Ensure the Zod contract validates the 320-dim image constraints 
     before the request is emitted.
</requirements>



<implementation>
- **Island Registration:** Map `playground-island` in `src/islands/runtime.ts`.
- **Canvas Logic:** Reuse the "Red Pen" logic from `OverlayViewerIsland`.
- **API Bridge:** Use `VisualSearchClient.js` as the sole bridge to the sidecar.
</implementation>

<output>
- `routes/setup.js` (Detoxed)
- `src/islands/PlaygroundIsland.tsx`
- `src/ui/contracts/Playground.contract.ts`
- `views/playground.ejs` (Hydrated with Alpha-9 anchors)
</output>

<verification>
- **Manual Audit:** Verify the Model Selector only lists local Ollama models 
  and the "Native Sidecar."
- **Visual Search:** Upload a logo to the playground, draw a box, and 
  verify MaxSim results appear.
- **VRAM Check:** Monitor `nvidia-smi` to ensure playground searches 
  respect the 3.5GB sidecar baseline.
- **Contract Test:** Assert that the Zod schema rejects non-Base64 inputs.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/017-playground-refactor-summary.md`.
2. Update `docs/RAG_SYSTEMS_REFERENCE.md` with playground usage for developers.
3. Move to `prompts/completed/`.
</lifecycle>