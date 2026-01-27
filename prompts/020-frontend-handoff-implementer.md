# Handoff: Frontend Visual-RAG Implementation (Auditor → Implementer)

[meta]
timestamp: 2026-01-25T00:00:00Z
agent: frontend-design-auditor
stage: 050-implement
prompt_ref: prompts/summaries/019-frontend-handoff-implementer.md

[summary]
This audit verifies the Manual, Chat (RAG), History, and Playground pages for Visual-RAG integration and frontend guardrails. Findings identify missing/incorrect wiring (original vs thumbnail rendering), legacy duplicate client-side code, missing test hooks (`data-testid`), missing `data-page` attributes, and Zod contract gaps. The file includes prioritized fixes and minimal patch suggestions for the implementer.

[findings]

## Blocker

1) Missing `data-page` on root tag — interferes with inventory crawling and consistent page identity
- Files: `views/manual.ejs`, `views/playground.ejs`, `views/history-document.ejs`, `views/rag.ejs`
- Evidence (excerpt):
  - `views/manual.ejs`: `<html lang="en" class="h-full" data-theme="light">` (no `data-page`)
  - `views/playground.ejs`: `<html lang="en" class="h-full" data-theme="light">`
  - `views/history-document.ejs`: `<html lang="en" data-theme="light">`
  - `views/rag.ejs`: `<html lang="en" data-theme="light">`
- Recommended fix: Add `data-page` attributes with stable page names, e.g. `data-page="manual"`.
- Minimal patch suggestion (example for `manual.ejs`): replace the `<html ...>` line with:

  `<html lang="en" class="h-full" data-theme="light" data-page="manual">`

## High

2) Legacy inline/dev fallback scripts duplicate island behavior in `views/manual.ejs` and should be removed or gated to test-only
- Files: `views/manual.ejs`
- Evidence: `initDevIslands()` fallback script injects island markup and attaches behavior (lines ~1136-1184) and there is inline overlay initialization and `public/js/components/OverlayViewer.js` is loaded
- Recommended fix: Remove the dev fallback from production templates. If needed for e2e skeletons, move into a test-only asset or load only when `NODE_ENV === 'test'`.
- Minimal patch suggestion: Remove the whole `initDevIslands()` `<script>` block and any inline `document.querySelectorAll('[data-island=...]')` wiring.

3) Legacy overlay implementation present and imported in pages (duplication with islands)
- Files: `public/js/components/OverlayViewer.js`, `public/js/components/OverlayLegend.js`, `views/manual.ejs` (imports)
- Evidence: `views/manual.ejs` imports `js/components/OverlayViewer.js` and contains inline logic in `Overlay Viewer Integration` section (lines ~820 onward)
- Recommended fix: Replace usage with island-based implementation (`overlay-viewer-island` / `OverlayViewerIsland`). Remove legacy imports and inline `Overlay Viewer Integration` code after islands are authoritative.
- Minimal patch suggestion: Remove imports:
  - `<script src="js/components/OverlayViewer.js"></script>`
  - `<script src="js/components/OverlayLegend.js"></script>`
  and replace page anchor with island anchor carrying `originalUrl` (see Contracts section below).

4) Overlay viewer uses thumbnails instead of ORIGINAL document images (Visual-RAG must use original document) — island change required
- Files: `src/islands/OverlayViewerIsland.tsx` (imageUrl uses `/thumb/${documentId}?page=${page}`)
- Evidence (excerpt):
  - `OverlayViewerIsland.tsx` -> `const imageUrl = documentId ? "/thumb/${documentId}?page=${page}" : null;`
- Recommended fix: Use original/high-resolution source (server exposes `/documents/{id}/download/original/`). Example:
  - `const imageUrl = documentId ? `/documents/${documentId}/download/original/?page=${page}` : null;`
- Minimal patch suggestion: Replace the thumb URL with the server original download path and ensure server-side proxies/headers allow cross-origin canvas read (CORS + crossOrigin attribute). Add config option if necessary.

5) `rag.ejs` (Chat/RAG) lacks visual overlay island and visual integration
- Files: `views/rag.ejs`
- Evidence: No `overlay-viewer-island` or other overlay anchor; chat relies only on text UI
- Recommended fix: Add `overlay-viewer-island` anchor (data-testid included) and surface `originalUrl` and `documentId` from `vm.*` so overlays can be used in RAG flows. Add logic to the chat UI to surface overlay search events (e.g., dispatch `visual-search-requested` or call `VisualSearchClient`).
- Minimal patch suggestion: Add anchor near chat results or on the side panel:
  `<div data-island="overlay-viewer-island" data-testid="overlay-viewer-island" data-props='<%= JSON.stringify({ documentId: vm.documentId, originalUrl: vm.original_url, page: vm.page || 1 }) %>'></div>`

## Medium

6) Missing or inconsistent `data-testid` on interactive elements used by Playwright and automation
- Files: `views/manual.ejs`, `views/history-document.ejs`, `views/rag.ejs`, `views/playground.ejs`
- Evidence (examples): view toggle buttons (`#viewTextBtn`, `#viewVisualBtn`) have IDs but no `data-testid`; `playground` island anchor has no `data-testid`; `rag` send button lacks `data-testid`.
- Recommended fix: Add stable `data-testid` attributes to all interactive elements required by tests. Examples: `data-testid="view-text-btn"`, `data-testid="view-visual-btn"`, `data-testid="playground-island"`, `data-testid="rag-send-button"`.
- Minimal patch suggestion: Add attributes next to existing IDs.

7) EJS templates reference non-`vm.*` variables (violates View Model Contract rule)
- Files: `views/manual.ejs` (uses `<%= version %>` in sidebar), `views/history-document.ejs` (`<%= paperlessUrl %>`), `views/setup.ejs` (many `<%= config.* %>`), template includes.
- Evidence: Grep results show `<%= version %>`, `<%= paperlessUrl %>`, `<%= config.* %>`.
- Recommended fix: Surface these values via the server-provided `vm` object: e.g., `vm.version`, `vm.paperlessUrl`, `vm.config.*`. Update server-side view rendering to set these fields.
- Minimal patch suggestion: Replace `<%= version %>` with `<%= vm.version %>` and ensure `controller` populates `vm.version`.

8) Zod view contracts missing required fields for islands
- Files: `src/ui/contracts/OverlayViewer.contract.ts`, `src/ui/contracts/ManualEditor.contract.ts` (and related contracts)
- Evidence: `OverlayViewer.contract.ts` only has { documentId, page } — missing `originalUrl`, `pageCount` fields required by handoff
- Recommended fix: Extend contracts to include optional `originalUrl: z.string().optional()` and `pageCount: z.number().int().optional()` and update all island prop types accordingly. Update server-side controller to include `vm.original_url` and `vm.page_count` where available.
- Minimal patch suggestion (OverlayViewer.contract.ts):

```ts
export const OverlayViewerSchema = z.object({
  documentId: z.number().int().nullable(),
  page: z.number().int().optional(),
  originalUrl: z.string().optional(),
  pageCount: z.number().int().optional(),
});
```

## Low

9) Minor accessibility and ARIA improvements
- Files: `src/islands/OverlayViewerIsland.tsx`, `src/islands/VisualAnnotationIsland.tsx`
- Evidence: Islands largely good but some roles/aria labels missing for interactive canvas controls; add aria-labels and ensure keyboard accessibility for draw mode toggles and annotations list.
- Recommended fix: Add `aria-controls`, `aria-pressed`, and keyboard handlers for core actions.
- Minimal patch suggestion: Add `tabIndex=0` and keyboard `onKeyDown` handlers for essential controls.

[acceptance_criteria ✅]
- Manual / Chat / History / Playground pages perform overlay search against ORIGINAL and render overlays.
- No legacy duplicate client-side code remains for overlay UI; island code is authoritative.
- All pages include `data-page` attributes and use `vm.*` view data for fields referenced by templates.
- Required `data-testid` anchors exist for Playwright tests.
- Zod view contracts expose `originalUrl` and `pageCount` for islands.

[implementation checklist 🔧]
1. Add `data-page` to the `<html>` tag in: `views/manual.ejs`, `views/playground.ejs`, `views/history-document.ejs`, `views/rag.ejs`.
2. Replace legacy overlay imports and inline overlay wiring in `views/manual.ejs` with `overlay-viewer-island` anchor and remove `public/js/components/OverlayViewer.js` usage.
3. Update `src/islands/OverlayViewerIsland.tsx` to use original download endpoint for images, and ensure `crossOrigin = 'anonymous'` is set for canvas readback.
4. Ensure `mountIslands(document)` is present on all pages (manual/playground/history already do; add to `rag.ejs` if missing) and add `data-testid` to all island anchors.
5. Remove or gate `initDevIslands()` and other inline dev fallbacks, moving them to a test-only helper asset if necessary.
6. Add overlay anchor to `views/rag.ejs` (Chat), wire the chat UI to dispatch or listen for `visual-search-requested` events and accept `visual_search` actions from server-side responses.
7. Update Zod contracts: `OverlayViewer.contract.ts` (+ other contracts where applicable) to include `originalUrl` and `pageCount`.
8. Add Playwright tests (under `test/e2e/visual-rag/*.spec.ts`):
   - Success: Reingest a Paperless doc and assert overlays rendered on ORIGINAL (data-testid checks).
   - Fallback: Mock sidecar 503 and assert `visual_503_fallback_text` banner shown and text fallback executed.
   - Position check: Fetch `visual_overlays` fixture and assert overlay DOM bounding boxes vs stored `box` using IoU tolerance.
9. Add small server-side changes to ensure `vm.*` contains `original_url`, `page_count`, `version` and other values that were previously rendered as non-vm globals.
10. Request re-run of this auditor on the PR. Attach Playwright artifact report and mapping to acceptance criteria.

[notes & risks ⚠️]
- Switching to ORIGINAL images may increase VRAM/network and slow rendering — add progressive loading and guard for very large files (downscale on server if necessary).
- Cross-origin canvas readback requires `crossOrigin` headers and server `Access-Control-Allow-Origin` if originals are served from different host; verify.

[next steps]
- Implementer: start with `views/manual.ejs` replacement and `src/islands/OverlayViewerIsland.tsx` change to use original; open a small PR with tests for the Manual viewer flow. Notify `frontend-design-auditor` for an audit re-check and `qa` for Playwright validation.

[handoff_done]
- Please include a short checklist in the PR description mapping back to acceptance criteria and add a `prompts/summaries/020-frontend-handoff-implementer.md` note of completion.

