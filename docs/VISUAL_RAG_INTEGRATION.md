# Visual RAG Integration Architecture

This document provides a comprehensive overview of the Visual RAG sidecar integration into the paperless-ai document processing pipeline.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Visual-first Retrieval (V2)](#visual-first-retrieval-v2)
3. [Circuit Breaker Pattern](#circuit-breaker-pattern)
4. [Parallel Execution Strategy](#parallel-execution-strategy)
5. [Visual Query Generation](#visual-query-generation)
6. [Dynamic K Selection](#dynamic-k-selection)
7. [Deduplication Strategy](#deduplication-strategy)
8. [Metrics Reference](#metrics-reference)
9. [Configuration](#configuration)
10. [Model & Build Requirements (ColQwen3-only)](#model--build-requirements-colqwen3-only)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The Visual RAG integration enhances the document processing pipeline with visual retrieval capabilities, field detection with bounding boxes, and expert-driven question generation. In V2, visual retrieval is the default for query answering with text retrieval as a fallback via RAGZ.

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Document Processor                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Stage 4: Parallel Execution                     │  │
│  │                                                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │  │
│  │  │ Visual OCR  │  │ Tesseract    │  │ Visual Element  │ │  │
│  │  │ (qwen3-vl)  │  │ OCR (API)    │  │ Detection       │ │  │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘ │  │
│  │         │                │                    │           │  │
│  │         └────────────────┴────────────────────┘           │  │
│  │                          │                                │  │
│  │                   OCR Reconciliation                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Stage 5: Extraction                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Stage 5.5: Visual Query Generation                   │  │
│  │      (Guidance Template: visual_query_generator_de)       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Stage 8: Visual Query Execution                 │  │
│  │                                                           │  │
│  │  ┌──────────────────────────────────────────────────┐    │  │
│  │  │        Circuit Breaker                            │    │  │
│  │  │  ┌────────────────────────────────────────────┐  │    │  │
│  │  │  │  Execute Queries (max 5 concurrent)        │  │    │  │
│  │  │  │  - Dynamic K Selection                      │  │    │  │
│  │  │  │  - Visual RAG Sidecar                       │  │    │  │
│  │  │  │  - Result Deduplication (IoU > 0.6)         │  │    │  │
│  │  │  └────────────────────────────────────────────┘  │    │  │
│  │  └──────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                  │
│                    Enhanced Extraction                         │
│                    (with visual overlays)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Service Dependencies

| Service | Port | Purpose |
|---------|------|---------|
| Visual RAG Sidecar | 8001 | ColQwen3-only visual retrieval (`TomoroAI/tomoro-colqwen3-embed-8b`). Rejects `vidore/colqwen2-v1.0` at startup; 320-d embeddings, 32k context. |
| RAGZ Text Retrieval | Configurable | Text retrieval fallback (pgvector `document_embeddings.embedding vector(384)`). |
| Paperless-ngx API | 8000 | Document metadata and Tesseract OCR |
| Guidance Service | 8002 | Constrained query generation |
| Bias Engine | 50051 | Logit bias for deterministic generation |
| Prometheus | 9091 | Metrics collection |

---

## Visual-first Retrieval (V2)

Visual retrieval is the default for query answering. Text retrieval is optional and used only for validation or fallback.

```
User Query -> Query Router -> Visual Retrieval (default)
                            -> Context Pack Builder -> Guidance Response -> Action Orchestrator
                \-> Text Retrieval (optional) ->/
```

Key rules:
- Visual RAG and RAGZ are separate services with distinct vector columns.
- Context Pack inputs must include visual hits + OCR snippets, not raw OCR dumps.
- Evidence refs are required for any extracted fields or actions.

---

## Circuit Breaker Pattern

The circuit breaker protects the pipeline from Visual Sidecar failures and implements graceful degradation.

### State Machine

```
        Success Count > 0
    ┌──────────────────────────┐
    │                          │
    ▼                          │
 CLOSED ───────────────────> OPEN
(Normal)    3 Failures      (Failing)
    ▲                          │
    │      Success             │
    │   ┌──────────┐           │ 30s Cooldown
    │   │          │           │
    └───┤HALF_OPEN │◄──────────┘
        │ (Testing)│
        └──────────┘
            │ Failure
            └──────────> OPEN
```

### State Behaviors

| State | Visual Operations | Pipeline Behavior |
|-------|-------------------|-------------------|
| **CLOSED** | All allowed | Normal execution with 500ms latency budget |
| **OPEN** | Skip gracefully | Fallback to extraction-only mode, no failures |
| **HALF_OPEN** | Single attempt | Testing recovery, limited retries |

### Configuration

```javascript
const circuitBreakerConfig = {
  failureThreshold: 3,        // Consecutive failures to open circuit
  cooldownPeriod: 30000,      // 30 seconds before attempting recovery
  timeout: 500,               // 500ms query-level latency budget
  hardTimeout: 1000,          // 1000ms hard limit
  maxRetries: 3,              // Maximum retry attempts
  backoffMultiplier: 2,       // Exponential backoff multiplier
  initialBackoff: 100         // Initial backoff in ms (100, 200, 400)
};

const visualSearchClientConfig = {
  baseUrl: 'http://visual-rag:8001',
  timeout: 30000,             // 30s for long operations (indexing)
  queryTimeout: 500,          // 500ms for search queries (default)
  maxConcurrent: 5,           // Max concurrent visual queries
  retries: 2,                 // Retry attempts for transient failures
  healthCheckInterval: 60000  // 1 minute cache for availability checks
};
```

**Timeout Hierarchy:**
- Query operations: 500ms (soft), 1000ms (hard) - used for search
- Health checks: 3000ms minimum - more tolerant for startup
- Indexing operations: 30000ms - allow for large documents
- Circuit breaker respects operation-specific timeouts via options

### Graceful Degradation

When circuit breaker is **OPEN**:
1. Skip visual query generation (Stage 5.5)
2. Skip visual query execution (Stage 8)
3. Set `context.visualSidecarAvailable = false`
4. Continue with extraction-only pipeline
5. Log degraded mode warning
6. Return valid results without visual enhancements

**Critical**: Pipeline must never fail due to Visual Sidecar unavailability.

---

## Parallel Execution Strategy

### Stage 4: Parallel OCR + Visual Element Detection

**Implementation**: `ParallelOcrExecutor.js` (Phase 2)

Three tracks execute concurrently using `Promise.all()` with circuit breaker protection:

#### Track 1: Visual OCR
- **Model**: `qwen3-vl:8b` via Ollama service
- **Timeout**: 500ms (soft), 1000ms (hard)
- **Circuit Breaker**: `visual-ocr` service
- **Output**: Visual OCR text + confidence scores
- **Method**: `_executeVisualOcrTrack()`
- **Prompt**: Document-type-aware extraction prompts
  - Medical: Focus on patient info, dates, medical terminology
  - Financial: Focus on numbers, amounts, tables
  - Legal: Focus on headings, dates, precise wording
  - General: Standard text extraction

#### Track 2: Tesseract OCR
- **Source**: Paperless-ngx API `/api/documents/{id}/`
- **Field**: `content` (Tesseract OCR output)
- **Timeout**: 300ms
- **Circuit Breaker**: `tesseract-ocr` service
- **Parallel execution** with Track 1
- **Method**: `_executeTesseractOcrTrack()`
- **Metadata**: Document type inference from tags/title

#### Track 3: Visual Element Detection ⚠️ NOT IMPLEMENTED (Feature Gap)

**Status**: The `/detect_elements` endpoint is called by `ParallelOcrExecutor` but NOT implemented in the visual-rag-sidecar.

**Intended Design**:
- **Endpoint**: `POST /detect_elements` on Visual RAG sidecar
- **Request**: `{ image: <base64>, detect_types: [...] }`
- **Response**: `{ elements: [], layout: {}, confidence: <0..1> }`
- **Timeout**: 500ms
- **Circuit Breaker**: `visual-elements` service
- **Detection Types**:
  - Tables
  - Images/figures
  - Text blocks
  - Layout zones
- **Method**: `_executeVisualElementsTrack()` (services/experts/ParallelOcrExecutor.js:467-548)

**Why It's Missing**:
- ColQwen3 (TomoroAI/tomoro-colqwen3-embed-8b) is a **visual retrieval model**, not a layout analysis model
- Visual retrieval (finding similar pages) ≠ Element detection (finding tables/figures with bounding boxes)
- Requires dedicated layout model: LayoutLMv3, Detectron2, or Table Transformer

**Current Behavior**:
- HTTP 404/503 on `/detect_elements` call
- Circuit breaker opens after 3 failures
- Pipeline continues gracefully without layout elements
- `visual_elements` will be null in Stage 4 output
- OCR reconciliation proceeds normally with Track 1 + Track 2 results

**Implementation Options**:
1. **Add LayoutLMv3 to sidecar** (recommended for production quality)
2. **Use visual queries instead** (leverage ColQwen3 search for "pseudo-element" detection)
3. **Disable Track 3 formally** (accept current state as interim solution)

See `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` for detailed implementation guidance.

**Note: PDF DPI & Video Sampling**

- **PDF Rendering DPI**: For ColQwen3 (Tomoro) indexing, we recommend rendering PDFs at **300 DPI** (`VISION_RENDER_DPI`) as a sensible default. Higher DPI improves detection of tables, small fonts and charts but increases memory usage and index size; tune based on your documents and available GPU memory.

- **Video Frame Sampling**: When indexing videos, sample frames at a configurable interval (e.g., one frame per second or every Nth frame). Use domain-aware sampling (keyframe detection or scene change detection) to reduce index size while retaining relevant frames.

### Integration in ExpertPipelineExecutor

```javascript
// In pipeline stage definition:
{
  id: 'parallel-ocr',
  type: StageType.TEXT_EXTRACTION,
  useParallelOcr: true,  // Triggers parallel OCR execution
  outputKey: 'ocr',
  metadata: {
    documentType: 'general'  // Can be overridden by classification
  }
}
```

The executor automatically:
1. Detects `useParallelOcr: true` flag
2. Routes to `_executeParallelOcrStage()` method
3. Executes all 3 tracks in parallel
4. Reconciles OCR results
5. Sets backward-compatible fields (`context.document.ocr_text`, `context.document.text`)
6. Provides graceful degradation on failure

### OCR Reconciliation Logic

```javascript
if (visualOcr && tesseractOcr) {
  // Both sources succeeded - reconcile
  const merged = mergeOcrResults(visualOcr, tesseractOcr);
  return {
    text: merged.text,
    primarySource: merged.primarySource,
    conflictRate: merged.conflicts.length
  };
} else if (visualOcr || tesseractOcr) {
  // Single source succeeded
  return {
    text: visualOcr || tesseractOcr,
    primarySource: visualOcr ? 'visual' : 'tesseract',
    conflictRate: 0
  };
} else {
  // Both failed
  throw new Error('All OCR sources failed');
}
```

### Document Type Biasing

**Implementation**: `_reconcileOcrResults()` in `ParallelOcrExecutor.js`

The reconciliation strategy adapts based on document type:

| Document Type | Strategy | Rationale |
|---------------|----------|-----------|
| **Medical** | Prefer Visual OCR | Better at structured forms, checkboxes, and tables |
| **Financial** | Prefer Visual OCR | Superior for numbers, amounts, and tabular data |
| **Legal** | Prefer Tesseract | Better for text-heavy documents with precise wording |
| **Scanned** | Prefer Visual OCR | Better visual understanding of scanned content |
| **Digital** | Prefer Tesseract | Better text extraction from native PDFs |
| **General** | Quality-based | Uses existing `mergeOcrResults()` utility with quality scoring |

For **scanned documents**:
```javascript
reconciliationOptions.preferVisual = true;
reconciliationOptions.fallbackStrategy = 'visual';
```

For **digital documents**:
```javascript
reconciliationOptions.preferVisual = false;
reconciliationOptions.fallbackStrategy = 'paperless';
```

### Conflict Detection

Conflict rate is calculated based on:
- Length ratio between sources
- Character overlap (set intersection/union)
- Combined metric: `(lengthRatio * 0.5) + ((1 - charOverlap) * 0.5)`
- Threshold: Conflicts > 10% trigger warnings and logging

---

## Visual Query Generation

### Stage 5.5: Query Generation Workflow

```
Extraction Result
       │
       ▼
Identify Missing/Low-Confidence Fields
       │
       ▼
Guidance Template: visual_query_generator_de
       │
       ├─ Input: extraction_result
       ├─ Input: ocr_text
       ├─ Input: field_schema (from Paperless API)
       └─ Input: visual_elements
       │
       ▼
Generate Minimum 3 Queries
       │
       ├─ question: "Where is the invoice number located?"
       ├─ field_target: "invoice_number"
       ├─ expected_element_type: "field_extraction"
       ├─ priority: 0.9
       ├─ confidence: 0.5
       └─ rarity_factor: 0.2
       │
       ▼
Validation
       │
       ├─ At least 3 queries?
       ├─ Required fields present?
       └─ Field targets in schema?
       │
       ▼
Store in context.outputs.visual_queries
```

### Query Schema

```json
{
  "queries": [
    {
      "question": "Locate the invoice total amount with bounding box",
      "field_target": "total_amount",
      "expected_element_type": "field_extraction",
      "priority": 0.9,
      "confidence": 0.7,
      "rarity_factor": 0.1
    }
  ]
}
```

### Domain-Specific Templates

- **Financial**: `financial_visual_query_generator_de`
  - Focus: Invoice numbers, totals, IBAN, dates
- **Medical**: `medical_visual_query_generator_de`
  - Focus: Patient ID, diagnosis codes, signatures
- **Legal**: `legal_visual_query_generator_de`
  - Focus: Case numbers, dates, parties, signatures

---

## Dynamic K Selection

### Formula

```
K = base_K * (1 + (1 - confidence)) * (1 + rarity_factor)
```

### Base K Values

| Query Type | Base K | Use Case |
|------------|--------|----------|
| `field_extraction` | 3 | High precision for critical fields |
| `validation` | 5 | Moderate recall for validation |
| `exploration` | 10 | High recall for discovery |

### Examples

**High Confidence Field (confidence=0.9, rarity=0.1)**
```
K = 3 * (1 + (1 - 0.9)) * (1 + 0.1)
K = 3 * 1.1 * 1.1 = 3.63 ≈ 4
```

**Low Confidence Rare Field (confidence=0.4, rarity=0.8)**
```
K = 3 * (1 + (1 - 0.4)) * (1 + 0.8)
K = 3 * 1.6 * 1.8 = 8.64 ≈ 9
```

### Adaptive Behavior

- Low confidence → Higher K → More candidates → Better coverage
- High rarity → Higher K → Compensate for sparse training data
- High confidence + common field → Lower K → Faster execution

---

## Deduplication Strategy

### Intersection over Union (IoU)

Bounding boxes with **IoU > 0.6** are considered duplicates (config default 0.7 with 0.1 tolerance).

```javascript
function calculateIoU(box1, box2) {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

  const intersectionArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;
  const unionArea = box1Area + box2Area - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}
```

### Deduplication Rules

1. **Same Page Requirement**: Only compare boxes on the same page
2. **IoU Threshold**: IoU > 0.6 triggers deduplication
3. **Confidence Selection**: Keep result with higher confidence score
4. **Metadata Preservation**: Retain query attribution from best result

### Example

```
Query 1 Result: box={x:100, y:50, w:200, h:30}, score=0.85
Query 2 Result: box={x:105, y:52, w:195, h:28}, score=0.78

IoU = 0.82 > 0.6 → Duplicate detected
Keep Query 1 Result (score 0.85 > 0.78)
```

---

## Result Processing

- Sort results by confidence score (descending).
- Match results to extracted fields by `field_target` and position.
- Overlay positions are normalized to 0–1 (x, y, width, height).
- Confidence fusion uses extraction 0.6 / visual 0.4.
- Evidence refs are required for visual confirmations and newly discovered fields.

---

## Internal API: Visual Image Search

### POST /api/visual-rag/search/visual ⚡️

- Description: Search for documents using an image region (base64) as the query. Proxies to the Visual RAG Sidecar and is protected by the circuit breaker.
- Request Body (application/json):
  - `image` (string, required): Base64-encoded image region (recommended min size 1KB). Whitespace is ignored.
  - `k` (integer, optional): Number of results to return (default: 5).
  - `includeOverlays` (boolean, optional): Whether to include overlays in returned results.
- Headers:
  - `X-Request-Id` (optional): Correlation id; forwarded to the sidecar and included in structured logs.
- Responses:
  - 200: { success: true, query: "[IMAGE]", results: [...], totalResults }
  - 400: Missing or invalid `image` (base64)
  - 503: Circuit breaker open; service temporarily unavailable. Response includes `circuit_breaker: 'open'` and metrics are emitted (`circuit_breaker_open_total`, `sidecar_availability`).

> Notes: The server accepts large payloads up to the configured body-parser limit (default 50MB). The route performs a lightweight base64 sanity check and returns 400 for malformed images.


## Metrics Reference

### Prometheus Metrics

#### OCR Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `ocr_visual_latency_ms` | Histogram | Visual OCR latency | document_type |
| `ocr_tesseract_latency_ms` | Histogram | Tesseract OCR latency | document_type |
| `ocr_reconciliation_conflict_rate` | Gauge | Conflict rate between OCR sources | document_type |

**Buckets**: [50, 100, 200, 500, 1000, 2000]

#### Visual RAG Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `sidecar_availability` | Gauge | Sidecar availability (0=down, 1=up) | service |
| `field_detection_f1` | Gauge | F1 score for field detection | document_type |
| `embedding_query_latency_ms` | Histogram | Visual embedding query latency | query_type |
| `visual_query_execution_time_ms` | Histogram | Total visual query execution time | document_type |
| `visual_element_detection_latency_ms` | Histogram | Visual element detection latency | element_type |
| `visual_queries_executed_total` | Counter | Total queries executed | document_type, query_type |

#### Circuit Breaker Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `circuit_breaker_state` | Gauge | State: 0=CLOSED, 1=OPEN, 2=HALF_OPEN | service |
| `circuit_breaker_transitions_total` | Counter | Total state transitions | service, from_state, to_state |

### Target SLOs

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Visual sidecar latency (p95) | < 500ms | > 1000ms |
| Sidecar availability | > 99.5% | < 95% |
| Field detection F1 | > 0.92 | < 0.85 |
| Embedding query latency | < 100ms | > 300ms |
| OCR conflict rate | < 10% | > 20% |
| Query generation latency (p95) | < 200ms | > 500ms |
| Per-query execution latency (p95) | < 500ms | > 1000ms |
| 5 concurrent queries total (p95) | < 500ms | > 1000ms |
| End-to-end per document (p95) | < 2000ms | > 4000ms |
| Metrics overhead | < 5% | > 10% |

---

## Internal API Reference

### Visual Search Endpoint (Sidecar Proxy)

**POST** `/api/visual-rag/search/visual`

Internal endpoint that proxies requests to the Visual RAG Sidecar, protected by the Circuit Breaker.

**Request Headers:**
- `X-Request-Id`: Request ID for tracing (propagated to sidecar)

**Request Body:**
```json
{
  "image": "base64_encoded_image_string...",
  "k": 5,
  "includeOverlays": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "query": "[IMAGE]",
  "results": [
    {
      "docId": 123,
      "score": 0.85,
      "base64": "..."
    }
  ],
  "totalResults": 1
}
```

**Response (503 Service Unavailable):**
Returned when the Circuit Breaker is OPEN or the sidecar is unreachable.
```json
{
  "success": false,
  "error": "Visual search service is temporarily unavailable",
  "circuit_breaker": "open"
}
```

## Configuration

### Environment Variables

```bash
# Visual RAG Sidecar
VISUAL_RAG_URL=http://visual-rag:8001
VISUAL_RAG_ENABLED=yes
VISUAL_RAG_MODEL=TomoroAI/tomoro-colqwen3-embed-8b  # fixed; colqwen2 rejected

# ---- Visual RAG Tuning & Safety (Recommended for RTX 3090 Ti) ----
# IMPORTANT: Do NOT leave INDEX_DIR empty in docker-compose.env. An empty
# INDEX_DIR entry (e.g. `INDEX_DIR=`) results in os.getenv returning an empty
# string and Python's Path('') resolves to '.' (the container cwd), which can
# cause index mis-detection and 'invalid index' startup errors. Always set
# INDEX_DIR to the container index mount (default below).
#
# Recommended values (adjust conservatively for other GPUs):
# INDEX_DIR=/data/indices               # Container mount (must match docker-compose.yml)
# VISUAL_RAG_INDEX_DIR=/data/indices    # Keep aligned with INDEX_DIR to avoid mismatches
# VISUAL_RAG_INDEX_NAME=paperless_visual
# HF_HUB_OFFLINE=                       # Leave blank for initial run to allow one-time download; set to '1' after marker is created
# MAX_SPLIT_SIZE_MB=512                 # Mirrors PYTORCH_CUDA_ALLOC_CONF for fragmentation reduction
# PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
# VISION_RENDER_DPI=300                 # Recommended for ColQwen3 (Tomoro); higher fidelity for tables/charts (increases memory/index size)
# VIDEO_FRAME_INTERVAL=1                # Seconds between sampled frames when indexing video (lower => more frames / larger index)
# VIDEO_KEYFRAME_DETECTION=yes          # Enable keyframe/scene-change sampling to reduce redundant frames (yes|no)
# MAX_VISION_PAGES=5                    # Conservative page limit to fit multi-page docs in 24GB VRAM
# VISUAL_RAG_TIMEOUT=600000             # 10 min for long indexing / initial loads
#
# Notes:
# - Create the marker file after first successful model load:
#   /data/indices/.hf_hub_download_complete
#   (The sidecar will enforce offline behavior if the marker exists.)
# - For fully-offline deployments pre-seed the Hugging Face cache and create
#   the marker on the host before starting the container.
#
# Package requirements (see services/visual-rag-sidecar/requirements.txt):
# - byaldi >= 0.4.0        # required for ColQwen3 name patterns and API compatibility
# - transformers == 4.57.3 # Qwen2.5-VL / ColQwen3 compatibility
# - flash-attn >= 2.4.0    # if used (build for your CUDA toolkit)
# -----------------------------------------------------------------------

# Circuit Breaker
VISUAL_SIDECAR_TIMEOUT_MS=500
VISUAL_SIDECAR_HARD_TIMEOUT_MS=1000
VISUAL_SIDECAR_FAILURE_THRESHOLD=3
VISUAL_SIDECAR_COOLDOWN_MS=30000

# Dynamic K Selection
VISUAL_QUERY_BASE_K_EXTRACTION=3
VISUAL_QUERY_BASE_K_VALIDATION=5
VISUAL_QUERY_BASE_K_EXPLORATION=10

# Deduplication
VISUAL_QUERY_IOU_THRESHOLD=0.7

# Concurrency
VISUAL_QUERY_MAX_CONCURRENT=5

# Text retrieval (RAGZ) configuration is documented in docs/RAG_SYSTEMS_REFERENCE.md.

# Paperless API
PAPERLESS_API_URL=http://localhost:8000/api
PAPERLESS_API_TOKEN=<your-token>
```

### Orchestration Flags

```javascript
// In DocumentProcessor or pipeline config
{
  use_visual_rag_ingestion: true,      // Enable Visual RAG indexing
  use_visual_query_generation: true,   // Enable query generation stage
  use_visual_validation: true,         // Enable visual query execution
  visual_sidecar_timeout_ms: 500,      // Override default timeout
  dynamic_k_enabled: true              // Enable dynamic K formula
}
```

---

## Model & Build Requirements (ColQwen3-only)

- Only `TomoroAI/tomoro-colqwen3-embed-8b` is supported. Setting
  `VISUAL_RAG_MODEL=vidore/colqwen2-v1.0` triggers a startup error and requires
  re-indexing.
- Startup logs include explicit breaking-change warnings for ColQwen2 removal.
- CUDA 12.4+ is required for the sidecar build; use PyTorch `cu124` wheels.
- `flash-attn>=2.4.0` must be built against the same CUDA toolkit as PyTorch.

---

## Audit Gaps Addressed (2026-01)

The following audit gaps in the Visual RAG sidecar were identified and resolved:

### 1. Model Loading Stability (Native Detox Path)

**Problem:** The sidecar relied on fragile git-based package metadata and dynamic model loading through Byaldi's abstraction layer, causing symbol mismatches and dimension errors with ColQwen3's 320-d embeddings.

**Resolution:**
- Implemented "Native Detox Path" (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\main.py:174-316)
- Direct instantiation of `ColQwen2_5` model with explicit `projection_dim=320` config override
- Manual state dict "seaming" to translate checkpoint keys (e.g., `vlm.model.*` → base keys, `embedding_proj_layer` → `custom_text_proj`)
- Validation of shard loading with match counts logged for diagnostics
- Graceful error handling that records failures in `state.last_error` without crashing the service

**Files Modified:**
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\main.py:178-316
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\Dockerfile:45-53 (Byaldi PyPI install with version pin)

### 2. Flash Attention Build Reliability

**Problem:** Flash Attention builds failed due to ABI mismatches, missing CUDA symbols, and incorrect wheel selection for PyTorch 2.6 + CUDA 12.4.

**Resolution:**
- Automatic ABI detection at build time matching installed PyTorch (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\Dockerfile:62-78)
- Prioritized optimized v0.7.2 wheels from mjun0812/flash-attention-prebuild-wheels
- Three-tier fallback: optimized wheel → simplified wheel → source build
- Build-time smoke test to fail fast on symbol errors
- Added diagnostic script for VRAM verification (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\scripts\verify_flash_attn_vram.sh)

**Files Modified:**
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\Dockerfile:62-90
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\scripts\verify_flash_attn_vram.sh (new)

### 3. Model Dimension Configuration

**Problem:** ColQwen3 (TomoroAI) uses 320-dimensional embeddings but model config could default to incorrect dimensions, causing shape mismatches.

**Resolution:**
- Explicit `projection_dim=320` override in model config (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\main.py:236)
- Dynamic `custom_text_proj` layer rebuild if `model.dim` doesn't match config
- Diagnostic scripts to inspect shard keys and validate config overrides
- Health endpoint now exposes `flash_attn_version` for runtime validation

**Files Modified:**
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\main.py:236-237
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\scripts\test_config_override.py (new)
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\scripts\inspect_shard_keys.py (new)

### 4. Build Context Safety

**Problem:** Incorrect `requirements.txt` could be used if build context wasn't properly scoped to the sidecar directory.

**Resolution:**
- Explicit COPY from `paperless-ai/services/visual-rag-sidecar/requirements.txt` with full path (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\Dockerfile:56)
- Documentation emphasizes building from parent docker-compose directory
- Line ending normalization and syntax validation at build time (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\Dockerfile:95)

**Files Modified:**
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\Dockerfile:56, 92-95
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\README.md:121-129

### 5. Integration Testing Coverage

**Problem:** No automated tests for sidecar health checks or element detection endpoints.

**Resolution:**
- Health check integration test with 90s timeout for first-run downloads (C:\Users\pwalc\MyApps\paperless-ai\test\integration\visual-rag\health.test.js)
- Element detection payload validation test (C:\Users\pwalc\MyApps\paperless-ai\test\integration\visual-rag\detect_elements.test.js)
- CI workflow for visual-rag E2E tests (C:\Users\pwalc\MyApps\paperless-ai\.github\workflows\visual-rag-e2e.yml)

**Files Added:**
- C:\Users\pwalc\MyApps\paperless-ai\test\integration\visual-rag\health.test.js
- C:\Users\pwalc\MyApps\paperless-ai\test\integration\visual-rag\detect_elements.test.js
- C:\Users\pwalc\MyApps\paperless-ai\.github\workflows\visual-rag-e2e.yml

### 6. Client-Side Resilience

**Problem:** Visual search client lacked concurrency limiting and query-specific timeouts.

**Resolution:**
- In-process semaphore limiting concurrent queries to 5 (configurable via `maxConcurrent`) (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag\VisualSearchClient.js:174-191)
- Separate query timeout (500ms default) vs health check timeout (3000ms+)
- Circuit breaker integration with query-level timeout override support
- Localhost fallback for DNS/container networking issues (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag\VisualSearchClient.js:99-128)

**Files Modified:**
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag\VisualSearchClient.js:30-56, 174-257, 269-332

### 7. Health Endpoint Enhancements

**Problem:** Health checks lacked visibility into flash attention status and model loading state.

**Resolution:**
- Added `flash_attn_available` and `flash_attn_version` fields to health response (C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\main.py:141-142, 368-371)
- Health endpoint returns service state even during model loading
- Version detection at startup stored in environment variable

**Files Modified:**
- C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\main.py:135-143, 360-372

---

## Vector Dimension Migration Checklist

When migrating vector embeddings (e.g., from 768-d ColQwen2 to 320-d ColQwen3), follow this checklist to ensure safe migration:

### Pre-Migration

- [ ] **Backup database** - Full PostgreSQL backup before any schema changes
- [ ] **Document current state** - Record current vector dimensions, index configurations, and document counts
- [ ] **Verify migration files** - Ensure `migrations/04_change_embeddings_to_320.js` exists and is tested
- [ ] **Check disk space** - Ensure sufficient space for re-indexing (estimate: ~2x current index size)
- [ ] **Review dependencies** - Identify all services that read/write visual embeddings
- [ ] **Plan downtime window** - Schedule maintenance window for schema migration
- [ ] **Prepare rollback plan** - Document rollback procedure and test on staging

### Migration Execution

- [ ] **Stop write traffic** - Stop Visual RAG sidecar and any indexing processes
- [ ] **Run schema migration** - Execute `node migrations/run-migration.js 04`
- [ ] **Verify schema change** - Confirm `embedding` column is now `vector(320)`
- [ ] **Check index creation** - Verify HNSW and IVFFLAT indexes exist
- [ ] **Update environment variables** - Set `VISUAL_RAG_MODEL=TomoroAI/tomoro-colqwen3-embed-8b`
- [ ] **Restart Visual RAG sidecar** - Verify clean startup with new model
- [ ] **Test health endpoint** - Confirm `/health` returns `embedding_dim: 320`

### Post-Migration

- [ ] **Re-index documents** - Run `node scripts/reingest_visual_overlays.js --all` (or batched)
- [ ] **Monitor re-indexing progress** - Track completion percentage and error rate
- [ ] **Verify embedding dimensions** - Run SQL query to confirm all embeddings are 320-d
- [ ] **Check search quality** - Test visual search on sample documents
- [ ] **Monitor metrics** - Ensure `embedding_dimension_adapted` metric is 0
- [ ] **Resume write traffic** - Re-enable document processing and indexing
- [ ] **Performance validation** - Verify search latency meets SLO (p95 < 500ms)
- [ ] **Clean up legacy data** - (Optional) Drop legacy `embedding_vector` column if unused

### Verification Commands

```sql
-- Verify vector column dimension
SELECT column_name, udt_name
FROM information_schema.columns
WHERE table_name = 'visual_overlays' AND column_name = 'embedding';

-- Check stored embedding dimensions
SELECT
  id,
  array_length(embedding::real[], 1) as dimension,
  document_id
FROM visual_overlays
WHERE embedding IS NOT NULL
LIMIT 10;

-- Verify index status
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'visual_overlays' AND indexname LIKE '%embedding%';

-- Count indexed documents
SELECT COUNT(DISTINCT document_id) as indexed_docs
FROM visual_overlays
WHERE embedding IS NOT NULL;
```

```bash
# Check pgvector setup
node scripts/check_pgvector.js

# Test visual search
curl -X POST http://localhost:8001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "invoice", "k": 5}'

# Monitor sidecar health
curl http://localhost:8001/health
```

### Rollback Procedure

If migration fails or data integrity issues are discovered:

1. **Stop all services** immediately
2. **Restore database from backup** (preferred) OR run migration rollback
3. **Revert environment variables** to previous model configuration
4. **Restart services** with original configuration
5. **Verify rollback success** - Test search and indexing
6. **Document rollback reason** for post-mortem analysis

**Critical:** Vector dimension changes are **destructive**. Always maintain backups before migration.

---

## Troubleshooting

**Model & Index Notes:** When migrating from older embeddings (ColQwen2), the new ColQwen3 vectors are 320 dimensions and are not byte-compatible with previous indexes — plan a re-ingest and re-index. After applying the migration in `migrations/04_change_embeddings_to_320.js`, re-run `node scripts/check_pgvector.js` to validate the vector column and indexes.

**Offline-first model policy:** The Visual RAG sidecar is designed to run fully offline in production. To support this, the sidecar will:

- **Allow a one-time initial download** from the Hugging Face Hub if the required model artifacts are **not present** in the supplied Hugging Face cache volume (e.g., `visual_model_cache` mapped to `/root/.cache/huggingface`).
- **Create a marker file** after the first successful model load at: `\<INDEX_DIR\>/.hf_hub_download_complete` (default index dir: `/data/indices`). Once this marker exists, the sidecar enforces `HF_HUB_OFFLINE=1` and **will not attempt further downloads**.
- **Pre-seed for offline deployments:** If you must be fully offline from first start, pre-populate the Hugging Face cache and create the marker on the host before starting the container:

```bash
# Pre-populate model cache and mark as complete
# (assumes ./data/indices is the host mount for INDEX_DIR)
touch ./data/indices/.hf_hub_download_complete
# ensure visual model cache has model files under the cache volume
```

**Index loading fallback:** If an index path exists but is missing Byaldi metadata (e.g., `.byaldi/index_config.json.gz`), the sidecar will now log a warning and **fall back** to loading the model-only (enabling you to re-index documents with the new model using the `/index` endpoints). This prevents a hard crash on startup due to incomplete indices.

**Flash-attn / CUDA issues:** See `services/visual-rag-sidecar/README.md` for common flash-attn and CUDA build troubleshooting steps.


### Visual Sidecar Unavailable

**Symptoms:**
- Circuit breaker state = OPEN
- Logs show "Visual sidecar circuit breaker OPEN"
- No visual overlays in extraction results

**Resolution:**
1. Check Visual RAG sidecar health: `curl http://visual-rag:8001/health`
2. Verify circuit breaker state in Prometheus: `circuit_breaker_state{service="visual_sidecar"}`
3. Wait 30 seconds for automatic recovery attempt (HALF_OPEN state)
4. If persistent, restart Visual RAG sidecar: `docker restart visual_rag`

**Expected Behavior:**
- Pipeline continues without visual enhancements
- No pipeline failures
- Extraction-only results returned
- If document images are unavailable, visual queries are skipped by design

### High OCR Conflict Rate

**Symptoms:**
- `ocr_reconciliation_conflict_rate` > 20%
- Frequent mismatches between Visual OCR and Tesseract

**Resolution:**
1. Check document quality (scanned vs digital)
2. For scanned docs: Verify Visual OCR bias is applied
3. Review OCR selection logic in `mergeOcrResults()`
4. Consider adjusting conflict threshold in reconciliation

### Low Field Detection F1 Score

**Symptoms:**
- `field_detection_f1` < 0.85
- Missing fields not detected by visual queries

**Resolution:**
1. Review query generation template quality
2. Check if custom field taxonomy is up-to-date
3. Verify K values are appropriate for document type
4. Inspect visual query logs for query quality issues
5. Consider domain-specific template tuning

### Visual Query Timeout

**Symptoms:**
- Frequent timeouts in visual query execution
- High `visual_query_execution_time_ms` p95

**Resolution:**
1. Reduce concurrent query limit (default: 5)
2. Increase timeout budget (current: 500ms soft, 1000ms hard)
3. Check Visual RAG sidecar resource usage
4. Consider reducing K for faster queries
5. Verify network latency between services

### Circuit Breaker Flapping

**Symptoms:**
- Frequent transitions between OPEN and HALF_OPEN
- `circuit_breaker_transitions_total` increasing rapidly

**Resolution:**
1. Increase cooldown period (default: 30s)
2. Adjust failure threshold (default: 3)
3. Investigate root cause of sidecar instability
4. Check resource limits on Visual RAG container
5. Review sidecar logs for errors

---

## See Also

- [EXPERT_PIPELINE_DECISION_TABLE.md](./EXPERT_PIPELINE_DECISION_TABLE.md) - Pipeline execution rules
- [PIPELINE_STAGE_CONTRACTS.md](./PIPELINE_STAGE_CONTRACTS.md) - Stage responsibilities
- [VALIDATION_AND_RETRY_POLICY.md](./VALIDATION_AND_RETRY_POLICY.md) - Retry and validation rules
- [SCHEMA_EVOLUTION_GUIDE.md](./SCHEMA_EVOLUTION_GUIDE.md) - Schema change procedures
