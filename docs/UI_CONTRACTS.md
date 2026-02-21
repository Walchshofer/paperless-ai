# UI Contracts (Test hooks & Events) 🔧

## Dashboard Charts Island (Reactive Metrics)

- Island anchor: `data-island="dashboard-charts-island"`
- Task Runner Status:
  - Container: `.material-card` containing "Task Runner Status"
  - Active Processing: `#processingContainer` (visible when `metrics.processingStatus.isProcessing` is true)
  - Idle State: `#idleContainer` (visible when idle)
  - Stats: `processedToday` (text content), `pendingCount` (text content)
- Charts:
  - Token Distribution: `canvas#tokenDistributionChart`
  - Document Types: `canvas#documentTypesChart`

### Events
- **Internal Polling**: The island polls `/api/dashboard/metrics` every 5 seconds.
- **Hydration**: Accepts `initialData` prop from `window.dashboardData` snapshot.

---

## Overlay Viewer Island (⚠️ important for tests and integration)

- Island anchor: `data-island="overlay-viewer-island"` — used to mount the island.
- Anchor test hook: `data-testid="overlay-viewer-island"` — used in tests to find the island anchor.
- Island root: `data-testid="overlay-viewer-root"` — root element rendered by the island.
- Container: `data-testid="overlay-container"` — the element containing the image / canvas (useful for E2E selectors).
- Page indicator: `data-testid="overlay-page-indicator"` — shows current page (e.g., `Page 2` or `Page 2 of 3`).
- Navigation buttons:
  - Previous page: `data-testid="overlay-prev-page"` (disabled when on first page)
  - Next page: `data-testid="overlay-next-page"` (disabled when `pageCount` reached)
- Transformation Controls:
  - Rotate Clockwise: `data-testid="overlay-rotate-cw"` — rotates document 90°
  - Rotation Indicator: `data-testid="overlay-rotation-degrees"` — shows current rotation (e.g. `90°`)
- Image element: `data-testid="document-image"` — the image element (may be test-injected by E2E helpers).

### Events
- Incoming event: `overlay:document-changed` — payload detail may include:
  - `documentId` (number|null)
  - `page` (number)
  - `originalUrl` or `original_url` (string|nullable) — island prefers provided `originalUrl` when present
  - `pageCount` (number|nullable) — optional, used to bound nav controls

- Outgoing event: `overlay:document-changed` — the island dispatches this event when page is changed via its navigation controls. Consumers should treat this as a notification that the overlay view has changed.

### Notes & Testing Guidance 💡
- Tests should use `data-testid` attributes (exact strings above) for resilient selectors.
- E2E test infra may attach small test-only helpers (non-invasive DOM-only changes) to provide a minimal image preview when a high-res image is not available during CI runs. These helpers are safe and removed as needed.
- Avoid relying on inner text alone for assertions — prefer testids for stability.

---

---

## Document Content Island (OCR Text View)

- Island anchor: `data-island="document-content-island"`
- Root: `data-testid="document-content-island-root"`
- Search Input: `data-testid="search-input"`
- Search Navigation:
  - Previous: `data-testid="search-prev"`
  - Next: `data-testid="search-next"`
  - Match Count: `data-testid="search-count"`
- Action Buttons:
  - Case Sensitive: `data-testid="search-case-sensitive"`
  - Regex Toggle: `data-testid="search-regex"`
  - Export Text: `data-testid="export-text"`
  - Send to Chat: `data-testid="send-to-chat"`
- Mode Toggle (New):
  - Original OCR (Tesseract): `data-testid="ocr-mode-original"`
  - High Res AI OCR (Expert): `data-testid="ocr-mode-high-res"`
- Editing & Feedback (New):
  - Start Editing: `data-testid="ocr-start-edit"`
  - Save Changes: `data-testid="ocr-save-edit"`
  - Cancel Editing: `data-testid="ocr-cancel-edit"`
  - Mark Accurate (Feedback): `data-testid="ocr-vote-accurate"`
  - Edit Textarea: `data-testid="ocr-edit-textarea"`
  - Regenerate AI OCR: `data-testid="ocr-regenerate"`
  - Regenerating State: `data-testid="ocr-regenerating-state"`
- Info Bar (New):
  - Container: `data-testid="ocr-ai-info-bar"`
  - Source Badge: `data-testid="ocr-ai-source-badge"`
  - Quality Badge: `data-testid="ocr-ai-quality-badge"`
- Content Area: `data-testid="document-content-area"`

### Props (DocumentContentContract)
- `documentId`: number | null
- `content`: string (Tesseract OCR)
- `visOcrPages`: array of page objects (AI OCR)
- `visOcrSource`: string | null
- `visOcrQuality`: number | null

### Events
- Listens for: `document:selected` (Manual Workspace)
- Listens for: `workspace:document-switched` (Global Workspace)
- Dispatches: `export:text-requested` (for downloading/sending to chat)

---

---

## Save Coordination System (Multi-Island Consistency)

The workspace uses an event-driven coordination system to ensure all modified data across different islands is saved atomically.

- **Coordinator**: `SaveCoordinatorIsland.tsx` (using `workspace-save-coordinator.js` logic)
- **Status Overlay**: `data-testid="save-coordinator-overlay"`

### Coordinated Save Flow
1. **Request**: `DocumentContextBarIsland` dispatches `workspace:save-request { documentId, saveId }`.
2. **Acknowledge**: Participants (Metadata, OCR, Overlay Viewer) listen for `save-request`. If they have unsaved changes (dirty), they dispatch `workspace:save-ack { saveId, participantId, willSave: true }`.
3. **Begin**: Coordinator dispatches `workspace:save-begin { saveId, documentId }`.
4. **Execute**: Participants perform their respective API calls.
5. **Partial Complete**: Each participant dispatches `workspace:save-partial-complete { saveId, participantId, success }` when finished.
6. **Final Complete**: Once all acked participants finish, Coordinator dispatches `workspace:save-complete { saveId, documentId }`.

### Participants
- **Smart Metadata**: Persists title, correspondent, date, tags, and custom fields to Paperless-ngx.
- **OCR Tab**: Persists user-corrected OCR text to PostgreSQL.
- **Overlay Viewer**: Persists visual transformations (e.g. **Rotation**) to PostgreSQL and triggers document re-ingestion.

---

If you add or rename any `data-testid` used in tests, update this document and mention the change in the PR description and reviewers list (frontend-design-auditor + qa). ✅