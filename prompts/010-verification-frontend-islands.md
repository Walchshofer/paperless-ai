# Verification: Frontend Islands & Contracts

<objective>
Ensure Island anchors, Zod contracts, and `data-testid` coverage are implemented and testable; provide automated checks that prevent staleness and contract drift.
</objective>

<context>
The project is adopting the Islands pattern and Zod contracts per docs/FRONTEND_ARCHITECTURE.md. This prompt defines verification steps and test artifacts to ensure contracts and mounts remain correct.
References: docs/FRONTEND_ARCHITECTURE.md
</context>

<requirements>
1. `src/ui/contracts/*.contract.ts` must exist for every island and export a Zod schema.
2. Views must render `data-island` anchors with `data-props` JSON and `data-testid` attributes for interactive elements.
3. Playwright available to run an inventory crawler and baseline comparisons.
</requirements>

<implementation>
- Add unit tests per contract that assert valid example props parse and invalid props throw.
- Implement an inventory Playwright job `test/crawl/ui-inventory.spec.ts` that extracts `data-island` and `data-testid` and diffs against `tests/baselines/ui-inventory.json`.
- Add server-side VM validation middleware that validates `vm` against the exported Zod schema and logs parsing errors with `request_id`.
</implementation>

<output>
- `test/unit/contracts.spec.js` (Created)
- `test/crawl/ui-inventory.spec.ts` (Created)
- `scripts/check-islands.js` (Created)
</output>

<verification>
- Unit tests: all Zod schemas accept valid example props and reject invalid props.
- Inventory: Playwright crawler yields the expected islands and `data-testid` values matching the baseline.
- Server: Rendering a view with malformed `vm` results in a logged parsing error and a 500 response in dev/test modes.
</verification>

<lifecycle>
1. Add the inventory crawler to nightly runs and the unit checks to `verification-fast` CI job.
2. Update baselines when islands are added or intentionally changed; require PR to include updated baseline and rationale.
3. Archive prompt in `prompts/completed/` and add a summary to `prompts/summaries/` after CI integration.
