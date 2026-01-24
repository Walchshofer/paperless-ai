P0.0 Playwright Artifacts

This folder is the canonical place to store Phase 0 Playwright artifacts for the shadcn/ui compatibility run.

Note: the automated scripts may copy artifacts here when run:
- `node scripts/collect-playwright-report.js` will copy the HTML report and screenshots into this folder.

Local artifact locations (if not copied here):
- Playwright HTML report: `test-results/playwright-report/index.html`
- Extracted report (zip): `test-results/playwright-report.zip` (if extracted via `scripts/extract-playwright-report.js`)
- Screenshots: `test-results/playwright-shadcn-compat/screenshot-after-interactions.png`

Measured sizes (from verification):
- `public/js/dist/island-runtime.js` — 74,033 bytes (gzipped: 21,873 bytes)
- `public/css/tailwind.css` — 27,770 bytes (gzipped: 5,460 bytes)

If you want the HTML report embedded here, run:

  node scripts/extract-playwright-report.js
  node scripts/collect-playwright-report.js

and commit the generated files under `docs/settings/artifacts/p0.0/playwright-report`.