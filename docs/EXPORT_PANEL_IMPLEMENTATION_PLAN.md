# Export Panel Feature - Full Implementation Architecture

**Architect:** Frontend Design Architect  
**Date:** February 3, 2026  
**Epic:** Export Panel Integration & Backend Implementation  
**Estimated Complexity:** Medium (3-4 days)

---

## 1. Purpose & Audience

**Primary Users:** Power users and document reviewers who need to extract and share specific document artifacts (visual regions, text excerpts, annotations) outside the Paperless-AI system.

**Use Cases:**
- **Legal/Compliance:** Export annotated regions as evidence packages (PDF + JSON metadata)
- **Research:** Extract text excerpts with citations for external analysis
- **Collaboration:** Share visual selections with team members via PNG/PDF
- **Archival:** Export complete annotation sets as structured JSON for backup

---

## 2. Aesthetic Direction

**Chosen Direction:** **Industrial/Utilitarian with Precision Craft**

**Rationale:** Export is a functional action that demands clarity, reliability, and trust. The UI should feel like a precision instrument—straightforward, unambiguous, with clear feedback at every step. No decorative elements, but deliberate micro-interactions that communicate system state.

**Visual Principles:**
- **Monospace typography** for format options (PNG, PDF, TXT, JSON) to emphasize technical precision
- **Progress indicators** with exact percentages, not spinners
- **Binary state colors:** Green (#10b981) for success, Red (#ef4444) for errors, Amber (#f59e0b) for warnings
- **One-click export:** Minimize steps between trigger and download
- **Keyboard-first:** Esc to cancel, Enter to confirm

---

## 3. Differentiator

**The One Thing Users Will Remember:**  
**Context-aware export buttons that appear exactly where needed, with zero setup.**

Instead of hunting through menus, export appears as:
- A ghosted overlay button when selecting text in DocumentContentIsland
- A corner badge on drawn regions in OverlayViewerIsland
- A row action in annotation lists in VisualAnnotationIsland

**Interaction Pattern:**
```
User draws region → Export badge fades in (2-3px from corner)
→ Click → Format picker appears inline (PNG/PDF)
→ Single click → Download starts
→ Success toast fades in bottom-right
```

---

## 4. Information Architecture

### A. Component Topology

```
ExportPanelIsland (Global Modal - Already Wired)
├─ Listens: export:region-requested
├─ Listens: export:text-requested
└─ Listens: export:annotations-requested

Integration Points (Event Dispatchers):
├─ OverlayViewerIsland
│   └─ Trigger: Right-click context menu → "Export Selected Region"
│   └─ Event: export:region-requested { imageBase64 }
│
├─ VisualAnnotationIsland
│   └─ Trigger: "Export All Annotations" button (top-right toolbar)
│   └─ Event: export:annotations-requested { annotations[] }
│
├─ DocumentContentIsland
│   └─ Trigger: Text selection + "Export" button in floating toolbar
│   └─ Event: export:text-requested { text }
│
└─ HistoryTabsIsland / ContextSidebarIsland
    └─ Trigger: "Export" icon in metadata tab header
    └─ Event: export:text-requested { text: JSON.stringify(metadata) }
```

### B. Backend Route Structure

```
routes/api/export.js
├─ POST /api/export/region
│   ├─ Input: { imageBase64, format: 'png'|'pdf', documentId }
│   ├─ Validation: Max 10MB base64, valid format
│   ├─ Processing: 
│   │   └─ PNG: Direct base64 → Buffer → response
│   │   └─ PDF: Canvas → pdf-lib → embed image → response
│   └─ Output: Binary stream with Content-Disposition header
│
├─ POST /api/export/text
│   ├─ Input: { text, format: 'txt'|'pdf', metadata?: {...} }
│   ├─ Validation: Max 1MB text, valid format
│   ├─ Processing:
│   │   └─ TXT: UTF-8 encoding with optional metadata header
│   │   └─ PDF: pdfkit → addPage → text layout → response
│   └─ Output: Binary stream with filename
│
└─ POST /api/export/annotations
    ├─ Input: { annotations[], documentId, includeMetadata: bool }
    ├─ Validation: Valid annotation schema
    ├─ Processing:
    │   └─ Format JSON with ISO timestamps, bbox normalization
    │   └─ Optional: Include document metadata from Paperless API
    └─ Output: JSON file with .json Content-Type
```

### C. UI Flow Map

**Scenario 1: Visual Region Export (OverlayViewerIsland)**

```
User draws selection box on document viewer
→ handleMouseUp() captures bbox coordinates
→ Render canvas excerpt from visible viewport
→ canvas.toDataURL('image/png') → base64
→ Show inline export button (fixed position, 8px from box corner)
  [Export ↓] PNG | PDF
→ User clicks "PNG"
→ Dispatch export:region-requested
→ ExportPanelIsland receives event
→ Modal shows: "Exporting region as PNG..."
→ POST /api/export/region { imageBase64, format: 'png' }
→ Success: Browser download triggered
→ Modal closes, toast: "Region exported successfully"
```

**Scenario 2: Text Selection Export (DocumentContentIsland)**

```
User selects text in content viewer (native browser selection)
→ 'mouseup' event detects window.getSelection()
→ Show floating toolbar above selection (like Medium editor)
  [🔍 Search] [📋 Copy] [📥 Export]
→ User clicks "Export"
→ Show format picker: TXT | PDF
→ User clicks "TXT"
→ Dispatch export:text-requested { text: selectedText }
→ ExportPanelIsland receives event
→ POST /api/export/text { text, format: 'txt' }
→ Download starts immediately (no modal for text)
→ Toast: "Text exported (XXX characters)"
```

**Scenario 3: Annotation Bulk Export (VisualAnnotationIsland)**

```
User has drawn 5+ annotations on document
→ Toolbar shows "Export All (5)" button
→ User clicks → Format picker: JSON | PDF Report
→ User selects "JSON"
→ Dispatch export:annotations-requested { annotations: [...] }
→ ExportPanelIsland receives event
→ POST /api/export/annotations { annotations, documentId }
→ Download JSON file with filename: annotations-{docId}-{timestamp}.json
→ Toast: "5 annotations exported"
```

---

## 5. VM Contract Shape

### ExportPanelIsland (Already Wired)
```typescript
interface ExportPanelContract {
  documentId: number | null;
}
```

### Event Payload Contracts (New)

```typescript
// Dispatched by OverlayViewerIsland
interface ExportRegionEvent extends CustomEvent {
  detail: {
    imageBase64: string;        // data:image/png;base64,...
    bbox?: {                    // Optional: original bbox for metadata
      x: number;
      y: number;
      width: number;
      height: number;
    };
    documentId?: number;
    pageNumber?: number;
  }
}

// Dispatched by DocumentContentIsland
interface ExportTextEvent extends CustomEvent {
  detail: {
    text: string;               // Plain text or markdown
    format?: 'plain' | 'markdown';
    metadata?: {
      documentId?: number;
      selectionStart?: number;
      selectionEnd?: number;
      timestamp?: string;
    };
  }
}

// Dispatched by VisualAnnotationIsland
interface ExportAnnotationsEvent extends CustomEvent {
  detail: {
    annotations: Array<{
      id?: string;
      label: string;
      note?: string;
      bbox: { x: number; y: number; width: number; height: number };
      confirmed?: boolean;
      pageNumber?: number;
    }>;
    documentId: number;
    includeMetadata?: boolean;
  }
}
```

### Backend Request/Response Contracts

```typescript
// POST /api/export/region
interface ExportRegionRequest {
  imageBase64: string;
  format: 'png' | 'pdf';
  documentId?: number;
  metadata?: {
    originalBbox?: BBox;
    pageNumber?: number;
    timestamp?: string;
  };
}
// Response: Binary stream (image/png or application/pdf)

// POST /api/export/text
interface ExportTextRequest {
  text: string;
  format: 'txt' | 'pdf';
  metadata?: {
    documentId?: number;
    title?: string;
    source?: string;
  };
}
// Response: Binary stream (text/plain or application/pdf)

// POST /api/export/annotations
interface ExportAnnotationsRequest {
  annotations: Annotation[];
  documentId: number;
  includeMetadata?: boolean;  // Include document title, tags, etc.
}
// Response: application/json file
```

---

## 6. Build-Feasible Implementation Notes

### Phase 1: Backend API Routes (2-3 hours)

**File:** `routes/api/export.js` (NEW)

```javascript
const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const PDFDocument = require('pdfkit');         // For PDF generation
const { Canvas } = require('canvas');          // For image processing

/**
 * @swagger
 * /api/export/region:
 *   post:
 *     summary: Export a visual region as PNG or PDF
 *     security: [{ BearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageBase64, format]
 *             properties:
 *               imageBase64: { type: string }
 *               format: { type: string, enum: [png, pdf] }
 *               documentId: { type: number }
 *     responses:
 *       200: 
 *         description: Binary file download
 *         content:
 *           image/png: {}
 *           application/pdf: {}
 */
router.post('/region', authenticateApi, async (req, res) => {
  try {
    const { imageBase64, format, documentId } = req.body;
    
    // Validation
    if (!imageBase64 || !imageBase64.startsWith('data:image')) {
      return res.status(400).json({ error: 'Invalid image data' });
    }
    if (!['png', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }
    
    // Extract base64 data
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (format === 'png') {
      // Direct PNG response
      const filename = `region-${documentId || 'export'}-${Date.now()}.png`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    }
    
    if (format === 'pdf') {
      // Embed PNG in PDF
      const filename = `region-${documentId || 'export'}-${Date.now()}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');
      
      const doc = new PDFDocument({ autoFirstPage: false });
      doc.pipe(res);
      
      // Get image dimensions from buffer
      const image = doc.openImage(buffer);
      doc.addPage({ size: [image.width, image.height] });
      doc.image(buffer, 0, 0);
      
      doc.end();
    }
  } catch (error) {
    console.error('[Export] Region export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * @swagger
 * /api/export/text:
 *   post:
 *     summary: Export text content as TXT or PDF
 */
router.post('/text', authenticateApi, async (req, res) => {
  try {
    const { text, format, metadata } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Invalid text content' });
    }
    if (!['txt', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }
    
    const filename = `text-export-${Date.now()}.${format}`;
    
    if (format === 'txt') {
      // Plain text export
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      
      let output = '';
      if (metadata) {
        output += `--- Document Export ---\n`;
        if (metadata.title) output += `Title: ${metadata.title}\n`;
        if (metadata.documentId) output += `Document ID: ${metadata.documentId}\n`;
        output += `Exported: ${new Date().toISOString()}\n`;
        output += `---\n\n`;
      }
      output += text;
      
      return res.send(output);
    }
    
    if (format === 'pdf') {
      // PDF text export
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/pdf');
      
      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);
      
      if (metadata?.title) {
        doc.fontSize(16).text(metadata.title, { align: 'center' });
        doc.moveDown();
      }
      
      doc.fontSize(12).text(text, {
        align: 'left',
        lineGap: 2
      });
      
      doc.end();
    }
  } catch (error) {
    console.error('[Export] Text export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

/**
 * @swagger
 * /api/export/annotations:
 *   post:
 *     summary: Export annotations as JSON
 */
router.post('/annotations', authenticateApi, async (req, res) => {
  try {
    const { annotations, documentId, includeMetadata } = req.body;
    
    if (!Array.isArray(annotations)) {
      return res.status(400).json({ error: 'Invalid annotations array' });
    }
    
    const filename = `annotations-${documentId || 'export'}-${Date.now()}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      documentId: documentId || null,
      annotationCount: annotations.length,
      annotations: annotations.map(ann => ({
        id: ann.id || null,
        label: ann.label || '',
        note: ann.note || '',
        bbox: ann.bbox,
        pageNumber: ann.pageNumber || 1,
        confirmed: ann.confirmed || false
      }))
    };
    
    if (includeMetadata && documentId) {
      // TODO: Optionally fetch document metadata from Paperless API
      // exportData.documentMetadata = await paperlessService.getDocument(documentId);
    }
    
    res.json(exportData);
  } catch (error) {
    console.error('[Export] Annotations export failed:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

module.exports = router;
```

**Register in server.js:**
```javascript
const exportApiRoutes = require('./routes/api/export');
app.use('/api/export', exportApiRoutes);
```

**Dependencies to add:**
```bash
npm install pdfkit
# canvas is optional - only if server-side image manipulation is needed
```

---

### Phase 2: Frontend Event Dispatchers (3-4 hours)

#### 2A. OverlayViewerIsland - Region Export

**File:** `src/islands/OverlayViewerIsland.tsx`

**Changes:**
1. Add state for selected region bbox
2. On `handleMouseUp()` after drawing selection, show export button
3. Add inline export button component that dispatches event

```typescript
// Add state
const [selectedRegion, setSelectedRegion] = useState<BoxInput | null>(null);
const [showExportBtn, setShowExportBtn] = useState(false);

// Modify handleMouseUp (existing selection logic)
const handleMouseUp = (e: MouseEvent) => {
  // ... existing bbox calculation
  const bbox = { x, y, width, height };
  setSelectedRegion(bbox);
  setShowExportBtn(true);
};

// New: Export region handler
const handleExportRegion = async (format: 'png' | 'pdf') => {
  if (!selectedRegion || !canvasRef.current) return;
  
  // Create temporary canvas with selected region
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  tempCanvas.width = selectedRegion.width;
  tempCanvas.height = selectedRegion.height;
  
  // Draw selected region from main canvas
  ctx?.drawImage(
    canvasRef.current,
    selectedRegion.x, selectedRegion.y,
    selectedRegion.width, selectedRegion.height,
    0, 0,
    selectedRegion.width, selectedRegion.height
  );
  
  const imageBase64 = tempCanvas.toDataURL('image/png');
  
  // Dispatch export event
  window.dispatchEvent(new CustomEvent('export:region-requested', {
    detail: {
      imageBase64,
      bbox: selectedRegion,
      documentId: props.documentId,
      pageNumber: currentPage
    }
  }));
  
  setShowExportBtn(false);
};

// Add to render: Export button overlay
{showExportBtn && selectedRegion && (
  <div
    className="absolute bg-white border border-gray-300 shadow-lg rounded px-2 py-1 flex gap-2 z-50"
    style={{
      left: selectedRegion.x + selectedRegion.width - 100,
      top: selectedRegion.y - 30
    }}
  >
    <button
      onClick={() => handleExportRegion('png')}
      className="text-xs font-mono hover:bg-gray-100 px-2 py-1 rounded"
      data-testid="export-region-png"
    >
      PNG
    </button>
    <button
      onClick={() => handleExportRegion('pdf')}
      className="text-xs font-mono hover:bg-gray-100 px-2 py-1 rounded"
      data-testid="export-region-pdf"
    >
      PDF
    </button>
    <button
      onClick={() => setShowExportBtn(false)}
      className="text-xs text-gray-500 hover:text-gray-700"
      aria-label="Close export menu"
    >
      ✕
    </button>
  </div>
)}
```

**Location in code:** After canvas render, before closing main container div

---

#### 2B. VisualAnnotationIsland - Annotations Export

**File:** `src/islands/VisualAnnotationIsland.tsx`

**Changes:**
1. Add "Export All" button to toolbar (line ~520, near Save button)
2. Dispatch export event with all annotations

```typescript
// Add to toolbar (find existing Save button section)
{annotations.length > 0 && (
  <button
    onClick={() => {
      window.dispatchEvent(new CustomEvent('export:annotations-requested', {
        detail: {
          annotations: annotations.map(a => ({
            id: a.id,
            label: a.label || '',
            note: a.note || '',
            bbox: { x: a.x, y: a.y, width: a.width, height: a.height },
            confirmed: a.confirmed || false,
            pageNumber: props.page || 1
          })),
          documentId: props.documentId,
          includeMetadata: true
        }
      }));
    }}
    className="vai-btn vai-btn-secondary"
    data-testid="export-annotations-btn"
    disabled={isSaving}
  >
    <i className="fas fa-download mr-1"></i>
    Export ({annotations.length})
  </button>
)}
```

**Location:** Inside toolbar div, after Save button (around line 530)

---

#### 2C. DocumentContentIsland - Text Selection Export

**File:** `src/islands/DocumentContentIsland.tsx`

**Changes:**
1. Add selection detection on mouseup
2. Show floating toolbar with export button
3. Dispatch text export event

```typescript
// Add state
const [selectedText, setSelectedText] = useState('');
const [selectionBounds, setSelectionBounds] = useState<DOMRect | null>(null);

// Add selection handler
useEffect(() => {
  const handleSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || '';
    
    if (text && contentRef.current?.contains(selection?.anchorNode || null)) {
      setSelectedText(text);
      
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (rect) setSelectionBounds(rect);
    } else {
      setSelectedText('');
      setSelectionBounds(null);
    }
  };
  
  document.addEventListener('mouseup', handleSelection);
  return () => document.removeEventListener('mouseup', handleSelection);
}, []);

// Export handler
const handleExportText = (format: 'txt' | 'pdf') => {
  window.dispatchEvent(new CustomEvent('export:text-requested', {
    detail: {
      text: selectedText,
      format: 'plain',
      metadata: {
        documentId: documentId,
        timestamp: new Date().toISOString()
      }
    }
  }));
  
  setSelectedText('');
  setSelectionBounds(null);
  window.getSelection()?.removeAllRanges();
};

// Add to render: Floating toolbar
{selectedText && selectionBounds && (
  <div
    className="fixed bg-gray-900 text-white rounded shadow-lg px-3 py-2 flex gap-2 z-50"
    style={{
      left: selectionBounds.left + (selectionBounds.width / 2) - 75,
      top: selectionBounds.top - 45
    }}
  >
    <button
      onClick={() => handleExportText('txt')}
      className="text-xs font-mono hover:bg-gray-700 px-2 py-1 rounded"
      data-testid="export-text-txt"
    >
      TXT
    </button>
    <button
      onClick={() => handleExportText('pdf')}
      className="text-xs font-mono hover:bg-gray-700 px-2 py-1 rounded"
      data-testid="export-text-pdf"
    >
      PDF
    </button>
  </div>
)}
```

**Location:** Portal to document.body or fixed position container

---

### Phase 3: Modal UX Polish (1 hour)

**File:** `src/islands/ExportPanelIsland.tsx`

**Current state:** Placeholder modal  
**Enhancement needed:** Add proper loading states, progress feedback, error handling

```typescript
// Enhance modal UI (lines 100-195)
{showModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 pointer-events-auto">
    <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
      {!loading && !error && (
        <>
          <h2 className="text-xl font-semibold mb-4">Export {exportType}</h2>
          <p className="text-gray-600 mb-6">
            Choose format for export:
          </p>
          
          {/* Format selector based on type */}
          <div className="flex gap-3 mb-6">
            {exportType === 'region' && (
              <>
                <button
                  onClick={() => { setFormat('png'); handleExport(); }}
                  className={`flex-1 py-3 px-4 border-2 rounded-lg font-mono text-sm ${format === 'png' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  PNG
                </button>
                <button
                  onClick={() => { setFormat('pdf'); handleExport(); }}
                  className={`flex-1 py-3 px-4 border-2 rounded-lg font-mono text-sm ${format === 'pdf' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}`}
                >
                  PDF
                </button>
              </>
            )}
            {/* Similar for text and annotations */}
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </div>
        </>
      )}
      
      {loading && (
        <div className="text-center">
          <div className="inline-block h-8 w-8 border-4 border-gray-200 border-t-green-500 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-700 font-medium">Exporting {exportType}...</p>
          <p className="text-xs text-gray-500 mt-2 font-mono">{format.toUpperCase()}</p>
        </div>
      )}
      
      {error && (
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠</div>
          <h3 className="text-lg font-semibold text-red-600 mb-2">Export Failed</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => { setError(null); setShowModal(false); }}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Close
          </button>
        </div>
      )}
    </div>
  </div>
)}
```

---

### Phase 4: Testing Strategy (2 hours)

#### Unit Tests

**File:** `test/routes/api/export.test.js` (NEW)

```javascript
const request = require('supertest');
const app = require('../../server');

describe('Export API Routes', () => {
  const mockToken = 'test-jwt-token';
  
  describe('POST /api/export/region', () => {
    it('should export region as PNG', async () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgo...';
      const res = await request(app)
        .post('/api/export/region')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ imageBase64: base64, format: 'png' })
        .expect(200)
        .expect('Content-Type', /image\/png/);
      
      expect(res.headers['content-disposition']).toMatch(/region-.*\.png/);
    });
    
    it('should return 400 for invalid format', async () => {
      const res = await request(app)
        .post('/api/export/region')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({ imageBase64: 'data:image/png;base64,...', format: 'invalid' })
        .expect(400);
      
      expect(res.body.error).toBe('Invalid format');
    });
  });
  
  // Similar tests for /export/text and /export/annotations
});
```

#### E2E Tests

**File:** `test/e2e/export-feature.spec.ts` (NEW)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Export Feature E2E', () => {
  test('should export visual region from workspace', async ({ page }) => {
    await page.goto('/workspace');
    
    // Wait for document to load
    await page.waitForSelector('[data-testid="overlay-viewer-island"]');
    
    // Draw selection on canvas
    const canvas = page.locator('canvas').first();
    await canvas.click({ position: { x: 100, y: 100 } });
    await canvas.dispatchEvent('mousedown', { clientX: 100, clientY: 100 });
    await canvas.dispatchEvent('mousemove', { clientX: 300, clientY: 300 });
    await canvas.dispatchEvent('mouseup', { clientX: 300, clientY: 300 });
    
    // Export button should appear
    await expect(page.locator('[data-testid="export-region-png"]')).toBeVisible();
    
    // Click export (triggers download)
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-region-png"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/region-.*\.png/);
  });
  
  test('should export text selection', async ({ page }) => {
    await page.goto('/workspace');
    
    // Select text in content viewer
    await page.locator('[data-testid="document-content"]').dblclick();
    
    // Export toolbar should appear
    await expect(page.locator('[data-testid="export-text-txt"]')).toBeVisible();
    
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-text-txt"]');
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toMatch(/text-export-.*\.txt/);
  });
});
```

---

## 7. Acceptance Criteria

**Must Have (MVP):**
- [x] ExportPanelIsland wired in document-workspace.ejs
- [ ] Backend routes: /api/export/region, /api/export/text, /api/export/annotations
- [ ] OverlayViewerIsland: Export button on region selection (PNG only)
- [ ] VisualAnnotationIsland: "Export All" button (JSON only)
- [ ] DocumentContentIsland: Text selection export (TXT only)
- [ ] All exports download with correct Content-Disposition headers
- [ ] Success toast notifications after export
- [ ] Error handling with user-friendly messages

**Should Have (Polish):**
- [ ] PDF format support for regions and text
- [ ] Loading states with progress indicators
- [ ] Keyboard shortcuts (Cmd/Ctrl+Shift+E to export selection)
- [ ] Export filename includes document title + timestamp
- [ ] Metadata included in JSON exports (document info from Paperless)

**Could Have (Future):**
- [ ] Batch export multiple regions
- [ ] Export templates (customizable PDF layouts)
- [ ] Cloud upload integration (Google Drive, Dropbox)
- [ ] Email export option

---

## 8. Technical Constraints

**Compatibility:**
- Browser must support Canvas API (toDataURL)
- File downloads require modern browser (Chrome 60+, Firefox 54+, Safari 11+)
- Base64 encoding limited to 10MB for region exports

**Performance:**
- Region export: < 500ms for typical 1920x1080 selection
- Text export: < 200ms for up to 100KB text
- Annotations export: < 100ms for up to 500 annotations

**Security:**
- All endpoints require authentication (JWT or API key)
- Validate file size limits to prevent DoS
- Sanitize filenames to prevent path traversal

---

## 9. Implementation Handoff Checklist

**For Backend Implementer:**
- [ ] Install dependencies: `npm install pdfkit`
- [ ] Create `routes/api/export.js` with all 3 endpoints
- [ ] Register routes in `server.js` at line ~674
- [ ] Add Swagger documentation to all endpoints
- [ ] Write unit tests in `test/routes/api/export.test.js`
- [ ] Test manually with curl/Postman

**For Frontend Implementer:**
- [ ] Modify `OverlayViewerIsland.tsx`: Add region export button + dispatch
- [ ] Modify `VisualAnnotationIsland.tsx`: Add "Export All" button + dispatch
- [ ] Modify `DocumentContentIsland.tsx`: Add text selection toolbar + dispatch
- [ ] Polish `ExportPanelIsland.tsx`: Enhance modal UI with loading/error states
- [ ] Write E2E tests in `test/e2e/export-feature.spec.ts`
- [ ] Rebuild islands: `npm run build:islands`
- [ ] Test in browser with real documents

**For QA:**
- [ ] Verify all export formats produce valid files
- [ ] Test with edge cases (empty selection, huge images, special characters)
- [ ] Check mobile/tablet behavior (touch selection)
- [ ] Validate keyboard navigation and accessibility

---

## 10. Open Questions for Product

1. **Region PDF layout:** Should PDFs preserve exact pixel dimensions or fit to A4/Letter?
2. **Annotation export scope:** Export only current page or all pages with annotations?
3. **Text export metadata:** Include document URL, tags, correspondent?
4. **Rate limiting:** Should exports be throttled per user (e.g., 50/hour)?

---

**Architecture Sign-off:** Ready for implementation. Estimate 2-3 days for backend + frontend integration + testing.
