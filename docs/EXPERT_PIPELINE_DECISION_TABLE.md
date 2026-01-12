# Expert Pipeline Decision Table

This document is the **authoritative runtime contract** for the paperless-ai
Expert Pipeline.

All orchestration, retries, fallbacks, OCR selection, and optimizations MUST
comply with this document.

If documentation and code disagree, **this document wins**.

---

## Pipeline Precedence (Hard Rule)

Execution precedence is strictly enforced:

1. Orchestrator Plan
2. Pipeline / Stage Options
3. Environment Variables
4. Defaults

Lower layers must never override higher layers.

---

## Pipeline Stages (Overview)

| Stage | Name | Purpose |
|------:|------|---------|
| 1 | Classification | Domain + document quality |
| 2 | Orchestration | Execution planning |
| 3 | Pre-Vision Normalization | Geometry correction |
| 4 | Parallel OCR + Element Detection (images, tables, graphics,text) No overlay boxes| Visual OCR, Tesseract OCR, visual elements (parallel) |
| 5 | Extraction | Structured data extraction |
| 5.5 | Visual Query Generation | Generate targeted visual queries for field validation |
| 6 | Reasoning | Advisory consistency checks |
| 7 | Validation | Output validation |
| 8 | Enrichment | Visual RAG overlays + query execution |
| 9 | Finalization | Patch Paperless |

---

## Stage 1: Classification (SYS_ROUTER_V1)

**Inputs**
- Base64-rendered page images
- OCR text (if available)

**Outputs**
- `primary_domain`
- `quality_assessment` (document-level only)

**Rules**
- No page-level guarantees
- Retries are bounded
- No extraction or mutation

---

## Stage 2: Orchestration

**Outputs**
- `use_guidance`
- `use_visual_ocr`
- `use_visual_rag`
- execution flags

**Rules**
- Planning only
- No tools
- No document mutation

---

## Context Pack (Canonical)

All Guidance and VLM calls must use a Context Pack as the sole context source:
- Document identity: `doc_id`, `source`, timestamps, tenant/user
- Classification priors: doc type candidates + confidence
- Evidence bundle:
  - Visual hits: `page_id`, `bbox`, `score`
  - OCR snippets for those hits
  - Text retrieval snippets (if used)
  - Normalization metadata (rotate, deskew angle, crop box)
- Policy constraints: allowed roots, naming templates, retention rules
- User preferences: vendors, taxonomy, locale/currency
- System state: existing tags, duplicates, related docs

Raw OCR dumps are forbidden; only evidence snippets are allowed.

---

## Stage 3: Pre-Vision Normalization

**Guards**
- `has_images === true`
- Router signals OR low OCR quality

**Actions**
- Rotate
- Crop
- Scale

**Rules**
- Must not loop
- Re-ingest only if geometry changes
- Skipped entirely for text-only documents

---

## Asset Derivation (Deterministic)

After normalization, derive deterministic artifacts:
- Page images and thumbnails
- Normalized renditions for visual indexing
- Normalization metadata persisted for evidence tracing

Artifacts are input to both visual indexing and OCR reconciliation.

---

## Stage 4: Parallel OCR + Visual Element Detection

**Execution Mode**: Parallel execution with circuit breaker protection

### Track 1: Visual OCR (qwen3-vl:8b via ollama_visual)

**Execution**
- Direct call to Ollama vision model (e.g. `qwen3-vl`)
- Visual RAG is NOT used
- 500ms latency budget, 1000ms hard timeout

### Track 2: Tesseract OCR (paperless-ngx API)

**Execution**
- Fetch OCR text from Paperless-ngx `/api/documents/{id}/` endpoint
- Uses `content` field for Tesseract OCR output
- Parallel execution with Visual OCR

### Track 3: Visual Element Detection (parallel with OCR) ⚠️ NOT IMPLEMENTED

**Status**: Feature gap - `/detect_elements` endpoint not implemented in visual-rag-sidecar

**Intended Execution**
- Table detection with bounding boxes
- Image/figure detection
- Layout zone analysis
- 500ms timeout per detection task
- Circuit breaker protected

**Current Behavior**
- Endpoint call fails with HTTP 404/503
- Circuit breaker opens after 3 failures
- Pipeline continues gracefully without layout elements
- OCR reconciliation proceeds normally

**Implementation Gap**
- ColQwen3 is a visual retrieval model, not a layout analysis model
- Requires dedicated layout model (LayoutLMv3, Detectron2, or Table Transformer)
- See `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` for implementation options

**Graceful Degradation**
- Track 3 failure does NOT fail the pipeline
- `visual_elements` will be null in output
- Stages 5-9 proceed with OCR-only results

**OCR Reconciliation**
Visual OCR and Tesseract outputs are reconciled using:
- Length ratio scoring
- Structural integrity checks
- Garbage detection
- Document type awareness (scanned docs favor Visual OCR)

**Selection**
- If both sources succeed → use `mergeOcrResults()` for reconciliation
- If single source succeeds → use that source
- If all sources fail → throw error with context

**Output**
- `enhanced_ocr_text` = Reconciled OCR text
- `ocr_metadata` = Source attribution, conflict rate, latency
- `visual_elements` = Tables, images, layout structure

**Implementation Notes**
- Invoke Stage 4 via a `TEXT_EXTRACTION` stage with `useParallelOcr: true` (or an explicit `parallel-ocr` stage) so the executor routes to `ParallelOcrExecutor`.
- Executor must persist `document.enhanced_ocr_text` and `document._ocr_metadata` (or equivalent) and store `ocr_metadata` in the stage output for downstream stages.

**Circuit Breaker**
- States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)       
- 3 consecutive failures trigger OPEN state
- 30 second cooldown before HALF_OPEN attempt
- Exponential backoff: 100ms, 200ms, 400ms
- Graceful degradation: Skip visual operations when circuit OPEN

---

## Stage 5: Extraction

**Execution Order**
1. Attempt Guidance (if enabled & eligible)
2. Fallback to PromptRegistry + JsonRepair

**Rules**
- Same `promptId` in both paths
- No silent failures
- Output must match schema
- Field outputs must include evidence refs

---

## Guidance Output Contracts (V2)

Guidance produces three separate outputs to keep tasks small and testable:

1) **Classification + Tagging**
```
{ doc_type, tags[], entities[], confidence, rationale, evidence_refs[] }
```

2) **Field Extraction**
```
{ fields: [{ name, value, confidence, evidence_ref }] }
```

3) **Autonomous Storage Plan**
```
{ folder_path, filename, actions[], confidence, safety_checks[] }
```

---

## Stage 5.5: Visual Query Generation

**Purpose**
Generate targeted visual queries for field validation and missing field detection

**Execution Condition**
- `context.visualSidecarAvailable !== false`
- Circuit breaker must be CLOSED or HALF_OPEN
- Executed after extraction, before reasoning

**Inputs**
- `extraction_result` - Structured extraction output
- `ocr_text` - Reconciled OCR text
- `field_schema` - Paperless-ngx custom field taxonomy
- `visual_elements` - Detected tables, images, layout

**Outputs**
- `visual_queries` - Array of targeted queries:
  - `question` - Natural language query
  - `field_target` - Target field name
  - `expected_element_type` - field_extraction | validation | exploration
  - `priority` - Query priority (0-1)
  - `confidence` - Expected confidence (for dynamic k)
  - `rarity_factor` - Field rarity in taxonomy (for dynamic k)

**Guidance Template**
- `visual_query_generator_de` (financial/medical/legal variants)
- Minimum 3 queries required
- Queries must target missing or low-confidence fields

**Validation**
- At least 3 queries generated
- Each query must have: question, field_target, expected_element_type
- Field targets must exist in extraction schema or custom field taxonomy

**Fallback**
- If Visual Query Generation fails → skip visual validation
- Pipeline continues with extraction-only results
- No pipeline failure

---

## Stage 6: Reasoning (FIN_REASONER)

**Purpose**
- Logical consistency checks
- Advisory corrections only

**Outputs**
- `suggested_corrections`
- `consistency_checks`

**Rules**
- Advisory ONLY
- Must not overwrite extraction implicitly
- Orchestrator must explicitly apply allowed corrections

---

## Stage 7: Validation

**Validator Output**
- `missingFields[]`
- `lowConfidenceFields[]`
- `score`
- `shouldFallback`

**Important**
- No page-level locality
- Retries are document-scoped

---

## Validator Severity & Retry Policy

| Severity | Condition | Action |
|--------:|----------|-------|
| High | Missing required fields | Retry extraction → escalate OCR → fallback |
| Medium | Low confidence fields | Retry once → accept with warning |
| Low | Formatting issues | Normalize → accept |

**Retry Guarantees**
- Always bounded
- Explicit retry reason recorded
- `retry_scope = "document"`

**Terminal States**
- Success
- Accepted with warnings
- Manual review required

---

## Stage 8: Enrichment (Visual RAG)

**Execution**
- Optional, best effort
- Executes visual queries generated in Stage 5.5
- Circuit breaker protected

**Visual RAG Stage (Native Protocol Alpha-9)**
- **Input:** Base64 images + Query (from Visual Query Generator)
- **Mechanism:** Native ColQwen3 late-interaction MaxSim (`processor.score_multi_vector`) executed by the Visual RAG Sidecar (320-dim multi-vector per patch).
- **Gate:** Accept hits when MaxSim score >= **0.85** (configurable threshold for high-precision retrieval).
- **Fallback:** If the Visual RAG Sidecar returns `503 Initializing` or is unavailable, route the query to Text RAG (Qdrant `document_embeddings`) as the fallback retrieval path.

**Visual Query Execution**
- Max 5 concurrent queries per document
- Dynamic k selection based on query type and confidence
- Circuit breaker provides bounded retries/backoff; no additional per-query retry loop
- If document image is unavailable, skip visual queries and return extraction-only
- Deduplication of overlapping bounding boxes (IoU > 0.6 effective; config default 0.7 with 0.1 tolerance)

**Dynamic K Formula**
```
K = base_K * (1 + (1 - confidence)) * (1 + rarity_factor)

Base K values:
- field_extraction: k=3 (high precision)
- validation: k=5 (moderate)
- exploration: k=10 (high recall)
```

**Result Aggregation**
- Merge visual search results with extraction output
- Update field confidence scores with visual confirmations
- Confidence fusion weights: extraction 0.6, visual 0.4
- Add overlay positions to field metadata
- Flag newly discovered fields from visual search

**Rules**
- No pipeline failure if unavailable
- Evidence only (no OCR, no extraction)
- Graceful degradation if circuit breaker OPEN

---

## Stage 9: Finalization

**Purpose**
Persist results back to Paperless-ngx and apply approved actions.

**Outputs**
- PATCH requests and/or bulk actions with evidence refs
- Action audit log entries (`document_actions`)

**Rules**
- Only apply actions that pass policy constraints
- Evidence refs must be attached to each action
- Non-destructive by default; destructive actions require confirmation

---

## Retrieval + Answering (Visual-first, V2)

**Default**: Visual retriever is primary; text is fallback or validation.

Flow:
- Query Router → Visual Retrieval (pgvector visual index → topK pages/regions)
- Optional Text Retrieval → Context Pack Builder
- Guidance Response Generator → Action Orchestrator → Audit Log

ColQwen3 locates relevant regions; Qwen3-VL/Guidance decide actions.

---

## OCR Strategy (Summary)

- Visual OCR via Ollama vision model
- Tesseract OCR from Paperless
- Best source selected via scoring
- Visual RAG is never used for OCR

---

## Guidance vs PromptRegistry (Summary)

- PromptRegistry is authoritative
- Guidance is optional optimization
- Fallback is mandatory
- Relaxed fallback = Standard Ollama execution + JsonRepair

---

## Roadmap & Known Constraints

Current intentional limitations:
- Validation has no page locality
- Router has no page-level layout output
- Targeted OCR requires schema evolution
- Guidance cache namespace requires Python support

All future changes must follow:
- `SCHEMA_EVOLUTION_GUIDE.md`
- Schema Evolution Agent guardrails

- NOTE: Upgrading to ColQwen3 / Qwen2.5 (Byaldi/Colpali) requires updating the Visual RAG sidecar build to install `colpali` from source and use `byaldi>=0.0.7` with `autoawq` and `flash-attn`; ensure GPU smoke tests pass before promoting to production.
- **ColQwen3 Integration**: The sidecar uses native Byaldi v0.0.7+ integration with Dynamic Registry Injection as fallback. See `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` section "ColQwen3 Integration Strategy" for architecture decision, dependency validation, and operational validation protocol. Critical: `trust_remote_code=True`, `load_in_4bit=False`, and `attn_implementation="flash_attention_2"` are MANDATORY parameters for AWQ 4B variant.

---

## Non-Negotiable Guarantees

- Deterministic retries
- No infinite loops
- No Guidance-only stages
- Explicit OCR source selection
- All fallbacks logged and auditable
