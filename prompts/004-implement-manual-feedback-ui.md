---
name: implement-manual-feedback-ui
stage: 050-implement
agent: implement-agent
prompt_id: 004-native-alpha-9-manual-ui
---

<objective>
Implement the Native Protocol Alpha-9 Manual Feedback UI using Preact Islands. 
Enable granular feedback loops that synchronize metadata between the 
Manual Editor and the Qdrant Vector Store (320-dim) via the Hybrid SOT.
</objective>

<context>
The Manual Route is the core for RLHF (Reinforcement Learning from Human 
Feedback). Under the Alpha-9 standard, the UI must manage the hardware-aware 
handshake of the RTX 3090 Ti and ensure that "Confirm Match" actions trigger 
synchronous updates across PostgreSQL and Qdrant payloads.

**Hardware Profile:** RTX 3090 Ti (Ampere SM86).
**Hybrid SOT:** Postgres (Relational Metadata) + Qdrant (Vector Payloads).

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **FeedbackControls Island (Multimodal Feedback)**:
   - Create `src/islands/FeedbackControlsIsland.tsx`.
   - **Capability:** Implement Thumbs Up/Down for every metadata field.
   - **Alpha-9 Logic:** On "Thumbs Up," emit a `feedback:confirmed` event. 
     This event must trigger a payload update in Qdrant to improve 
     future "Expert Filtering" for this document's Correspondent/Tags.
   - **Visuals:** Include `data-testid` markers for every granular control.

2. **ManualEditor Island (Orchestrator UI)**:
   - Create `src/islands/ManualEditorIsland.tsx`.
   - **Responsibilities:** Provide the tabbed editor (Metadata, Content, 
     Fields, and AI Debug).
   - **Handshake Logic:** Listen for the **503 Initializing** state. If the 
     sidecar is warming up the ColQwen3 model, display a "GPU Initializing" 
     loader in the "AI Debug" tab instead of showing a connection error.
   - **Validation:** Use a Zod contract to ensure the `unifiedPayload` 
     matches the Alpha-9 schema before submission.

3. **Hybrid SOT Synchronization**:
   - The UI must ensure that a "Save" action updates Paperless-ngx 
     (Primary SOT) and immediately reflects those changes in the 
     **Qdrant Payload** via the orchestrator.

4. **Islands Runtime & Templates**:
   - Mount both islands in `views/manual.ejs` using `data-island` anchors.
   - Map both components in `src/islands/runtime.browser.tsx / src/islands/runtime.js` for hydration.

5. **"Detox" Standards**:
   - Adhere to the 79-character line limit for all TypeScript logic.
   - Use strict typing for the cross-island event bus (Custom Events).
</requirements>



<implementation>
- **Event Bus:** Use a unified `payload:ready` event that aggregates 
  metadata changes and granular feedback.
- **State Management:** Use `useSignal` for high-performance UI updates 
  during high-load GPU tasks.
- **Styling:** Use Tailwind CSS to ensure a responsive "Split Pane" 
  layout between the viewer and the editor.
</implementation>

<output>
- `src/islands/FeedbackControlsIsland.tsx`
- `src/islands/ManualEditorIsland.tsx`
- `src/ui/contracts/ManualEditor.contract.ts`
- `views/manual.ejs` (Modified for Alpha-9 hydration)
</output>

<verification>
- **Contract Test:** Run `npm test test/unit/contracts.spec.ts` to verify 
  unified payload structure.
- **E2E Test:** Use Playwright to verify that clicking "Save" emits 
  a payload containing both `document_updates` and `feedback_events`.
- **Sync Verification:** Confirm that a Correspondent change in the 
  UI triggers a `qdrant_payload_sync_total` metric increment.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/004-manual-feedback-ui-summary.md`.
2. Update `docs/FRONTEND_ARCHITECTURE.md` with the Alpha-9 feedback event schema.
3. Move to `prompts/completed/`.
</lifecycle>