# Playground Refactor Summary

> **Phase 4 Ticket: 017.x Refactor Playground**
>
> This document summarizes the refactored Playground architecture using Islands.

## Overview

The Playground has been refactored from a document grid view to a **Visual RAG Debugger** using the Islands architecture pattern.

### Key Changes

| Component | Before | After |
|-----------|--------|-------|
| Route | Required document data | Simple render, no data fetch |
| View | EJS with inline JS | Island anchor with hydration |
| AI Provider | openai/azure/custom/ollama | Ollama-only + VisualSearchClient |
| UI | Document grid | Visual debugger with canvas |

---

## Architecture

### File Structure

```
src/
  islands/
    PlaygroundIsland.tsx     # Main island component
  ui/
    contracts/
      Playground.contract.ts  # Zod schemas
routes/
  setup.js                   # GET /playground route (simplified)
  api/
    visual-rag.js            # POST /api/visual-rag/search/visual
views/
  playground.ejs             # Template with island anchor
```

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ PlaygroundIsland│────▶│ /api/visual-rag │────▶│VisualSearchClient│
│ (Island)        │     │ /search/visual  │     │ (Alpha-9)        │
└────────┬────────┘     └─────────────────┘     └─────────┬────────┘
         │                                                 │
         │ Base64 Image + Collection                       │
         │                                                 │
         │              ┌─────────────────┐               │
         └─────────────▶│ Qdrant (320D)   │◀──────────────┘
                        │ visual_pages    │
                        │ visual_overlays │
                        └─────────────────┘
```

---

## Components

### 1. PlaygroundIsland

Main island component providing:

- **Image Upload**: Upload document images for testing
- **Red Pen Drawing**: Draw bounding boxes to define search regions
- **Collection Selector**: Choose between `visual_pages` and `visual_overlays`
- **Sidecar Status**: Real-time GPU/model status display
- **Search Results**: MaxSim scores and document matches
- **Payload Inspector**: View raw Qdrant payloads

### 2. Sidecar Status Display

Shows the current state of the Visual RAG sidecar:

| State | Badge | Meaning |
|-------|-------|---------|
| `ready` | 200 OK (green) | Sidecar is ready for queries |
| `initializing` | 503 Initializing (yellow) | GPU model loading |
| `error` | Error (red) | Connection failed |
| `unknown` | Unknown (gray) | Not yet checked |

### 3. GPU Preparing Modal

When sidecar returns 503, a modal is displayed:

```
┌─────────────────────────────┐
│        GPU Preparing        │
│   ColQwen3-4B-AWQ loading   │
│   Expected VRAM: ~3.5GB     │
└─────────────────────────────┘
```

### 4. Payload Inspector

Displays Qdrant payloads in formatted or raw JSON:

```json
{
  "doc_id": 12345,
  "correspondent_id": 42,
  "tag_ids": [1, 2, 3],
  "created_date": "2024-01-15",
  "page_num": 1
}
```

---

## API Endpoints

### GET /playground

Renders the playground template with the island anchor.

**Response**: HTML page with `data-island="playground-island"`

### GET /api/visual-rag/health

Check sidecar health status.

**Response**:
```json
{
  "visualSearchClient": true,
  "overlayRepository": true,
  "model_loaded": true
}
```

### POST /api/visual-rag/search/visual

Alpha-9 Protocol visual search endpoint.

**Request**:
```json
{
  "image": "<base64>",
  "collection": "visual_pages",
  "filters": {
    "doc_id": 12345,
    "tag_ids": [1, 2]
  },
  "k": 5
}
```

**Response**:
```json
{
  "success": true,
  "query": "[IMAGE]",
  "collection": "visual_pages",
  "scoreType": "maxsim",
  "executionTimeMs": 142,
  "results": [
    {
      "docId": 123,
      "score": 0.85,
      "pageNum": 1
    }
  ]
}
```

**503 Response** (Sidecar Initializing):
```json
{
  "success": false,
  "error": "Visual search sidecar is initializing",
  "type": "SIDECAR_INITIALIZING",
  "fallback": "text_only_rag_available"
}
```

---

## Contracts

### PlaygroundSchema

```typescript
const PlaygroundSchema = z.object({
  mode: z.enum(['visual-debug', 'text-debug']).default('visual-debug'),
  collection: z.enum(['visual_pages', 'visual_overlays']).default('visual_pages'),
  gpuState: z.enum(['idle', 'checking', 'preparing', 'ready', 'error']).default('idle'),
  documentId: z.number().int().nullable().optional()
});
```

### BoundingBoxSchema

```typescript
const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1)
});
```

### SidecarStatusSchema

```typescript
const SidecarStatusSchema = z.object({
  state: z.enum(['unknown', 'initializing', 'ready', 'error']),
  model: z.string().optional(),
  vram: z.object({
    used_mb: z.number().nonnegative().optional(),
    total_mb: z.number().nonnegative().optional()
  }).optional(),
  error: z.string().optional()
});
```

---

## Testing

### Contract Tests

Located in `test/unit/frontend/contracts.spec.ts`:

- PlaygroundSchema validation
- BoundingBoxSchema normalized coordinates
- SidecarStatusSchema state transitions
- QdrantPayloadSchema validation

### E2E Tests

Located in `test/e2e/playground*.spec.ts`:

- Page loads with island mounted
- Collection selector changes state
- Image upload and drawing
- Search triggers API call
- 503 handling displays modal
- Results render correctly

### Running Tests

```bash
# Contract tests
npm test -- test/unit/frontend/contracts.spec.ts

# E2E tests
npm run verification:e2e -- test/e2e/playground*.spec.ts
```

---

## Usage

### Local Development

1. Start the application:
   ```bash
   npm run dev
   ```

2. Navigate to `/playground`

3. Upload an image or capture from clipboard

4. Enable Draw mode and select a region

5. Click "Search Collection"

6. View results and payloads

### Debugging 503 Errors

If the sidecar returns 503:

1. Check sidecar logs:
   ```bash
   docker logs visual_rag --tail 100
   ```

2. Verify GPU memory:
   ```bash
   nvidia-smi
   ```

3. Wait for model to load (~30s on first start)

---

## Migration Notes

### Removed Dependencies

The following imports were removed from the playground route:

- `openaiService` (proprietary)
- `azureService` (proprietary)
- `customService` (proprietary)

### Retained Dependencies

- `ollamaService` (local/open-source)
- `VisualSearchClient` (Alpha-9 Protocol)

### Breaking Changes

The `/manual/playground` POST endpoint still supports multiple AI providers for backward compatibility, but the new visual playground uses only local services.

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-01-18 | 1.0.0 | Initial playground refactor |

---

## References

- **Epic Brief**: Structured Feature Development Workflow
- **Phase 4 Spec**: 017 Refactor Playground
- **Architecture**: Native Protocol Alpha-9
- **Hardware**: RTX 3090 Ti (Ampere SM86)
