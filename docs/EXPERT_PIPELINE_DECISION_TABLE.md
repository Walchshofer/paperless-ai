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

### Track 3: Visual Element Detection (parallel with OCR)

**Execution**
- Table detection via Visual RAG sidecar queries
- Image/figure detection
- Layout analysis
- 500ms timeout per detection task
- Circuit breaker protected

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

**Visual Query Execution**
- Max 5 concurrent queries per document
- Dynamic k selection based on query type and confidence
- Deduplication of overlapping bounding boxes (IoU > 0.7)

**Dynamic K Formula**
```
K = base_K * (1 + (1 - confidence) * 0.5) * (1 + rarity_factor)

Base K values:
- field_extraction: k=3 (high precision)
- validation: k=5 (moderate)
- exploration: k=10 (high recall)
```

**Result Aggregation**
- Merge visual search results with extraction output
- Update field confidence scores with visual confirmations
- Add overlay positions to field metadata
- Flag newly discovered fields from visual search

**Rules**
- No pipeline failure if unavailable
- Evidence only (no OCR, no extraction)
- Graceful degradation if circuit breaker OPEN

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

---

## Non-Negotiable Guarantees

- Deterministic retries
- No infinite loops
- No Guidance-only stages
- Explicit OCR source selection
- All fallbacks logged and auditable
