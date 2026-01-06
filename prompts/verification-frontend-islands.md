# Verification: Frontend Islands & Contracts

Goal: Verify the Islands pattern, runtime mounting, and contract/runtime validation are implemented and that interactive elements have testable identifiers.

Checks:

- Island Anchors & Mounting
  - Verify views include `data-island` anchors where expected (e.g., `data-island="visual-annotation"`).
  - Verify `data-props` are JSON-serializable and match the Zod contract shapes.
  - Confirm the island runtime (`src/islands/runtime.ts` or `public/js/dist/island-runtime.js`) mounts islands on page load.

- Zod Contracts
  - Confirm `src/ui/contracts/*.contract.ts` files exist for each island (e.g., `VisualAnnotation.contract.ts`, `ManualEditor.contract.ts`).
  - Validate example props against the Zod schema in a unit test: `expect(schema.parse(props)).to.not.throw`.
  - Confirm server-side controller validates `vm` before rendering the view.

- Data-TestIDs & Element Identity
  - Confirm every interactive element has a `data-testid` attribute following `kebab-case` convention.
  - Run the Playwright inventory crawler to extract `data-testid` and compare against baseline.

- Build/Runtime Checks
  - If using Vite bundling: check `dist` artifacts include island bundles (`*.island.js`).
  - Verify islands are mountable without a bundler in dev (script tag import method).

Suggested Tests (Automated / Manual):

- Unit: For each contract file, add tests that assert invalid props throw and valid props parse.
- Integration: Render the EJS view in a test harness (or use Playwright) and assert island anchors are present, props are valid JSON, and after `mountIslands()` runs, the island’s root contains expected DOM nodes.
- Auditing: Add a Playwright script that collects `data-island` and `data-testid` values and diffs against `tests/baselines/ui-inventory.json`.

Notes:
- Keep `data-props` minimal; pass ids and small payloads, not entire documents.
- Log parsing/validation errors to the server-side logs with `request_id` and `page` context for observability.