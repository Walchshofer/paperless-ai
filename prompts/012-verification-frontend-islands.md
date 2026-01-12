---
name: verification-frontend-islands
stage: 060-test
agent: test-agent
prompt_id: 012-native-alpha-9-frontend-verification
---

<objective>
Verify the Native Protocol Alpha-9 Islands architecture. Validate that 
Island anchors, Zod contracts, and the cross-island MaxSim event bus 
function deterministically across the History Route.
</objective>

<context>
The project utilizes the Islands pattern to decouple high-fidelity visual 
tasks from metadata management. This verification ensures that the 
RTX 3090 Ti's state is correctly reflected in the UI and that 320-dim 
visual fragments are validated before being sent to the sidecar.

**Architecture:** Preact Islands + Zod Contracts + Custom Event Bus.
**Hardware Baseline:** RTX 3090 Ti (Ampere SM86).
</context>

<requirements>
1. **Contract & Dimension Validation**:
   - Every `*.contract.ts` must include a Zod schema that validates 
     **Base64 image strings** and **320-dim aspect ratio** parameters.
   - Assert that `OverlayViewerIsland` props correctly handle the 
     Alpha-9 `visual_fragments` schema.

2. **Cross-Island Event Handshake**:
   - Verify the `visual-search-requested` event bus. 
   - **Test Case:** Emitting an event from `OverlayViewer` must trigger 
      a loading state in `HistoryTabsIsland`.

3. **Alpha-9 UI Resilience**:
   - Verify the "GPU Initializing" UI state. 
   - **Check:** When the Node.js API returns a `SIDECAR_INITIALIZING` (503), 
     the `HistoryTabsIsland` must render the specific Alpha-9 loader, 
     not a generic error.

4. **Islands Runtime Audit**:
   - Ensure `src/islands/runtime.ts` correctly maps all Alpha-9 islands:
     - `overlay-viewer-island`
     - `history-tabs-island`
     - `expert-filter-island` (if applicable)

5. **Telemetry & Testing**:
   - Implement an inventory Playwright job that extracts `data-island` 
     anchors and confirms `data-testid` coverage for the "Red Pen" tools.
</requirements>



<implementation>
- **Unit Tests:** `test/unit/frontend/contracts.spec.ts` (Zod validation).
- **Integration Tests:** `test/integration/island-handshake.spec.ts` 
  (Mocking the Custom Event Bus).
- **E2E Inventory:** `test/e2e/ui-inventory-alpha9.spec.ts` 
  (Extracting `data-props` and verifying 320-dim compliance).
- **Standards:** Apply "Detox" formatting; no line in `.tsx` files 
  should exceed 79 characters in logic blocks.
</implementation>

<output>
- `test/unit/frontend/contracts.spec.ts`
- `test/e2e/ui-inventory-alpha9.spec.ts`
- `scripts/check-islands-alpha9.js`
- `prompts/summaries/012-frontend-verification-summary.md`
</output>

<verification>
- Run Contract Audit: `npm test test/unit/frontend/contracts.spec.ts`.
- Run Handshake Verification: `npm test test/integration/island-handshake.spec.ts`.
- Run Playwright Inventory: `npx playwright test test/e2e/ui-inventory-alpha9.spec.ts`.
- **Criteria:** 100% of islands must validate props; 503 UI state must be 
  verified via mock injection.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/012-frontend-verification-summary.md`.
2. Move to `prompts/completed/` after 100% island hydration pass.
</lifecycle>