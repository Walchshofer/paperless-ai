# Export Panel Feature - Implementation Documentation

**Status:** Wired and Ready (Endpoints Not Implemented)  
**Date:** February 3, 2026  
**Component:** `ExportPanelIsland.tsx`  
**Location:** [views/document-workspace.ejs](../views/document-workspace.ejs)

---

## Overview

The Export Panel is an event-driven modal component that provides export functionality for document content. It listens to global custom events and presents a unified export interface for regions, text excerpts, and annotations.

## Architecture

### Component Type
- **Island:** Preact-based interactive component
- **Activation:** Event-driven (listens to global CustomEvents)
- **Scope:** Document-level (receives `documentId` prop)

### Event-Driven Design

The ExportPanelIsland uses a **pub-sub pattern** via browser CustomEvents:

```typescript
// Dispatched by any component that wants to trigger export
window.dispatchEvent(new CustomEvent('export:region-requested', {
  detail: { imageBase64: 'data:image/png;base64,...' }
}));

window.dispatchEvent(new CustomEvent('export:text-requested', {
  detail: { text: 'Selected text content...' }
}));

window.dispatchEvent(new CustomEvent('export:annotations-requested', {
  detail: { annotations: [...] }
}));
```

### Supported Events

| Event Name | Payload | Use Case |
|------------|---------|----------|
| `export:region-requested` | `{ imageBase64: string }` | Export visual region as PNG/PDF |
| `export:text-requested` | `{ text: string }` | Export text selection as TXT/PDF |
| `export:annotations-requested` | `{ annotations: Array }` | Export annotations as JSON |

---

## Implementation

### 1. View Integration

**File:** [views/document-workspace.ejs](../views/document-workspace.ejs)

```html
<!-- Export Panel Modal (global - listens to custom events) -->
<div
    data-island="export-panel-island"
    data-testid="export-panel-island"
    class="fixed inset-0 z-50 pointer-events-none"
    data-props="<%= JSON.stringify({ documentId: doc ? doc.id : null }) %>"
></div>
```

**Key Details:**
- **Position:** Fixed overlay (`z-50`) to appear above all content
- **Pointer events:** Disabled by default (`pointer-events-none`), enabled when modal opens
- **Placement:** After `resizable-layout-island`, before closing `</main>`
- **Props:** Receives current `documentId` from workspace view model

### 2. Component Registration

**File:** [src/islands/runtime.browser.tsx](../src/islands/runtime.browser.tsx)

```typescript
import ExportPanelIsland from './ExportPanelIsland';
registerIsland('export-panel-island', ExportPanelIsland);
```

### 3. Build Configuration

**File:** [scripts/build-islands-direct.js](../scripts/build-islands-direct.js)

```javascript
const entries = {
  'export-panel': 'src/islands/ExportPanelIsland.tsx',
  // ... other islands
};
```

**Output:** `public/js/dist/export-panel.island.js` (~24.8kb)

---

## API Endpoints (Not Yet Implemented)

The ExportPanelIsland expects these backend endpoints to exist:

### POST `/api/export/region`

**Purpose:** Export a visual region as PNG or PDF

**Request:**
```json
{
  "imageBase64": "data:image/png;base64,iVBORw0KG...",
  "format": "png" | "pdf"
}
```

**Response:** Binary file stream
- **Headers:** `Content-Disposition: attachment; filename="export.png"`
- **Content-Type:** `image/png` or `application/pdf`

---

### POST `/api/export/text`

**Purpose:** Export text content as TXT or PDF

**Request:**
```json
{
  "text": "Selected text content...",
  "format": "txt" | "pdf"
}
```

**Response:** Binary file stream
- **Headers:** `Content-Disposition: attachment; filename="export.txt"`
- **Content-Type:** `text/plain` or `application/pdf`

---

### POST `/api/export/annotations`

**Purpose:** Export document annotations as JSON

**Request:**
```json
{
  "annotations": [
    { "id": "uuid-1", "label": "Invoice Total", "bbox": {...}, "note": "..." },
    { "id": "uuid-2", "label": "Date", "bbox": {...} }
  ],
  "documentId": 123
}
```

**Response:** JSON file stream
- **Headers:** `Content-Disposition: attachment; filename="annotations.json"`
- **Content-Type:** `application/json`

---

## Integration Examples

### Example 1: Trigger from OverlayViewerIsland

```typescript
// In OverlayViewerIsland.tsx
const exportSelectedRegion = () => {
  const canvas = document.createElement('canvas');
  // ... render selected region to canvas
  const imageBase64 = canvas.toDataURL('image/png');
  
  window.dispatchEvent(new CustomEvent('export:region-requested', {
    detail: { imageBase64 }
  }));
};
```

### Example 2: Trigger from Text Selection

```typescript
// In any text-rendering component
const exportTextSelection = () => {
  const selectedText = window.getSelection()?.toString() || '';
  
  window.dispatchEvent(new CustomEvent('export:text-requested', {
    detail: { text: selectedText }
  }));
};
```

### Example 3: Trigger from VisualAnnotationIsland

```typescript
// In VisualAnnotationIsland.tsx
const exportAllAnnotations = () => {
  window.dispatchEvent(new CustomEvent('export:annotations-requested', {
    detail: { annotations: annotations }
  }));
};
```

---

## Testing

### Unit Tests

**File:** [test/islands/export-panel.test.js](../test/islands/export-panel.test.js)

- Tests island mounting and props handling
- Verifies `documentId` is passed correctly

### Runtime Tests

**File:** [test/islands/export-panel.runtime.test.js](../test/islands/export-panel.runtime.test.js)

- Tests Preact rendering
- Verifies modal behavior (currently placeholder-only)

---

## Implementation Roadmap

### Phase 1: Backend API Routes ⏳ Not Started

**File to Create:** `routes/api/export.js`

**Requirements:**
1. Implement POST `/api/export/region` - Convert base64 to PNG/PDF
2. Implement POST `/api/export/text` - Generate TXT/PDF from text
3. Implement POST `/api/export/annotations` - Format annotations as JSON
4. Add `authenticateApi` middleware to all endpoints
5. Add Swagger documentation

**Dependencies:**
- `pdf-lib` or `pdfkit` for PDF generation
- `sharp` or `jimp` for image processing

### Phase 2: Frontend Event Dispatchers ⏳ Not Started

**Components to Update:**
1. `OverlayViewerIsland.tsx` - Add "Export Region" button/context menu
2. `VisualAnnotationIsland.tsx` - Add "Export Annotations" button
3. `HistoryTabsIsland.tsx` or `ContextSidebarIsland.tsx` - Add text export

### Phase 3: E2E Testing ⏳ Not Started

**Test Scenarios:**
1. Export visual region from workspace
2. Export text selection
3. Export annotations and verify JSON structure
4. Test all format options (PNG, PDF, TXT, JSON)

---

## Current Status

### ✅ Completed
- [x] Island component created and functional
- [x] Event listeners registered for all export types
- [x] Modal UI implemented (shows placeholder when triggered)
- [x] Registered in island runtime
- [x] Added to build configuration
- [x] Wired in `document-workspace.ejs`
- [x] Unit tests passing

### ⏳ Pending
- [ ] Backend API routes (`/api/export/*`)
- [ ] Event dispatchers in UI components
- [ ] Actual file generation logic
- [ ] Format conversion (PDF generation)
- [ ] E2E tests for full export flow

### 🔴 Blockers
- Backend endpoints not implemented - island will show "Export failed" error if triggered

---

## Technical Notes

### CSS Classes
```css
.fixed.inset-0.z-50.pointer-events-none
```
- Fixed positioning to cover entire viewport
- `z-50` ensures it appears above workspace content (sidebar is `z-10`, resize handle is `z-30`)
- `pointer-events-none` by default, enabled when modal is active

### Props Contract

**File:** [src/ui/contracts/ExportPanel.contract.ts](../src/ui/contracts/ExportPanel.contract.ts)

```typescript
export interface ExportPanelContract {
  documentId: number | null;
}
```

### Accessibility Considerations
- Modal should trap focus when open
- Escape key should close modal
- Export button should have clear loading state
- Error messages should be announced to screen readers

---

## Related Documentation
- [Frontend Architecture](./FRONTEND_ARCHITECTURE.md) - Island architecture overview
- [API Migration](./API_MIGRATION.md) - Endpoint naming conventions
- [Islands Guide](./ISLANDS_GUIDE.md) - How to create and register islands

---

## Maintenance

### When to Update This Doc
- When backend export routes are implemented
- When new export formats are added
- When event dispatcher components are identified
- When E2E tests are written

### Owner
- **Frontend:** ExportPanelIsland component
- **Backend:** Export API routes (not yet assigned)
- **Integration:** Event dispatchers in UI components (not yet assigned)
