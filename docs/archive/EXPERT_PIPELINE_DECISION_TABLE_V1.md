# Expert Pipeline: Optimized Flow & Decision Logic

This document defines the deterministic logic, gates, and fallback strategies for the Expert Pipeline. It resolves ambiguities regarding precedence, caching, and multi-container coordination found in the codebase.

## 1. System Architecture & Boundaries

The pipeline operates across three primary services with distinct responsibilities and failure domains.

| Service | Responsibility | State / Storage | Failure Behavior |
| :--- | :--- | :--- | :--- |
| **paperless-ai** (Node.js) | Orchestration, Routing, Logic, Tool Execution | Memory (ExecutionContext), Redis (Jobs) | Fails job, retries if transient |
| **guidance-service** (Python) | Deterministic Extraction, Template Caching, Token Healing | Local Disk/Mem Cache (`~/.cache/guidance`) | Falls back to PromptRegistry (Ollama) |
| **visual-rag** (Sidecar/PG) | Visual Ingestion, Embedding, Overlay Storage | PostgreSQL (`visual_overlays` table) | Graceful degradation (skips enrichment) |

---

## 2. Decision Table: Stage Execution Logic

This table governs the `ExpertPipelineExecutor` logic.

| Stage | Trigger / Gate | Action | Retry Policy | Cache Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **1. Classification** | New Document | Run `SYS_ROUTER_V1` | 3 retries (exp backoff: 1s, 2s, 4s) | None (High variance) |
| **2. Orchestration** | `MODEL_NAMES.orchestrator` configured | Run `SYS_ORCHESTRATOR_V1` | 0 retries (Optional stage) | None |
| **3. Pre-Vision Norm.** | Orchestrator `use_visual_ocr=true` OR `has_images` | Run `PreVisionNormalizer` | 0 retries (Best effort) | None |
| **4. Visual OCR** | `use_visual_ocr=true` AND `images.length > 0` | Run `VIS_OCR_V1` (Direct Ollama) | 1 retry per page | Cached by Image Hash (in VRAM/Ollama) |
| **5. Domain Pipeline** | `classification.confidence > 0.6` | Route to Expert (e.g., Financial) | N/A | N/A |
| **6. Extraction** | `guidanceEnabled=true` AND `template` exists | **Try Guidance Service** (Token Healing active) | 2 retries (1s delay) | **Server-Side**: Key = `(template, variables)` |
| &nbsp; *↳ Fallback* | Guidance fails or disabled | **Fallback to PromptRegistry** | 1 retry | None |
| **7. Visual RAG** | `enableVisualRag=true` | Ingest + Fetch Overlays | 3 retries (DB connection) | Postgres (Permanent) |

---

## 3. Configuration Precedence Rules

The `ExpertPipelineExecutor` applies configuration in this strict order (highest priority first):

1.  **Orchestrator Plan:** If the Orchestrator explicitly sets `use_visual_ocr: false`, it overrides all else.
    *   *Code Source:* `ExpertPipelineExecutor.js` -> `orchestrationPlan` logic.
2.  **Pipeline/Stage Config:** Options passed to `execute()` (e.g., from `processDocument` overrides).
3.  **Environment Variables / Global Config:** `process.env.VISUAL_OCR_ENABLED` or `config.visualOCR`.
4.  **Defaults:** Hardcoded defaults (e.g., `timeout: 60000`).

**Example Scenario:**
- Env: `VISUAL_OCR_ENABLED=yes`
- Orchestrator: `use_visual_ocr=false` (e.g., because document is a text-heavy contract)
- **Result:** Visual OCR is **SKIPPED**.

---

## 4. Data Schemas & Contracts

### A. Visual Overlay Schema (PostgreSQL)

Stored in table `visual_overlays`. Used for Visual RAG enrichment.

```json
{
  "doc_id": 12345,
  "page_number": 1,
  "overlay_data": {
    "label": "signature_block",
    "box": [850, 100, 950, 400], // [ymin, xmin, ymax, xmax] (0-1000)
    "confidence": 0.98,
    "text": "Signed by: John Doe" // Optional extracted text
  },
  "semantic_label": "signature",
  "embedding": [0.12, -0.05, ...] // Vector(768) - Optional
}
```

### B. Expert Knowledge Schema (PostgreSQL)

Special overlay type (`page_number=0`, `semantic_label='expert_knowledge'`) acting as a "Sidecar Memory".

```json
{
  "enhanced_ocr_text": "Selected Best OCR (Visual vs Tesseract)...",
  "expert_metadata": {
    "risk_score": 0.8,
    "requires_review": true
  },
  "domain_signals": ["urgent", "legal_threat"],
  "routing_weights": {
    "legal": 0.9,
    "financial": 0.1
  }
}
```

### C. Guidance Cache Key (Implicit)

The Guidance Service (Python) caches generations based on:
1.  **Template Content:** Hash of the `.handlebars` template file.
2.  **Input Variables:** JSON stringification of the `variables` object passed in `generate()`.
3.  **Model Name:** e.g., `sauerkraut-llama3.1:8b`.

*Note: The Node.js client (`GuidanceClient.js`) does not calculate this key; it relies on the Python service.*

---

## 5. Failure Modes & Recovery

| Failure Type | Detection | Recovery Strategy |
| :--- | :--- | :--- |
| **Guidance Timeout** | `axios` timeout (>90s) | Log warning -> Fallback to Standard Ollama Prompt -> Repair JSON |
| **Visual RAG Offline** | `isAvailable()` check fails | Skip ingestion/enrichment -> Log warning -> Continue pipeline |
| **Router Failure** | Model unavailable / 5xx | Retry (x3) -> Fallback to `General` pipeline -> `PIPELINE_GENERAL_V1` |
| **Token Limit** | `truncationMetrics` event | **Current:** Truncate text (lossy). <br>**Recommended:** Summarize text first (chunking not yet implemented). |

---

## 6. Validator & Retry Policy

The following table defines how `ValidationEngine` failures should be handled to ensure deterministic correction.

| Validation Failure | Example | Severity | Escalation Strategy |
| :--- | :--- | :--- | :--- |
| **Missing Required Field** | `invoice_number` is null | High | 1. Retry with `PreVisionNormalizer` (if visual)<br>2. Fallback to `PromptRegistry` with relaxed constraints |
| **Low Confidence** | `confidence < 0.8` | Medium | 1. Trigger `VIS_OCR_V1` (Evidence Expansion)<br>2. Flag for Human Review |
| **Format Mismatch** | Date is `Jan 1` not `YYYY-MM-DD` | Low | 1. Apply `LocalTranslator` or Regex normalization<br>2. Accept with warning |
| **Logic Consistency** | `subtotal + tax != total` | High | 1. Trigger `FIN_REASONER_V1` (Self-correction)<br>2. Flag as "Calculation Mismatch" |

---

## 7. OCR Strategy & Comparison

The system actively compares Ollama-based Visual OCR against Paperless-ngx Tesseract OCR.

*   **Visual Model:** Uses the configured Router model (default `qwen3-vl:8b`) via direct Ollama API call.
*   **Comparison Logic:** Scores Visual OCR based on length ratio, structure (line breaks), and alphanumeric content relative to Tesseract output.
*   **Selection:**
    *   If `visual_score >= 0.6` (default), uses **Visual OCR**.
    *   Otherwise, falls back to **Tesseract OCR**.
*   **Sidecar Role:** The Visual Sidecar is **NOT** used for primary text extraction. It is exclusively for Visual RAG (embedding and retrieving overlay regions).

---

## 8. Roadmap & Implementation Follow-ups

The following items represent the next phase of engineering work required to fully operationalize the optimized pipeline.

### High-Level Roadmap
1.  **Guidance Cache Namespace:** Implement a mechanism (e.g. `GUIDANCE_CACHE_NAMESPACE`) to safely invalidate server-side caches during deployments without full service restarts.
2.  **Adaptive Summarization:** Promote `_summarizeTextForExtraction()` to a first-class gate when `truncationMetrics` exceed 75% of the context window, replacing raw truncation.
3.  **Targeted OCR:** Refine `VIS_OCR_V1` execution to target only pages flagged by the Router as containing "Tables" or "Handwriting", rather than the first N pages.
4.  **Selective Overlay Fetch:** Optimize Visual RAG to fetch overlays by `semantic_label` (e.g., only "tables") when relevant to the specific expert pipeline.

### Implementation Questions (to Repo Maintainers)

**A) Validator Execution Semantics**
*   **Field-Level Locality:** Does `ValidationEngine` return field-level failure locations (e.g., "invoice_number missing on page 1") to allow targeted OCR/overlay fetch?
*   **Confidence Scope:** Is "confidence" a single document-wide score, or does it exist at the field level? If multiple exist, which specific score drives the "Low Confidence" (< 0.8) retry trigger?
*   **Severity Propagation:** How is "Accept with Warning" surfaced? Is it strictly `quality.warning_count`, or should it also mark a Paperless custom field or attach to metadata?

**B) Retry Actions Implementation**
*   **PreVision Retry Scope:** Does "Retry with PreVisionNormalizer" imply running geometry analysis only (cheap), or a full re-render + re-OCR cycle (expensive)?
*   **Relaxed Mode Contract:** When falling back to `PromptRegistry` with relaxed constraints, what specifically changes? (e.g., distinct prompt ID `_RELAXED_V1`, higher temperature, or looser JSON schema?)

**C) FIN_REASONER Contract**
*   **Authority:** Does `FIN_REASONER_V1` have the authority to overwrite extracted totals/tax values (self-correction), or is it limited to returning a diagnosis and correction suggestion?

**D) Visual OCR & Overlays (Roadmap Support)**
*   **Router Layout Output:** Does the router currently output page-level layout tags (tables/handwriting) in a consumable format (array/flags) to support targeted OCR?
*   **API Capabilities:** Does the `visual-rag` service API already support filtering overlays by `semantic_label` and `page_range`?

**E) Guidance Cache Namespace**
*   **Key Extension:** Can the `guidance-service` accept a cache namespace part of the "model name" or header (e.g., `model = sauerkraut...:8b@schema_v2`) to enable safe invalidation?

### Internal Consistency Check
*   **Retry Logic Guard:** Ensure the "Retry with PreVisionNormalizer" step explicitly checks `has_images && (router_flagged_issue OR low_ocr_quality)` before execution to avoid expensive no-ops on text-only documents, resolving the potential conflict with the pre-vision gate logic.