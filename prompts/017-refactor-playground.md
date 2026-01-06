<objective>
Refactor the "Playground" route and UI to strictly adhere to the "Local Only" policy and "Frontend Islands" architecture.
This involves removing all proprietary AI service code (OpenAI, Azure) from the playground route and converting the legacy EJS/jQuery UI into a Preact Island.
</objective>

<context>
The current `/playground` route (`setup.js`) and UI (`playground.ejs`) are legacy artifacts.
1. They import and use `openaiService` and `azureService`, violating the project's strict "Local Only / Ollama" constraint.
2. They use monolithic EJS + Vanilla JS, violating the `docs/FRONTEND_ARCHITECTURE.md` mandate for "Preact Islands" and "Zod Contracts".
This prompt remediates these compliance gaps.
</context>

<requirements>
1. **Remove Proprietary Models**:
   - Edit `paperless-ai/routes/setup.js`:
     - Remove imports for `openaiService`, `azureService`, `customService`.
     - In `POST /manual/playground`, REMOVE the logic branches that call these services.
     - Hardcode or strictly enforce that ONLY `ollamaService` (or the local `visual-rag` sidecar) can be used.
     - Remove any UI selectors that allow choosing OpenAI/Azure.

2. **Modernize Frontend (Islands Architecture)**:
   - Create `src/islands/PlaygroundIsland.tsx` and `src/ui/contracts/Playground.contract.ts`.
   - The Island should replicate the existing Playground functionality:
     - Input: Document text/JSON.
     - Input: Custom Prompt.
     - Action: "Analyze" button.
     - Output: Display the JSON result from Ollama.
   - Update `views/playground.ejs`:
     - Remove legacy script tags (`playground.js`, `playground-analyzer.js`).
     - Mount `<div data-island="playground-island" ...>`.

3. **Feedback Alignment**:
   - Ensure the "Analyze" action uses the standard `ollamaService.analyzePlayground` (which must be verified to be local).
   - If the playground supports "Saving" the result as a correction, it must use the `feedback_events` table (via `FeedbackService`), not an ad-hoc method. If this feature is complex, scope it to "Analysis Only" for this refactor.

4. **Testing**:
   - Add Zod contract tests.
   - Add an E2E test verifying the Playground loads and executes a query using Ollama.
</requirements>

<implementation>
- **Safe Deletion**: When removing `openaiService` references, ensure no other critical routes rely on them (the audit suggests they are primarily used in legacy/manual paths).
- **Zod Schema**: The `Playground.contract.ts` should define the shape of the initial data (e.g., list of available models, default prompt).
</implementation>

<output>
- `paperless-ai/routes/setup.js` (Refactored)
- `src/islands/PlaygroundIsland.tsx` (Created)
- `src/ui/contracts/Playground.contract.ts` (Created)
- `views/playground.ejs` (Updated)
- `test/e2e/playground_refactor.spec.js` (Created)
</output>

<verification>
- **Manual**: Visit `/playground`. Verify no "OpenAI" options exist. Run an analysis; verify it hits Ollama.
- **Code**: Grep `routes/setup.js` for `require('../services/openaiService.js')` - must be empty.
- **E2E**: Run `playground_refactor.spec.js` to assert Island mounting and basic functionality.
</verification>
