to_agent: implement-agent
what_to_do_next:
- Implement wheel-to-zoom (including Ctrl/Cmd for fine control) and support touchpad gestures
- Implement pan clamping so document cannot be panned offscreen; ensure Reset fits viewport
- Implement keyboard shortcuts (+/- for zoom, 0/r to reset, Space to toggle pan, arrow keys to nudge pan when pan mode active)
- Add unit tests for coordinate transform math (getRelativePosition inverse) and corner cases
- Add Playwright E2E tests that validate zoom (toolbar + wheel), pan (drag + clamping), and selection capture correctness under zoom/pan

context_you_must_read:
- Memory: `run-active`
- Files: `src/islands/OverlayViewerIsland.tsx`, `src/islands/runtime.js`, `test/islands/overlay-viewer.zoom.test.js`

acceptance_criteria:
- All listed features implemented and covered by tests (unit + Playwright E2E)
- Playwright E2E passes reliably in CI for overlay viewer flows
- `run-active` memory updated to document run-state and completion

who: implement-agent