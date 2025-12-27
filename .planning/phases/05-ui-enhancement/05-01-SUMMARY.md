# Summary: 05-01 OverlayExtractor Format Update

**Plan**: Phase 5, Plan 01 - Update OverlayExtractor output format
**Status**: Complete
**Completed**: 2025-12-26

## What Was Done

### Task 1: Update OverlayExtractor Output Format
Updated `services/visual-rag/OverlayExtractor.js`:
- Changed from `box: [ymin, xmin, ymax, xmax]` to `boundingBox: { x, y, width, height }`
- Added new fields: id (UUID), value, domain, color, paperlessMapping, isMandatory
- Preserved legacy format (box array, x_min, y_min, etc.) for backwards compatibility
- Updated `_normalizeOverlay()` to produce Visual RAG Detection Agent format

### Task 2: Update DOMAIN_PROMPTS with Field Specifications
- Created `buildDomainPrompt()` function to generate prompts from field specs
- Prompts now include mandatory field indicators and exact labels
- All 4 domains (financial, medical, legal, general) generate prompts automatically

### Task 3: Create overlayConfig.js
Created `services/visual-rag/overlayConfig.js`:
- DOMAIN_COLORS: Color palettes for each domain
- DOMAIN_FIELD_SPECS: 38 fields across 4 domains with colors and mappings
- Helper functions: getColorForLabel, getPaperlessMapping, isMandatoryField, getLegendForDomain
- Label aliases for common detection label variations

## Files Created/Modified

**Created:**
- `services/visual-rag/overlayConfig.js` - Domain field specifications and helpers

**Modified:**
- `services/visual-rag/OverlayExtractor.js` - New output format
- `services/visual-rag/index.js` - Export overlayConfig

## Verification Results

```
npm test
87 passing (3s)
```

Field Counts:
```
financial: 11 fields, 3 mandatory
medical: 10 fields, 4 mandatory
legal: 9 fields, 3 mandatory
general: 8 fields, 3 mandatory
```

New Format Output:
```javascript
{
  id: "6f7b3c1d-...",
  label: "Total",
  value: "1.250,00 EUR",
  domain: "FINANCIAL",
  color: "#C2410C",
  boundingBox: { x: 300, y: 800, width: 200, height: 50 },
  paperlessMapping: "custom_field: invoice_total",
  isMandatory: false,
  confidence: 0.92,
  pageNumber: 1,
  // Legacy fields preserved
  box: [800, 300, 850, 500],
  x_min: 300,
  y_min: 800
}
```

## Domain Color Scheme

| Domain | Primary | Range |
|--------|---------|-------|
| FINANCIAL | #F97316 (Orange) | #FFF7ED → #9A3412 |
| MEDICAL | #22C55E (Green) | #BBF7D0 → #065F46 |
| LEGAL | #A855F7 (Purple) | #E9D5FF → #581C87 |
| GENERAL | #3B82F6 (Blue) | #93C5FD → #1D4ED8 |

## API Summary

```javascript
const { overlayConfig } = require('./services/visual-rag');

// Get color for a label
overlayConfig.getColorForLabel('Total', 'financial'); // '#C2410C'

// Get paperless-ngx mapping
overlayConfig.getPaperlessMapping('Invoice #', 'financial'); // 'title'

// Check if mandatory
overlayConfig.isMandatoryField('Inv Date', 'financial'); // true

// Get legend for UI display
const legend = overlayConfig.getLegendForDomain('financial');
// Returns array of { key, label, color, mapping, isMandatory }
```

## Next Steps

Proceed to **Plan 05-02**: Create OverlayViewer and OverlayLegend React components
