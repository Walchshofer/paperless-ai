# Cross-Island Events Reference

This document is the **authoritative reference** for all `window.CustomEvent`
messages exchanged between Preact islands in the paperless-ai frontend.

All events use `window.dispatchEvent` / `window.addEventListener` on the shared
global `window` object.  Islands MUST NOT rely on direct prop callbacks across
island boundaries; they MUST use the events listed here.

Last updated: 2026-02-23 (v2 Workspace Intelligence additions)

---

## Transport contract

- **Bus**: `window` (global `CustomEvent`)
- **Payload**: `event.detail` (plain object, serialised at dispatch time)
- **Scope**: page-scoped; no cross-tab or cross-frame propagation
- **Cleanup**: every listener registered with `addEventListener` MUST be removed
  in the island's cleanup / `useEffect` return function

---

## Event catalogue

### Document context events

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `workspace:document-switched` | `DocumentContextBarIsland`, `VisualTabIsland` | `SmartMetadataIsland`, `DocumentContentIsland`, `ChatWorkspaceIsland`, `ManualEditorIsland`, `ContextSidebarIsland`, `VisualTabIsland`, `OverlayViewerIsland`, `UnifiedWorkspaceIsland` | `{ documentId, document }` | Authoritative document-switch signal from workspace header. All sidebar islands update their state on receipt. |
| `overlay:document-changed` | `DocumentContextBarIsland`, `ManualWorkspaceIsland`, `VisualTabIsland`, `OverlayViewerIsland`, `HistoryManagerIsland` | `OverlayViewerIsland` | `{ documentId, page?, originalUrl? \| original_url? }` | Updates the overlay viewer to a specific document (and optionally page). Both camelCase `originalUrl` and snake_case `original_url` are accepted. |

### Overlay viewer events

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `overlay:highlight-region` | `ManualWorkspaceIsland`, `UnifiedWorkspaceIsland`, `VisualTabIsland` | `OverlayViewerIsland` | `{ bbox: {x,y,width,height}, page: number }` | Pans and highlights a bounding box on the current document page. Coordinates are in 0–1000 normalised scale. |
| `overlay:navigate-to-page` | `UnifiedWorkspaceIsland` | `OverlayViewerIsland` (intended receiver; listener not yet wired — see notes) | `{ page: number, documentId: string\|number }` | Instructs the overlay viewer to navigate to a specific page. Dispatched alongside `overlay:highlight-region` when `metadata:locate-field` resolves a bbox. **Status**: emitter confirmed in `src/islands/UnifiedWorkspaceIsland.tsx:329`. OverlayViewer listener is pending implementation. |

### Metadata field events

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `metadata:locate-field` | `SmartMetadataIsland` | `UnifiedWorkspaceIsland` | `{ fieldId: string }` | Requests the workspace to resolve a field to its overlay bbox and navigate/highlight it. `UnifiedWorkspaceIsland` handles resolution and emits `overlay:highlight-region` + `overlay:navigate-to-page`. |

### AI analysis events

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `ai:analysis-completed` | `AIAnalysisIsland` | `ManualWorkspaceIsland`, `TagsManagerIsland` | `{ documentId, tags?, documentType?, fields?, ... }` | Fired when AI pipeline analysis completes. `fields` and `documentType` may be included. Manual workspace populates sidebar tabs on receipt. |

### Visual OCR events (v2 — added 2026-02-23)

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `vis-ocr:updated` | `DocumentContentIsland` | `SmartMetadataIsland` | `{ pages: VisOcrPage[], source: string, quality: string\|null }` | Fired after a successful VIS_OCR regeneration (both silent auto-generate and user-triggered). `SmartMetadataIsland` updates the Visual Insights accordion on receipt. Source is typically `'vis_ocr'`. |
| `vis-ocr:request-generate` | `SmartMetadataIsland` | `DocumentContentIsland` | `{ documentId: string\|number }` | Requests `DocumentContentIsland` to run a non-silent VIS_OCR regeneration. Island filters by `documentId` before acting. |

### Custom field draw events (v2 — added 2026-02-23)

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `custom-field:draw-request` | `SmartMetadataIsland` | `OverlayViewerIsland` | `{ documentId: string\|number, tempFieldId: string }` | Activates draw mode in the overlay viewer for a new custom field. `tempFieldId` is a client-generated identifier (e.g. `custom_field_draw_<timestamp>`). |
| `custom-field:draw-complete` | `OverlayViewerIsland` | `SmartMetadataIsland` | `{ tempFieldId: string, bbox: {x,y,width,height}, page: number, imageBase64: string\|null }` | Fired when the user completes a draw gesture that was initiated by `custom-field:draw-request`. `bbox` coordinates are normalised (0–1, relative to natural image dimensions). `imageBase64` is the base64-encoded PNG crop of the drawn region, or `null` if capture failed. |

### Tag drag events (v2 — added 2026-02-23)

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `tag:drag-dropped` | `OverlayViewerIsland` | `SmartMetadataIsland` | `{ tagId: unknown, tagName: unknown, color: unknown, bbox: {x,y,width,height}, page: number }` | Fired when a tag pill is dropped onto the document overlay drop zone. `bbox` is a computed 10% x 6% region centred on the drop point (normalised 0–1 coordinates). `SmartMetadataIsland` uses this to associate the tag with a document region. |

### Settings / UI events

| Event | Emitter | Listeners | Payload | Notes |
|-------|---------|-----------|---------|-------|
| `settings:category-changed` | `SettingsSidebarIsland` | Settings page controller | `{ category: string }` | Controls which settings section is visible. Controller persists choice to `localStorage` as `settings:lastCategory`. |

---

## Payload type reference

```typescript
// VisOcrPage shape (used in vis-ocr:updated)
interface VisOcrPage {
  pageNumber: number;
  text: string;
  success: boolean;
  note?: 'no_text_extracted';  // present when success === false and text is empty
}

// Normalised bbox (used in custom-field:draw-complete, tag:drag-dropped, overlay:highlight-region)
interface NormalisedBbox {
  x: number;       // 0.0 – 1.0 (fraction of image width)
  y: number;       // 0.0 – 1.0 (fraction of image height)
  width: number;   // 0.0 – 1.0
  height: number;  // 0.0 – 1.0
}
```

---

## Source file index

| Event | Emitter file:line | Listener file:line |
|-------|------------------|--------------------|
| `workspace:document-switched` | `src/islands/DocumentContextBarIsland.tsx:170`, `src/islands/VisualTabIsland.tsx:767` | `src/islands/SmartMetadataIsland.tsx:867`, `src/islands/DocumentContentIsland.tsx:177`, `src/islands/ManualEditorIsland.tsx:177`, `src/islands/ContextSidebarIsland.tsx:178`, `src/islands/OverlayViewerIsland.tsx:266`, `src/islands/ChatWorkspaceIsland.tsx:399`, `src/islands/UnifiedWorkspaceIsland.tsx:280` |
| `overlay:document-changed` | `src/islands/DocumentContextBarIsland.tsx:158`, `src/islands/ManualWorkspaceIsland.tsx:74,206`, `src/islands/VisualTabIsland.tsx:760`, `src/islands/OverlayViewerIsland.tsx:1510,2241` | `src/islands/OverlayViewerIsland.tsx:256` |
| `overlay:highlight-region` | `src/islands/ManualWorkspaceIsland.tsx:66`, `src/islands/UnifiedWorkspaceIsland.tsx:325`, `src/islands/VisualTabIsland.tsx:458,781` | `src/islands/OverlayViewerIsland.tsx:453` |
| `overlay:navigate-to-page` | `src/islands/UnifiedWorkspaceIsland.tsx:329` | pending (intended: `OverlayViewerIsland`) |
| `metadata:locate-field` | `src/islands/SmartMetadataIsland.tsx:1062` | `src/islands/UnifiedWorkspaceIsland.tsx:347` |
| `ai:analysis-completed` | `src/islands/AIAnalysisIsland.tsx:158,230` | `src/islands/ManualWorkspaceIsland.tsx:450`, `src/islands/TagsManagerIsland.tsx:80` |
| `vis-ocr:updated` | `src/islands/DocumentContentIsland.tsx:409` | `src/islands/SmartMetadataIsland.tsx:982` |
| `vis-ocr:request-generate` | `src/islands/SmartMetadataIsland.tsx:2114` | `src/islands/DocumentContentIsland.tsx:467` |
| `custom-field:draw-request` | `src/islands/SmartMetadataIsland.tsx:2083` | `src/islands/OverlayViewerIsland.tsx:536` |
| `custom-field:draw-complete` | `src/islands/OverlayViewerIsland.tsx:1299` | `src/islands/SmartMetadataIsland.tsx:1052` |
| `tag:drag-dropped` | `src/islands/OverlayViewerIsland.tsx:1977` | `src/islands/SmartMetadataIsland.tsx:1020` |
| `settings:category-changed` | `src/islands/SettingsSidebarIsland.tsx` | settings page controller |

---

## Implementation notes

### `vis-ocr:updated` auto-generate guard
`DocumentContentIsland` auto-generates high-res OCR on first mount for a
document (silent mode).  A `localStorage` key `vis_ocr_generated_{documentId}`
prevents double-firing across re-renders and page reloads.  When present, the
auto-generate effect is skipped; it is only reset if the key is explicitly
cleared.

### `overlay:navigate-to-page` pending listener
As of v2 (2026-02-23), `UnifiedWorkspaceIsland` dispatches
`overlay:navigate-to-page` correctly alongside `overlay:highlight-region`.
The corresponding listener in `OverlayViewerIsland` is not yet implemented.
Page navigation currently relies on the caller first emitting
`overlay:document-changed` with a `page` parameter to move to the target page.
The `overlay:navigate-to-page` event is reserved for a cleaner future listener.

### `custom-field:draw-complete` bbox normalisation
Coordinates are divided by `naturalWidth` / `naturalHeight` of the loaded image
element at draw time.  Consumers that render to a canvas must multiply back by
the actual rendered dimensions before drawing.

### `tag:drag-dropped` bbox computation
The bbox is a fixed 10% × 6% region centred on the drop point (clamped to
`[0, 1]`).  It is a visual placeholder; consumers should treat it as an
approximate anchor and allow user adjustment.
