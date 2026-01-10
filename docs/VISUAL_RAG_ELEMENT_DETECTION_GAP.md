# Visual RAG Element Detection Gap - Quick Reference

## TL;DR

**Problem**: The pipeline calls `POST /detect_elements` on the visual-rag-sidecar, but this endpoint is **NOT implemented**.

**Root Cause**: ColQwen3 is a **visual retrieval model**, not a layout analysis model. It cannot detect tables/figures with bounding boxes.

**Impact**: Track 3 (Visual Element Detection) fails gracefully. Pipeline continues with OCR-only results. No pipeline failures.

**Solution Options**:
1. **Add LayoutLMv3** to sidecar for proper layout analysis (recommended)
2. **Use visual queries** instead of dedicated element detection (pragmatic)
3. **Disable Track 3** formally and document current state (interim)

---

## What's Missing

### Endpoint Documentation vs Reality

| Aspect | Documentation Says | Actual Implementation |
|--------|-------------------|----------------------|
| **Endpoint** | `POST /detect_elements` | ❌ Does not exist |
| **Service** | Visual RAG Sidecar (main.py) | ✅ Exists but no endpoint |
| **Model** | ColQwen3 for element detection | ❌ Wrong model type |
| **Caller** | ParallelOcrExecutor.js:467-548 | ✅ Calls non-existent endpoint |
| **Circuit Breaker** | Opens after 3 failures | ✅ Works as designed |
| **Pipeline Impact** | Graceful degradation | ✅ Pipeline continues |

### Expected Request/Response

**Request**:
```json
{
  "image": "base64_encoded_image_string...",
  "detect_types": ["tables", "images", "figures", "text_blocks", "zones"]
}
```

**Expected Response** (NOT implemented):
```json
{
  "elements": [
    {
      "type": "table",
      "bbox": {"x": 100, "y": 200, "width": 400, "height": 300},
      "confidence": 0.92,
      "content_preview": "Invoice Line Items..."
    }
  ],
  "layout": {
    "columns": 2,
    "reading_order": [0, 1, 2],
    "zones": ["header", "body", "footer"]
  },
  "confidence": 0.85
}
```

**Actual Response**:
```
HTTP 404 Not Found
```

---

## Why ColQwen3 Can't Do This

### Model Capabilities Comparison

| Capability | ColQwen3 | LayoutLMv3 | qwen3-vl (OCR) |
|------------|----------|------------|----------------|
| **Visual Retrieval** | ✅ Excellent | ❌ No | ❌ No |
| **Layout Analysis** | ❌ No | ✅ Excellent | ❌ No |
| **Element Detection** | ❌ No | ✅ Yes | ❌ No |
| **Text Extraction (OCR)** | ❌ No | ❌ No | ✅ Excellent |
| **Bounding Boxes** | ❌ No | ✅ Yes | ❌ No |
| **Visual Similarity** | ✅ Yes | ❌ No | ❌ No |

### What Each Model Does

**ColQwen3** (TomoroAI/tomoro-colqwen3-embed-8b):
- Input: Document page image
- Output: 320-d embedding per visual patch
- Use case: "Find pages that visually look like this"
- Architecture: Late Interaction retrieval (MaxSim scoring)

**LayoutLMv3** (microsoft/layoutlmv3-base):
- Input: Document page image
- Output: Element bounding boxes + labels
- Use case: "Find all tables and figures on this page"
- Architecture: Object detection (Faster R-CNN style)

**qwen3-vl:8b** (Ollama):
- Input: Document page image
- Output: Extracted text
- Use case: "Read the text from this image"
- Architecture: Vision-language model with text generation

---

## Current Pipeline Behavior

### Stage 4: Parallel OCR Execution

```
┌─────────────────────────────────────────────┐
│  Stage 4: Parallel OCR + Element Detection  │
├─────────────────────────────────────────────┤
│                                             │
│  Track 1: Visual OCR (qwen3-vl:8b)          │
│  └─> ✅ SUCCESS                             │
│      Output: "Invoice text extracted..."    │
│                                             │
│  Track 2: Tesseract OCR (Paperless API)     │
│  └─> ✅ SUCCESS                             │
│      Output: "Tesseract OCR text..."        │
│                                             │
│  Track 3: Visual Elements (detect_elements) │
│  └─> ❌ HTTP 404                            │
│      Circuit Breaker: CLOSED → OPEN         │
│      visual_elements: null                  │
│                                             │
│  OCR Reconciliation                         │
│  └─> ✅ SUCCESS                             │
│      Merges Track 1 + Track 2               │
│      Continues without layout data          │
│                                             │
└─────────────────────────────────────────────┘
         │
         ▼
    Stage 5: Extraction
    (Proceeds with OCR-only context)
```

### Graceful Degradation

1. **First Request**: Track 3 fails with HTTP 404
2. **Second Request**: Track 3 fails again
3. **Third Request**: Track 3 fails, circuit breaker opens
4. **Subsequent Requests**: Circuit breaker is OPEN, track skipped entirely
5. **After 30s**: Circuit breaker enters HALF_OPEN, tests recovery
6. **Still Failing**: Circuit breaker returns to OPEN

**Result**: Pipeline succeeds with OCR-only results. No layout analysis data available.

---

## Implementation Options

### Option 1: Add LayoutLMv3 (Recommended for Production)

**Pros**:
- ⭐⭐⭐⭐⭐ Best accuracy for layout analysis
- Dedicated model designed for document understanding
- Proper bounding boxes and element classification
- Industry-standard approach

**Cons**:
- Requires 2-3GB additional VRAM
- New model to maintain
- 2-3 day implementation timeline

**VRAM Budget**:
- ColQwen3: 8-10GB (retrieval)
- LayoutLMv3: 2-3GB (layout)
- Total: 10-13GB (fits RTX 3090 Ti 24GB)

**Files to Create**:
- `services/visual-rag-sidecar/layout_detector.py` (NEW)
- Add endpoint to `services/visual-rag-sidecar/main.py`
- Update `services/visual-rag-sidecar/requirements.txt`

**Code Snippet**:
```python
# services/visual-rag-sidecar/main.py

@app.post("/detect_elements", response_model=DetectElementsResponse)
async def detect_elements(request: DetectElementsRequest):
    """
    Detect document layout elements using LayoutLMv3.

    NOTE: This uses LayoutLMv3, NOT ColQwen3.
    ColQwen3 is used only for /search (visual retrieval).
    """
    try:
        result = layout_detector.detect_elements(
            request.image,
            request.detect_types
        )
        return DetectElementsResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
```

---

### Option 2: Use Visual Queries (Pragmatic Alternative)

**Pros**:
- Leverages existing ColQwen3 infrastructure
- No additional model needed
- Works with current pipeline
- Faster implementation (1 day)

**Cons**:
- ⭐⭐⭐ Lower accuracy than dedicated layout model
- No structured layout analysis
- Requires query tuning per document type
- Higher latency (multiple visual searches)

**Approach**:
1. Generate targeted queries in Stage 5.5 for layout elements
2. Use `/search` endpoint (existing ColQwen3) to find regions
3. Aggregate results as "pseudo-elements" with bounding boxes
4. Convert visual hits to element format

**Example Queries**:
```javascript
const elementQueries = [
  {
    question: "Locate the invoice line items table",
    field_target: "line_items_table",
    expected_element_type: "table"
  },
  {
    question: "Find the company logo in the header",
    field_target: "company_logo",
    expected_element_type: "image"
  }
];
```

---

### Option 3: Disable Track 3 Formally (Interim Solution)

**Pros**:
- Minimal code changes (1 hour)
- Documents current reality
- No performance impact
- Allows time for proper implementation decision

**Cons**:
- No layout understanding
- Missing structural metadata
- Limits downstream processing

**Changes Required**:
```javascript
// services/experts/ParallelOcrExecutor.js

const DEFAULT_CONFIG = {
    visualElements: {
        enabled: false,  // Changed from dynamic check
        // ... rest of config ...
    }
};
```

---

## Decision Matrix

| Criteria | Option 1: LayoutLMv3 | Option 2: Visual Queries | Option 3: Disable |
|----------|---------------------|-------------------------|------------------|
| **Accuracy** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Implementation Time** | 2-3 days | 1 day | 1 hour |
| **VRAM Cost** | +2-3GB | 0GB | 0GB |
| **Maintenance** | New model | Existing | None |
| **Production Ready** | ✅ Yes | ⚠️ Needs tuning | ❌ Gap remains |
| **Layout Quality** | Excellent | Good | None |
| **Element Bounding Boxes** | Precise | Approximate | N/A |

**Recommendation**:
- **Short-term**: Option 3 (disable and document)
- **Long-term**: Option 1 (LayoutLMv3 for production quality)

---

## Files Affected

### Documentation Updates (Already Done)

- ✅ `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` - Comprehensive analysis (NEW)
- ✅ `docs/EXPERT_PIPELINE_DECISION_TABLE.md` - Updated Track 3 status
- ✅ `docs/VISUAL_RAG_INTEGRATION.md` - Added implementation gap notice
- ✅ `docs/model/tomoro-colqwen3.md` - Clarified capabilities/limitations
- ✅ `docs/VISUAL_RAG_ELEMENT_DETECTION_GAP.md` - This quick reference (NEW)

### Code Files (Implementation Required)

- ⚠️ `services/visual-rag-sidecar/main.py` - Missing `/detect_elements` endpoint
- ⚠️ `services/visual-rag-sidecar/layout_detector.py` - Needs creation (if Option 1)
- ⚠️ `services/visual-rag-sidecar/requirements.txt` - Add LayoutLMv3 deps (if Option 1)
- ⚠️ `services/experts/ParallelOcrExecutor.js` - Currently calls non-existent endpoint

### Test Files

- ✅ `test/integration/visual-rag/detect_elements.test.js` - Test exists but endpoint missing
- ⚠️ Test will fail until endpoint is implemented

---

## Next Steps

### Immediate (1 hour)

1. **Disable Track 3 formally** to stop unnecessary HTTP calls
   ```javascript
   // services/experts/ParallelOcrExecutor.js
   visualElements: { enabled: false }
   ```

2. **Update test expectations** to reflect missing endpoint
   ```javascript
   // test/integration/visual-rag/detect_elements.test.js
   it.skip('should detect elements', async () => {
       // Skipped: endpoint not implemented
   });
   ```

### Short-term (1 week)

3. **Decision**: Choose implementation path (Option 1, 2, or 3)

4. **Stakeholder alignment**: Discuss VRAM budget and accuracy requirements

5. **Timeline planning**: Resource allocation for implementation

### Long-term (2-4 weeks)

6. **Implement chosen solution** (likely Option 1 with LayoutLMv3)

7. **Integration testing** with real document corpus

8. **Metrics collection**: Layout detection F1, precision, recall

9. **Documentation updates** with actual implementation

---

## References

### Internal Documentation
- `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` - Comprehensive analysis
- `docs/EXPERT_PIPELINE_DECISION_TABLE.md` - Authoritative pipeline contract
- `docs/VISUAL_RAG_INTEGRATION.md` - Visual RAG integration architecture
- `docs/model/tomoro-colqwen3.md` - ColQwen3 model profile

### Code Locations
- `services/visual-rag-sidecar/main.py` - Visual RAG sidecar (missing endpoint)
- `services/experts/ParallelOcrExecutor.js:467-548` - Track 3 implementation
- `test/integration/visual-rag/detect_elements.test.js` - Integration test

### External Resources
- [ColPali Paper](https://arxiv.org/abs/2407.01449) - Late interaction retrieval
- [LayoutLMv3 Paper](https://arxiv.org/abs/2204.08387) - Document layout analysis
- [Detectron2](https://github.com/facebookresearch/detectron2) - Object detection framework

---

**Status**: ✅ Gap documented, awaiting implementation decision

**Last Updated**: 2026-01-09

**Owner**: paperless-ai core team
