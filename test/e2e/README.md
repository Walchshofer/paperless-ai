# E2E Helpers and Conventions for Overlay Viewer 🧪

This file documents a small, *test-only* DOM helper used by `test/e2e/manual-overlay-page.spec.ts` to make the island behavior observable in the Playwright environment.

What the helper does:

- Listens for `overlay:document-changed` events and attaches a lightweight `<img data-testid="document-image">` to the island root when an `originalUrl` or `documentId` is provided.
- Updates a page indicator inside the island root (it looks for `[data-testid="overlay-page-indicator"]` inside the island root and updates its text when an `overlay:document-changed` event is received).

Why it exists:

- In the integration test environment the island may not perform the same image-loading logic as in production; this helper provides a reliable way for E2E tests to assert that the island reacts to events and constructs image URLs correctly.

Removal criteria:

- The helper should be removed once the island's production behavior is reliably exercised by Playwright without shims (i.e., the island performs image loads in CI and event wiring is stable). A good signal is when the `overlay-viewer` Playwright tests pass for 10 consecutive CI runs without the helper.

Notes for maintainers:

- Keep the helper minimal and test-scoped; do not add application logic here.
- If you change the island's public DOM hooks (e.g., `data-testid` values), update this README and associated tests accordingly.
