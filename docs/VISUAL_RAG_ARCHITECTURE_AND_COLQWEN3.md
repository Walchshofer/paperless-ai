# Visual RAG Architecture and ColQwen3 Model Capabilities

## Executive Summary

This document clarifies the **architectural intent** behind the Visual RAG system in paperless-ai, the **actual capabilities** of the Tomoro ColQwen3 model, and the **implementation gap** discovered in Track 3 (Visual Element Detection).

**Key Finding**: The `/detect_elements` endpoint is documented and called by the pipeline but **NOT implemented** in the visual-rag-sidecar. This is by design - ColQwen3 is a **visual retrieval model**, not a layout analysis model. It excels at finding documents containing specific content but does not output structured bounding boxes or extracted text.

---

## Table of Contents

1. [Visual RAG System Overview](#visual-rag-system-overview)
2. [Tomoro ColQwen3 Model Profile](#tomoro-colqwen3-model-profile)
3. [Pipeline Integration Architecture](#pipeline-integration-architecture)
4. [The Element Detection Gap](#the-element-detection-gap)
5. [Recommended Implementation Paths](#recommended-implementation-paths)
6. [Service Separation Principles](#service-separation-principles)
7. [ColQwen3 Integration Strategy](#colqwen3-integration-strategy)

---

## Visual RAG System Overview

### System Purpose

The Visual RAG system serves **two distinct functions** in the expert pipeline:

1. **Visual Retrieval** (Implemented)
   - Find document pages/regions using visual similarity
   - Enable queries like "invoice total at the bottom" without OCR
   - Provide evidence overlays for extracted fields
   - Search by visual layout patterns (forms, tables, signatures)

2. **Layout Analysis** (Not Implemented - Gap)
   - Detect tables, images, figures, text blocks
   - Provide bounding boxes for structural elements
   - Enable document structure understanding

### Service Components

| Component | Purpose | Status | Implementation |
|-----------|---------|--------|----------------|
| **Visual RAG Sidecar** | Visual embedding & retrieval | ✅ Implemented | `services/visual-rag-sidecar/main.py` |
| **VisualSearchClient** | Circuit-breaker wrapper | ✅ Implemented | `services/visual-rag-client/VisualSearchClient.js` |
| **ParallelOcrExecutor** | Orchestrates 3 tracks | ⚠️ Partial | `services/experts/ParallelOcrExecutor.js` |
| **Element Detection** | Layout analysis | ❌ Not Implemented | `/detect_elements` endpoint missing |

---

## Tomoro ColQwen3 Model Profile

### Model Identity

```
Full Name:    TomoroAI/tomoro-colqwen3-embed-4b (base)
              TomoroAI/tomoro-ai-colqwen3-embed-4b-awq (quantized)
Architecture: ColPali-style Vision-Language Retriever
Methodology:  Late Interaction (MaxSim)
Parameters:   4B (AWQ W4A16 quantized variant available)
Embedding:    320-dim multi-vector per patch
Base Models:  Merged from Qwen3-VL-4B-Instruct + Qwen3-Embedding-4B
```

### Technical Specifications

| Specification | Value | Notes |
|--------------|-------|-------|
| **Embedding Type** | Multi-vector | seq_len × 320 dimensions |
| **Embedding Size** | 320-d | Patch-level vectors; multi-vector per page |
| **Max Visual Tokens** | 1,280 per page | Configurable via `max_num_visual_tokens` |
| **Context Window** | 32k tokens | Includes text + visual tokens |
| **Precision** | bfloat16 | FlashAttention 2 optimized |
| **Storage Efficiency** | 13× vs ColQwen2 | ~0.82 TB for 1M images (vs ~10.3 TB baseline) |
| **AWQ VRAM** | ~3.5 GB | W4A16 quantized, vision encoder remains FP16/BF16 |
| **Full BF16 VRAM** | ~8.4 GB | Non-quantized 4B model |

**Note:** When computing visual patches for ColQwen3, we use a **32×32 pixel patch size** and enforce a maximum of **1,280 patches per page**, which corresponds to a maximum effective image area of ~1.31M pixels. These constants are captured in code in `src/ui/contracts/AspectRatio.contract.ts` as `COLQWEN3_PATCH_SIZE = 32` and `COLQWEN3_MAX_PATCHES = 1280`.

### Understanding ColQwen3: Retrieval vs Extraction

ColQwen3 is a **retrieval model**, not an extraction model. This distinction is critical:

| Capability | Retrieval (ColQwen3) | Extraction (OCR/VLM) |
|------------|---------------------|----------------------|
| **Input** | Query text + document images | Document images |
| **Output** | Ranked document pages/regions | Structured text/data |
| **Use Case** | "Find documents about X" | "What does this document say?" |
| **Text Handling** | Matches text visually without extracting it | Outputs text as strings |

#### ✅ What ColQwen3 CAN Do

- **Retrieve documents by text content** - Find pages containing "invoice total" without OCR
- **Match visual patterns** - Locate forms, tables, charts by appearance
- **Understand spatial relationships** - "Total at the bottom right"
- **Search by visual similarity** - Find documents that look like a reference document
- **Handle handwriting, stamps, logos** - Visual features OCR often misses
- **Retrieve video frames** - Generalize to short video clip retrieval

**Key insight**: ColQwen3 can find documents containing specific text by matching query embeddings to visual patch embeddings - the text is "understood" visually without being extracted as characters.

#### ❌ What ColQwen3 CANNOT Do

- **Output extracted text** - Does not produce text strings from images
- **Generate bounding boxes** - No element-level coordinate detection
- **Perform structured layout analysis** - No reading order, column detection
- **Classify document regions** - No semantic labels (header, footer, etc.)
- **Replace OCR in extraction pipelines** - Different purpose entirely

#### The Two-Phase RAG Pattern

For a complete document AI system, ColQwen3 handles **Phase 1** (retrieval), while a separate model handles **Phase 2** (extraction):

```
User Query: "What was the Q3 revenue?"
    │
    ▼
Phase 1: RETRIEVAL (ColQwen3)
    │
    ├─ Embed query → 320-d vectors
    ├─ MaxSim search against indexed pages
    └─ Return: Top-K relevant page images
    │
    ▼
Phase 2: EXTRACTION (Qwen3-VL / GPT-4o / OCR)
    │
    ├─ Input: Retrieved page images + query
    ├─ VLM reasons over visual content
    └─ Return: "Q3 revenue was $4.2M"
```

### Model Architecture: Late Interaction Retrieval

```
Document Page (Image)
    │
    ▼
ColQwen3 Vision Encoder (Qwen3-VL backbone)
    │
    ├─ Patch Embeddings (320-d each)
    │  [patch_1, patch_2, ..., patch_n] (up to 1,280 patches)
    │
    ▼
Multi-Vector Index (Qdrant / pgvector)
    │
Query (Text)
    │
    ▼
ColQwen3 Text Encoder (Qwen3-Embedding backbone)
    │
    ├─ Query Token Embeddings (320-d each)
    │
    ▼
MaxSim Scoring (Late Interaction)
    │
    ├─ For each document:
    │    score = Σ max(sim(q_token, p_patch) for p_patch in doc_patches)
    │           for q_token in query_tokens
    │
    ▼
Ranked Results (page images + scores)
```

### Native MaxSim Scoring — Why in PyTorch (not raw SQL)

Late-interaction MaxSim requires computing patch-wise cross-similarities and taking per-patch maxima across a document's patch set. Emulating this behavior with a single-vector approximation or SQL-based similarity loses the late-interaction fidelity and often reduces recall for fine-grained visual matches. The sidecar therefore uses `processor.score_multi_vector` in PyTorch to:

- Compute accurate patch-wise MaxSim scores on GPU (fast, exact)
- Retain patch-level information for fine-grained ranking
- Avoid expensive and lossy transformations into single-vector proxies

```mermaid
flowchart LR
  Sidecar[Visual RAG Sidecar (ColQwen3)] -->|upsert/echo| Qdrant[Qdrant (SOT for vectors)]
  Sidecar -->|native MaxSim (processor.score_multi_vector)| Guidance[Guidance Service]
  Postgres[PostgreSQL (metadata & feedback)] <-->|mirrors minimal payload| Qdrant
  Guidance --> Postgres
```

---

## Pipeline Integration Architecture

### Stage 4: Parallel OCR + Element Detection

The expert pipeline defines 3 parallel tracks in Stage 4:

#### Track 1: Visual OCR (qwen3-vl:8b via Ollama) ✅ IMPLEMENTED

**Purpose**: Extract text from document images using vision-language model

**Implementation**:
- Service: `services/ollama/vision.js`
- Executor: `ParallelOcrExecutor._executeVisualOcrTrack()`
- Model: `qwen3-vl:8b` (Ollama local)
- Timeout: 500ms soft, 1000ms hard
- Circuit Breaker: `visual-ocr`

**Output**:
```javascript
{
  text: "Extracted OCR text...",
  model: "qwen3-vl:8b",
  confidence: 0.85
}
```

#### Track 2: Tesseract OCR (Paperless API) ✅ IMPLEMENTED

**Purpose**: Fetch pre-computed Tesseract OCR from Paperless-ngx

**Implementation**:
- Service: `services/paperlessService.js`
- Executor: `ParallelOcrExecutor._executeTesseractOcrTrack()`
- Endpoint: `GET /api/documents/{id}/`
- Timeout: 300ms
- Circuit Breaker: `tesseract-ocr`

**Output**:
```javascript
{
  text: "Tesseract OCR content...",
  source: "paperless-tesseract",
  documentType: "financial"
}
```

#### Track 3: Visual Element Detection ❌ NOT IMPLEMENTED (GAP)

**Purpose**: Detect tables, images, figures, layout zones with bounding boxes

**Documentation Says**:
- Endpoint: `POST /detect_elements` on Visual RAG sidecar
- Request: `{ image: <base64>, detect_types: [...] }`
- Response: `{ elements: [], layout: {}, confidence: <0..1> }`
- Timeout: 500ms
- Circuit Breaker: `visual-elements`

**Actual Implementation**:
- ❌ `/detect_elements` endpoint does NOT exist in `services/visual-rag-sidecar/main.py`
- ❌ ColQwen3 is architecturally incapable of layout analysis (it's a retriever)
- ✅ Circuit breaker gracefully degrades when endpoint fails
- ✅ Pipeline continues without element detection

**Why This Gap Exists**:

ColQwen3's architecture produces **patch embeddings for retrieval**, not **bounding boxes for detection**. These are fundamentally different outputs:

| ColQwen3 Output | Layout Model Output |
|-----------------|---------------------|
| 1,280 × 320-d vectors | N × {class, bbox, confidence} |
| Used for similarity search | Used for element localization |
| No spatial coordinates | Explicit (x, y, width, height) |

**Code Location**:
```javascript
// File: services/experts/ParallelOcrExecutor.js:467-548
async _executeVisualElementsTrack(document, metadata) {
    // THIS CALL WILL FAIL - endpoint doesn't exist
    const response = await axios.post(
        `${this.config.visualElements.url}/detect_elements`,
        {
            image: imageBase64,
            detect_types: ['tables', 'images', 'figures', 'text_blocks', 'zones']
        },
        { timeout: this.config.visualElements.timeout }
    );
    // ...
}
```

### Stage 8: Visual Query Execution ✅ IMPLEMENTED

**Purpose**: Execute targeted visual queries for field validation

**Implementation**:
- Uses ColQwen3 for visual similarity search
- Dynamic K selection based on confidence/rarity
- IoU deduplication for overlapping results
- Circuit breaker protected

**This is the CORRECT use case for ColQwen3** - visual retrieval, not element detection.

---

## The Element Detection Gap

### What Was Intended

The original architecture envisioned Track 3 providing **structured layout analysis**:

```javascript
// Intended output from /detect_elements
{
  elements: [
    {
      type: "table",
      bbox: { x: 100, y: 200, width: 400, height: 300 },
      confidence: 0.92,
      content_preview: "Invoice Line Items..."
    },
    {
      type: "image",
      bbox: { x: 50, y: 50, width: 200, height: 150 },
      confidence: 0.88,
      content_preview: "Company Logo"
    }
  ],
  layout: {
    columns: 2,
    reading_order: [0, 1, 2],
    zones: ["header", "body", "footer"]
  },
  confidence: 0.85
}
```

### Why It's Missing

1. **Model Mismatch**: ColQwen3 is a retrieval model, not a layout analysis model
2. **Architectural Confusion**: Visual RAG sidecar was designed for retrieval, not detection
3. **Graceful Degradation**: Circuit breaker masks the missing endpoint
4. **No Error Visibility**: Pipeline logs show track failure but continues execution

### Current Pipeline Behavior

```
Stage 4: Parallel OCR Execution
│
├─ Track 1: Visual OCR (qwen3-vl) ────────> ✅ SUCCESS
│   └─ Output: Extracted text
│
├─ Track 2: Tesseract OCR ───────────────> ✅ SUCCESS
│   └─ Output: Tesseract text
│
├─ Track 3: Visual Elements ─────────────> ❌ HTTP 404/503
│   └─ Circuit Breaker: OPEN after 3 failures
│   └─ Pipeline continues without elements
│
└─ OCR Reconciliation ──────────────────> ✅ SUCCESS
    └─ Merges Track 1 + Track 2 results
```

**Result**: Pipeline succeeds but lacks structural layout information.

---

## Recommended Implementation Paths

### Option 1: Implement Layout Analysis with Specialized Model (Recommended)

**Use a dedicated layout analysis model** instead of ColQwen3:

#### Model Options

| Model | Purpose | Capabilities | Integration |
|-------|---------|-------------|-------------|
| **LayoutLMv3** | Document layout analysis | Table detection, reading order, element classification | Hugging Face Transformers |
| **Detectron2 + PubLayNet** | Object detection for documents | Table, figure, text block detection with bounding boxes | Facebook AI |
| **Table Transformer** | Specialized table detection | Table structure recognition | Microsoft Research |
| **DocFormer** | End-to-end document understanding | Layout + content understanding | Hugging Face |

#### Implementation Plan

```python
# File: services/visual-rag-sidecar/layout_detector.py (NEW)

from transformers import AutoModelForObjectDetection, AutoImageProcessor
import torch
from PIL import Image
import base64
import io

class LayoutDetector:
    """
    Layout analysis using LayoutLMv3 or Detectron2.
    Separate from ColQwen3 visual retrieval model.
    """

    def __init__(self):
        # Use Microsoft's LayoutLMv3 for document layout
        self.processor = AutoImageProcessor.from_pretrained(
            "microsoft/layoutlmv3-base"
        )
        self.model = AutoModelForObjectDetection.from_pretrained(
            "microsoft/layoutlmv3-base"
        )
        self.model.eval()

    def detect_elements(self, image_base64: str, detect_types: list):
        """
        Detect document elements with bounding boxes.

        Args:
            image_base64: Base64-encoded image
            detect_types: List of element types to detect
                         ['tables', 'images', 'figures', 'text_blocks', 'zones']

        Returns:
            {
                elements: [
                    {type, bbox, confidence, content_preview}
                ],
                layout: {columns, reading_order, zones},
                confidence: float
            }
        """
        # Decode image
        image_bytes = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Run detection
        inputs = self.processor(images=image, return_tensors="pt")

        with torch.no_grad():
            outputs = self.model(**inputs)

        # Process outputs
        target_sizes = torch.tensor([image.size[::-1]])
        results = self.processor.post_process_object_detection(
            outputs,
            threshold=0.5,
            target_sizes=target_sizes
        )[0]

        # Format results
        elements = []
        for score, label, box in zip(
            results["scores"],
            results["labels"],
            results["boxes"]
        ):
            element_type = self._map_label_to_type(label.item())
            if element_type in detect_types:
                elements.append({
                    "type": element_type,
                    "bbox": {
                        "x": box[0].item(),
                        "y": box[1].item(),
                        "width": box[2].item() - box[0].item(),
                        "height": box[3].item() - box[1].item()
                    },
                    "confidence": score.item(),
                    "content_preview": ""
                })

        # Analyze layout
        layout = self._analyze_layout(elements, image.size)

        return {
            "elements": elements,
            "layout": layout,
            "confidence": sum(e["confidence"] for e in elements) / len(elements) if elements else 0.0
        }

    def _map_label_to_type(self, label: int) -> str:
        """Map model label to element type."""
        label_map = {
            0: "text_blocks",
            1: "tables",
            2: "figures",
            3: "images"
        }
        return label_map.get(label, "unknown")

    def _analyze_layout(self, elements: list, image_size: tuple) -> dict:
        """Analyze document layout from detected elements."""
        return {
            "columns": self._detect_columns(elements),
            "reading_order": list(range(len(elements))),
            "zones": self._detect_zones(elements, image_size)
        }
```

#### VRAM Considerations

- **ColQwen3 AWQ**: ~3.5GB VRAM for retrieval
- **LayoutLMv3**: ~2-3GB VRAM for layout detection
- **Total**: ~6-7GB VRAM (fits RTX 3090 Ti 24GB with headroom)

**Strategy**: Load layout model on-demand or use separate container to avoid memory contention.

---

### Option 2: Use Visual Queries Instead of Element Detection (Alternative)

**Skip dedicated element detection** and rely on visual queries:

#### Approach

1. **Use ColQwen3 visual search** to find document regions matching queries
2. **Generate targeted queries** in Stage 5.5 for layout elements
3. **Aggregate results** as "pseudo-elements" with approximate locations

#### Example Queries

```javascript
// Stage 5.5: Visual Query Generation
const elementQueries = [
  {
    question: "Locate the invoice line items table",
    field_target: "line_items",
    expected_element_type: "table",
    priority: 0.9
  },
  {
    question: "Find the company logo or header image",
    field_target: "company_logo",
    expected_element_type: "image",
    priority: 0.7
  }
];
```

#### Pros/Cons

✅ **Pros**:
- No additional model needed
- Leverages existing ColQwen3 infrastructure
- Works with current pipeline architecture

❌ **Cons**:
- Less precise than dedicated layout model
- No bounding boxes (only page-level results)
- Requires query tuning for each document type
- No structured layout analysis (columns, zones)

---

### Option 3: Disable Track 3 Entirely (Minimal Change)

**Accept the current state** and disable Track 3 formally:

#### Changes Required

```javascript
// File: services/experts/ParallelOcrExecutor.js

const DEFAULT_CONFIG = {
    // ... existing config ...

    visualElements: {
        enabled: false,  // Explicitly disabled - ColQwen3 cannot provide this
        timeout: 500,
        url: config.visualRagSidecar?.url || 'http://visual-rag:8001',
        failureThreshold: 3,
        cooldownPeriod: 30000
    }
};
```

#### Pros/Cons

✅ **Pros**:
- Minimal code changes
- Documents current state accurately
- No performance impact

❌ **Cons**:
- No layout understanding
- Missing structural metadata
- Limits downstream processing capabilities

---

## Service Separation Principles

### Clear Boundaries

| Service | Model | Purpose | Endpoints |
|---------|-------|---------|-----------|
| **Visual RAG Sidecar** | ColQwen3 | Visual retrieval | `/health`, `/search`, `/index/document` |
| **Layout Analysis Service** | LayoutLMv3 | Element detection | `/detect_elements` (NEW - separate service) |
| **Ollama Visual** | qwen3-vl:8b | Visual OCR / Extraction | Ollama API |
| **RAGZ** | nomic-embed-text | Text retrieval | `/search`, `/context` |

### Vector Storage Separation

| Service | Table | Column | Dimension | Index Type |
|---------|-------|--------|-----------|------------|
| Visual RAG | `visual_overlays` | `embedding` | 320 | HNSW + IVFFLAT |
| RAGZ | `document_embeddings` | `embedding` | 384 | IVFFLAT |
| Layout Analysis | N/A (JSON metadata only) | N/A | N/A | N/A |

**Rule**: Never share vector columns across services. Each service owns its schema.

---

## ColQwen3 Integration Strategy

### Overview

The Visual RAG sidecar integrates TomoroAI ColQwen3 using **direct transformers loading** rather than Byaldi's wrapper. This approach is required because:

1. **Byaldi v0.0.7 supports ColQwen2, not ColQwen3** - The Byaldi library explicitly documents support for `vidore/colqwen2-v1.0` but does not include TomoroAI's newer ColQwen3 models
2. **ColQwen3 requires `trust_remote_code=True`** - Custom model architecture from TomoroAI
3. **Direct loading provides full control** - Over quantization, attention implementation, and device mapping

### Architecture Decision

**Decision**: Use `transformers.AutoModel` directly instead of Byaldi wrapper.

**Rationale**:

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Byaldi Wrapper** | Simple API, familiar interface | No ColQwen3 support in v0.0.7 | ❌ Not available |
| **Direct Transformers** | Full control, official TomoroAI examples | More code, manual index management | ✅ **Required** |
| **Fork Byaldi** | Could add ColQwen3 support | Maintenance burden, upstream drift | ❌ Overkill |

### Production Implementation

**File**: `services/visual-rag-sidecar/main.py`

```python
import torch
from transformers import AutoModel, AutoProcessor
from PIL import Image

class ColQwen3Embedder:
    """
    ColQwen3 integration using direct transformers loading.
    
    Based on official TomoroAI examples:
    https://huggingface.co/TomoroAI/tomoro-colqwen3-embed-4b
    https://huggingface.co/TomoroAI/tomoro-ai-colqwen3-embed-4b-awq
    """
    
    def __init__(
        self,
        model_id: str = "TomoroAI/tomoro-ai-colqwen3-embed-4b-awq",
        device: str = "cuda",
        dtype: torch.dtype = torch.bfloat16,
        max_visual_tokens: int = 1280,
    ):
        self.device = device
        self.dtype = dtype
        
        # Load processor with visual token limit
        self.processor = AutoProcessor.from_pretrained(
            model_id,
            trust_remote_code=True,  # REQUIRED for TomoroAI models
            max_num_visual_tokens=max_visual_tokens,
        )
        
        # Load model with optimized settings
        self.model = AutoModel.from_pretrained(
            model_id,
            torch_dtype=dtype,
            trust_remote_code=True,  # REQUIRED for TomoroAI models
            device_map=device,
            attn_implementation="flash_attention_2",  # REQUIRED for performance
        ).eval()
    
    def encode_images(self, images: list[Image.Image]) -> torch.Tensor:
        """Encode document page images to multi-vector embeddings."""
        batch = self.processor.process_images(images=images)
        batch = {k: v.to(self.device) for k, v in batch.items()}
        
        with torch.inference_mode():
            outputs = self.model(**batch)
        
        return outputs.embeddings.to(self.dtype).cpu()
    
    def encode_queries(self, queries: list[str]) -> torch.Tensor:
        """Encode text queries to multi-vector embeddings."""
        batch = self.processor.process_texts(texts=queries)
        batch = {k: v.to(self.device) for k, v in batch.items()}
        
        with torch.inference_mode():
            outputs = self.model(**batch)
        
        return outputs.embeddings.to(self.dtype).cpu()
    
    def score(
        self,
        query_embeddings: torch.Tensor,
        image_embeddings: torch.Tensor,
    ) -> torch.Tensor:
        """
        Compute MaxSim scores between queries and documents.
        
        Returns tensor of shape (num_queries, num_documents).
        """
        # Move to device for scoring
        q_emb = query_embeddings.to(self.device)
        i_emb = image_embeddings.to(self.device)
        
        # MaxSim: for each query token, find max similarity to any image patch
        # Then sum across query tokens
        scores = self.processor.score_multi_vector(q_emb, i_emb)
        
        return scores.cpu()
```

### Critical Configuration Parameters

| Parameter | Value | Reason |
|-----------|-------|--------|
| `trust_remote_code=True` | **MANDATORY** | Loads custom ColQwen3 architecture from TomoroAI |
| `attn_implementation="flash_attention_2"` | **MANDATORY** | Prevents OOM, 3-5x speedup |
| `torch_dtype=torch.bfloat16` | Recommended | Matches training precision |
| `max_num_visual_tokens=1280` | Default | Up to 1,280 patches per page |

### Dependency Requirements

**File**: `services/visual-rag-sidecar/requirements.txt`

```txt
# Core Framework
fastapi==0.128.0
uvicorn[standard]==0.40.0
pydantic==2.12.5

# ML Stack - PINNED FOR FLASH ATTENTION 2 COMPATIBILITY
torch==2.6.0
transformers==4.57.3  # Pinned for flash-attn wheel compilation
numpy==1.26.4

# ColQwen3 Dependencies
autoawq  # For AWQ quantized model loading
flash-attn>=2.7.4  # Built for CUDA 12.4

# Image Processing
pdf2image==1.17.0
Pillow==11.0.0
```

**Why `transformers==4.57.3` is pinned**: FlashAttention 2 compiles CUDA kernels that hook into transformers' attention implementation internals. Pinning ensures the flash-attn wheel compiles against known-good attention module signatures and prevents runtime API drift errors.

### Dockerfile Build Order

**File**: `services/visual-rag-sidecar/Dockerfile`

```dockerfile
# Step 1: Install PyTorch FIRST (flash-attn build dependency)
RUN pip install --no-cache-dir \
    torch==2.6.0 \
    --index-url https://download.pytorch.org/whl/cu124

# Step 2: Install pinned transformers for flash-attn compatibility
RUN pip install --no-cache-dir \
    transformers==4.57.3

# Step 3: Install build tools for flash-attn compilation
RUN pip install --no-cache-dir ninja packaging setuptools wheel

# Step 4: Install flash-attn (compiles against torch + transformers)
RUN pip install --no-cache-dir flash-attn>=2.7.4

# Step 5: Install AWQ support for quantized model
RUN pip install --no-cache-dir autoawq

# Step 6: Install remaining dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```

**Critical Build Order**:
1. PyTorch MUST be installed before flash-attn (build dependency)
2. transformers MUST be pinned before flash-attn (API compatibility)
3. flash-attn version MUST match CUDA toolkit version (12.4)

### Model Variants

| Model ID | Parameters | VRAM | Use Case |
|----------|------------|------|----------|
| `TomoroAI/tomoro-colqwen3-embed-4b` | 4B (BF16) | ~8.4 GB | Maximum quality |
| `TomoroAI/tomoro-ai-colqwen3-embed-4b-awq` | 4B (W4A16) | ~3.5 GB | **Production default** |
| `TomoroAI/tomoro-colqwen3-embed-8b` | 8B (BF16) | ~17.6 GB | Research/high-end |

**Recommendation**: Use the AWQ 4B variant for production. The quantization (W4A16) applies only to the text tower; the vision encoder remains in FP16/BF16 to preserve visual feature quality.

### Video Retrieval Capability

ColQwen3 generalizes to short video retrieval without video-specific training:

```python
def encode_video(self, video_path: str, max_frames: int = 16) -> torch.Tensor:
    """
    Encode video frames for retrieval.
    
    Recommended: max_num_visual_tokens=5120 for video tasks.
    """
    import torchvision
    
    # Sample frames from video
    video, _, _ = torchvision.io.read_video(video_path)
    indices = torch.linspace(0, len(video) - 1, max_frames).long()
    frames = [Image.fromarray(video[i].numpy()) for i in indices]
    
    # Encode frames
    frame_embeddings = self.encode_images(frames)
    
    # Pool frame embeddings (per-dimension max)
    pooled = frame_embeddings.max(dim=0).values
    
    return pooled
```

This capability is valuable for DMS systems ingesting recorded meetings or video archives.

### Operational Validation

**File**: `services/visual-rag-sidecar/scripts/integration_test.py`

```python
import time
import torch
from PIL import Image

print('--- ColQwen3 Integration Test ---')

# Step 1: Load Model
from main import ColQwen3Embedder
embedder = ColQwen3Embedder()

# Step 2: Measure Static VRAM
torch.cuda.synchronize()
static_mem = torch.cuda.memory_allocated() / 1024**3
print(f'Static VRAM: {static_mem:.2f} GB')

# Step 3: Test Encoding
test_image = Image.new('RGB', (448, 448), color='white')
torch.cuda.reset_peak_memory_stats()
start = time.time()

image_emb = embedder.encode_images([test_image])
query_emb = embedder.encode_queries(["test query"])
scores = embedder.score(query_emb, image_emb)

torch.cuda.synchronize()
latency_ms = (time.time() - start) * 1000
peak_mem = torch.cuda.max_memory_allocated() / 1024**3

# Step 4: Report
print(f'Image embedding shape: {image_emb.shape}')
print(f'Query embedding shape: {query_emb.shape}')
print(f'Score: {scores[0, 0]:.4f}')
print(f'Latency: {latency_ms:.2f} ms')
print(f'Peak VRAM: {peak_mem:.2f} GB')
print('--- SUCCESS ---')
```

**Expected Output (RTX 3090 Ti with AWQ model)**:

```
--- ColQwen3 Integration Test ---
Static VRAM: 3.42 GB
Image embedding shape: torch.Size([1, 1280, 320])
Query embedding shape: torch.Size([1, 32, 320])
Score: 12.3456
Latency: 145.23 ms
Peak VRAM: 4.18 GB
--- SUCCESS ---
```

### Health Endpoint

**Endpoint**: `GET /health`

```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_id": "TomoroAI/tomoro-ai-colqwen3-embed-4b-awq",
  "embedding_dim": 320,
  "max_visual_tokens": 1280,
  "flash_attn_available": true,
  "flash_attn_version": "2.7.4",
  "vram_used_gb": 3.42,
  "indexed_docs_count": 42
}
```

### Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `ValueError: trust_remote_code` | Missing parameter | Add `trust_remote_code=True` to both model and processor |
| `CUDA OOM` | No flash attention | Verify flash-attn installed and `attn_implementation="flash_attention_2"` |
| `ImportError: flash_attn` | Build failed | Check CUDA version matches, rebuild with correct torch |
| VRAM > 6GB for AWQ | AWQ not loading | Verify `autoawq` installed, check model ID |
| `KeyError` on model load | Wrong model ID | Use exact HuggingFace model ID with organization prefix |

---

## Migration Path

### Phase 1: Document Current State ✅ (This Document)

- Clarify ColQwen3 capabilities vs limitations
- Document `/detect_elements` gap
- Propose implementation options
- Correct Byaldi assumptions

### Phase 2: Choose Implementation Path (Decision Required)

| Criteria | Option 1: LayoutLMv3 | Option 2: Visual Queries | Option 3: Disable |
|----------|---------------------|-------------------------|------------------|
| **Accuracy** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| **Complexity** | Medium | Low | Minimal |
| **VRAM** | +2-3GB | 0GB | 0GB |
| **Maintenance** | New model | Existing | None |
| **Time to Deploy** | 2-3 days | 1 day | 1 hour |

**Recommendation**: **Option 1 (LayoutLMv3)** for production quality, **Option 3 (Disable)** as interim solution.

### Phase 3: Implementation

#### Option 1 Timeline

| Task | Duration | Owner |
|------|----------|-------|
| Research LayoutLMv3 integration | 4 hours | ML Engineer |
| Implement `layout_detector.py` | 8 hours | ML Engineer |
| Add `/detect_elements` endpoint | 2 hours | Backend Engineer |
| Update requirements + Dockerfile | 2 hours | DevOps |
| Test on sample documents | 4 hours | QA |
| Update documentation | 2 hours | Tech Writer |
| **Total** | **2-3 days** | |

### Phase 4: Post-Implementation Updates

Update these documents after implementation:

1. `docs/VISUAL_RAG_INTEGRATION.md` - Update Track 3 with actual implementation
2. `docs/EXPERT_PIPELINE_DECISION_TABLE.md` - Update Stage 4 contracts
3. `docs/PIPELINE_STAGE_CONTRACTS.md` - Add layout detection contracts
4. `services/visual-rag-sidecar/README.md` - Document new endpoint
5. `docs/model/layoutlmv3.md` - Create new model profile (if Option 1)

---

## Effective DMS Usage Patterns

### Pattern 1: Document Search by Content

**Use Case**: User searches "Q3 revenue report"

```
User Query → ColQwen3 → Top-K page images → Display results
```

ColQwen3 finds pages containing revenue figures, charts labeled Q3, etc. without needing OCR.

### Pattern 2: Similar Document Discovery

**Use Case**: "Find all documents that look like this invoice"

```
Reference Invoice → ColQwen3 encode → Similarity search → Similar documents
```

Useful for finding mislabeled documents or discovering document types in unorganized archives.

### Pattern 3: Two-Phase RAG for Question Answering

**Use Case**: "What was our Q3 revenue?"

```
Query → ColQwen3 (retrieval) → Top-K pages → Qwen3-VL (extraction) → "$4.2M"
```

ColQwen3 handles retrieval; a separate VLM extracts the specific answer.

### Pattern 4: Video Meeting Search

**Use Case**: "Find the meeting where we discussed the budget"

```
Query → ColQwen3 → Relevant video frames → Timestamp markers
```

ColQwen3's video capability enables searching recorded meetings without transcription.

### Anti-Pattern: Using ColQwen3 for Text Extraction

**DON'T DO THIS**:
```
Document → ColQwen3 → ??? → Extracted text  // ColQwen3 doesn't output text
```

**DO THIS INSTEAD**:
```
Document → ColQwen3 (find relevant pages) → Qwen3-VL/Tesseract (extract text)
```

---

## Conclusion

### Key Takeaways

1. **ColQwen3 is a visual retrieval model** that finds documents by visual+text similarity
   - ✅ Excellent for: Finding documents containing specific content without OCR
   - ❌ Not designed for: Text extraction, bounding box generation, layout analysis

2. **The `/detect_elements` endpoint gap is architectural**, not a bug
   - ColQwen3 produces embeddings for retrieval, not bounding boxes for detection
   - A separate layout model (LayoutLMv3) is needed for element detection

3. **Use direct transformers loading**, not Byaldi
   - Byaldi v0.0.7 supports ColQwen2, not ColQwen3
   - TomoroAI's official examples use `AutoModel.from_pretrained()`

4. **The two-phase RAG pattern** separates retrieval from extraction
   - Phase 1: ColQwen3 retrieves relevant pages
   - Phase 2: VLM/OCR extracts specific information

5. **Pin `transformers==4.57.3`** for FlashAttention 2 compatibility
   - Flash-attn compiles against transformer internals
   - Version drift causes runtime errors

### Next Steps

1. **Decision**: Select implementation path for Track 3
2. **Implementation**: Execute chosen path
3. **Documentation**: Update related docs post-implementation
4. **Monitoring**: Add metrics for retrieval quality (recall@K, latency)

---

## References

### Internal Documentation
- `docs/VISUAL_RAG_INTEGRATION.md` - Visual RAG integration architecture
- `docs/EXPERT_PIPELINE_DECISION_TABLE.md` - Authoritative pipeline contracts
- `services/visual-rag-sidecar/README.md` - Sidecar service documentation
- `services/experts/ParallelOcrExecutor.js` - Track 3 implementation (lines 467-548)

### External Resources - Model Documentation
- [TomoroAI/tomoro-colqwen3-embed-4b](https://huggingface.co/TomoroAI/tomoro-colqwen3-embed-4b) - Base model card
- [TomoroAI/tomoro-ai-colqwen3-embed-4b-awq](https://huggingface.co/TomoroAI/tomoro-ai-colqwen3-embed-4b-awq) - AWQ quantized model
- [TomoroAI/tomoro-colqwen3-embed-8b](https://huggingface.co/TomoroAI/tomoro-colqwen3-embed-8b) - 8B variant
- [Tomoro.ai Blog: Beyond Text](https://tomoro.ai/insights/beyond-text-unlocking-true-multimodal-end-to-end-rag-with-tomoro-colqwen3) - Official announcement

### External Resources - Architecture
- [ColPali Paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) - Late interaction retrieval methodology
- [Byaldi GitHub](https://github.com/AnswerDotAI/byaldi) - ColPali/ColQwen2 wrapper (not ColQwen3)
- [ColPali Engine](https://github.com/illuin-tech/colpali) - Training and inference code
- [Weaviate: Late Interaction Overview](https://weaviate.io/blog/late-interaction-overview) - Technical explanation

### External Resources - Layout Analysis (for Track 3)
- [LayoutLMv3 Paper](https://arxiv.org/abs/2204.08387) - Document layout analysis
- [Detectron2 + PubLayNet](https://github.com/facebookresearch/detectron2) - Object detection for documents
- [Table Transformer](https://arxiv.org/abs/2110.00061) - Specialized table detection

---

**Document Status**: ✅ Complete - Audit corrections applied

**Last Updated**: 2026-02-04

**Audit Date**: 2026-02-04

**Maintainers**: paperless-ai core team