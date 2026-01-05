# Pipeline Stage Contracts

This document defines the **strict responsibility boundaries** for each stage of
the Expert Pipeline.

Stages MUST NOT assume responsibilities outside their contract.

Execution order, retries, and fallback behavior are defined in
`EXPERT_PIPELINE_DECISION_TABLE.md`.

---

## General Rules (Apply to All Stages)

- Stages must be deterministic
- Stages must not mutate global state unless explicitly allowed
- Stages must not invoke retries directly
- Stages must surface errors; orchestration decides recovery
- Stages must not assume Guidance availability
- If Guidance is used, templates must follow the Guidance authoring rules:
  `temperature=0.0` for classification/extraction, `select()` for fixed options,
  regex constraints for identifiers, and `guidance_json` for schema outputs.
- Geometry must be provenance-based (normalization metadata or sidecar boxes);
  LLMs must not invent coordinates.
- Evidence refs are required for any extracted field, tag, or storage action.

---

## Context Pack (Required for LLM Stages)

LLM stages must consume a Context Pack with: document identity, classification
priors, evidence bundle (visual hits + OCR snippets + text snippets),
normalization metadata, policy constraints, user preferences, and system state.
Full OCR dumps are forbidden; only evidence snippets may be passed.

---

## Stage 1: Classification (SYS_ROUTER_V1)

### Purpose
Determine document domain and overall quality signals.

### Inputs
- Base64-rendered page images
- OCR text (if available)

### Outputs
- `primary_domain`
- `quality_assessment` (document-level only)

### Allowed
- Vision-based inspection
- Global quality heuristics

### Forbidden
- Page-level guarantees
- Extraction
- OCR replacement
- Document mutation

---

## Stage 2: Orchestration

### Purpose
Plan pipeline execution.

### Inputs
- Classification output
- Pipeline configuration
- Runtime options

### Outputs
- Execution flags:
  - `use_guidance`
  - `use_visual_ocr`
  - `use_visual_rag`
- Tool planning metadata

### Allowed
- Planning only
- Flag resolution

### Forbidden
- Tool execution
- LLM calls
- Document mutation

---

## Stage 3: Pre-Vision Normalization

### Purpose
Correct image geometry prior to OCR or visual analysis.

### Inputs
- Page images
- Router quality signals

### Outputs
- Normalization actions (rotate, crop, scale)

### Allowed
- Geometry analysis
- Image transformation
- Conditional re-ingestion

### Forbidden
- OCR
- Extraction
- Multiple re-runs
- Execution without `has_images === true`

---

## Stage 4: Parallel OCR + Visual Element Detection

### Purpose
Execute OCR and visual element detection in parallel with circuit breaker protection.

### Inputs
- Document ID (for Tesseract OCR fetch)
- Prepared/normalized page images
- Execution context

### Outputs
- `enhanced_ocr_text` - Reconciled OCR text from best source(s)
- `ocr_metadata` - Source attribution, conflict rate, latency metrics
- `visual_elements` - Detected tables, images, layout structure

### Implementation Notes
- Execute Stage 4 through a `TEXT_EXTRACTION` stage with `useParallelOcr: true` (or an explicit parallel-ocr stage) so the executor routes to `ParallelOcrExecutor`.
- Persist `document.enhanced_ocr_text` and `document._ocr_metadata` for downstream stage inputs.

### Allowed
- **Track 1: Visual OCR**
  - Direct Ollama vision model calls (qwen3-vl:8b via ollama_visual)
  - OCR text extraction from images
  - 500ms latency budget, 1000ms hard timeout

- **Track 2: Tesseract OCR**
  - Fetch from Paperless-ngx API `/api/documents/{id}/` endpoint
  - Use `content` field for Tesseract OCR output
  - Parallel execution with Visual OCR

- **Track 3: Visual Element Detection**
  - Table detection via Visual RAG sidecar
  - Image/figure detection
  - Layout analysis
  - Circuit breaker protected calls
  - 500ms timeout per detection task

- **OCR Reconciliation**
  - Use `mergeOcrResults()` when both sources succeed
  - Length ratio scoring
  - Structural integrity checks
  - Garbage detection
  - Document type awareness (scanned docs favor Visual OCR)

- **Circuit Breaker**
  - Track failure counts per service
  - Transition states: CLOSED → OPEN → HALF_OPEN
  - Exponential backoff: 100ms, 200ms, 400ms
  - Graceful degradation when circuit OPEN

### Forbidden
- Using Visual RAG for OCR extraction
- Page-specific retries (document-scoped only)
- Schema inference
- Infinite retry loops
- Blocking on Visual Sidecar when circuit OPEN

---

## Stage 5: Extraction

### Purpose
Produce structured data from OCR text.

### Inputs
- Selected OCR text (enhanced_ocr_text)
- Evidence context
- Visual elements (optional)

### Outputs
- Schema-compliant structured fields
- Field confidence scores
- `evidence_refs[]` for each field (page_id+bbox, chunk_id, or OCR offset)

### Allowed
- Guidance execution
- PromptRegistry fallback
- JsonRepair

### Forbidden
- Silent failure
- Partial schema emission
- Skipping validation

### Execution Notes
- Validation-driven retries are orchestrated by the executor via `_executeWithValidation()` and `ValidationEngine.validate()`.
- Stage-level `retryCount` must not be used to implement validation-driven extraction retries.

---

## Stage 5.5: Visual Query Generation

### Purpose
Generate targeted visual queries for field validation and missing field detection.

### Inputs
- `extraction_result` - Structured extraction output from Stage 5
- `ocr_text` - Reconciled OCR text
- `field_schema` - Paperless-ngx custom field taxonomy
- `visual_elements` - Detected tables, images, layout from Stage 4

### Outputs
- `visual_queries` - Array of query objects:
  - `question` (string, required) - Natural language query
  - `field_target` (string, required) - Target field name
  - `expected_element_type` (string, required) - field_extraction | validation | exploration
  - `priority` (number, 0-1) - Query priority
  - `confidence` (number, 0-1) - Expected confidence for dynamic k
  - `rarity_factor` (number, 0-1) - Field rarity in taxonomy for dynamic k

### Allowed
- Use Guidance template `visual_query_generator_de` (or domain variants)
- Query custom field taxonomy from Paperless-ngx API
- Generate minimum 3 queries per document
- Target missing or low-confidence fields from extraction
- Use OCR text to create precise field-targeted questions
- Access visual elements metadata for context

### Forbidden
- Direct Visual RAG sidecar calls (query generation only, not execution)
- Mutation of extraction result
- Execution when circuit breaker is OPEN
- Generating queries for fields not in schema or taxonomy
- Failing the pipeline if query generation fails (must gracefully degrade)

### Execution Condition
- Only execute if `context.visualSidecarAvailable !== false`
- Circuit breaker must be CLOSED or HALF_OPEN
- Must be positioned after extraction, before reasoning

### Validation
- Minimum 3 queries required
- Each query must have: question, field_target, expected_element_type
- Field targets must exist in extraction schema or custom field taxonomy

### Fallback Behavior
- If query generation fails → skip visual validation
- Pipeline continues with extraction-only results
- Log warning but do not fail pipeline

---

## Stage 6: Reasoning (e.g. FIN_REASONER)

### Purpose
Perform consistency checks and advisory reasoning.

### Inputs
- Extracted structured data

### Outputs
- `suggested_corrections`
- `consistency_checks`

### Allowed
- Mathematical validation
- Cross-field consistency checks

### Forbidden
- Implicit data overwrites
- Authoritative extraction

---

## Stage 7: Validation

### Purpose
Assess extraction completeness and confidence.

### Inputs
- Structured extraction output

### Outputs
- Validation report:
  - `missingFields`
  - `lowConfidenceFields`
  - `score`
  - `shouldFallback`

### Allowed
- Field-level confidence checks

### Forbidden
- Page-level attribution
- Retry execution

---

## Stage 8: Enrichment (Visual RAG)

### Purpose
Execute visual queries and attach visual evidence overlays with field enhancements.

### Inputs
- `visual_queries` - Generated queries from Stage 5.5
- Document ID
- Final structured result from extraction
- Execution context

### Outputs
- `visual_search_results` - Aggregated search results with deduplication
- Enhanced extraction with:
  - Updated field confidence scores
  - Overlay positions (page, x, y, width, height)
  - Visual confirmations
  - Newly discovered fields

### Allowed
- **Visual Query Execution**
  - Execute queries via Visual RAG sidecar
  - Max 5 concurrent queries per document
  - Dynamic k selection using formula: `K = base_K * (1 + (1 - confidence) * 0.5) * (1 + rarity_factor)`
  - Circuit breaker protected calls

- **Base K Values**
  - field_extraction: k=3 (high precision)
  - validation: k=5 (moderate)
  - exploration: k=10 (high recall)

- **Result Aggregation**
  - Deduplicate overlapping bounding boxes (IoU > 0.7)
  - Merge visual confirmations with extraction output
  - Boost field confidence scores when visually validated
  - Add overlay positions to field metadata
  - Flag newly discovered fields from visual search

- **Best-effort retrieval**
- **Evidence linking**

### Forbidden
- OCR extraction (evidence only)
- Overwriting extraction without visual confirmation
- Pipeline failure if Visual Sidecar unavailable
- Executing queries when circuit breaker OPEN (must skip gracefully)
- Blocking pipeline on visual query failures

---

## Stage 9: Finalization

### Purpose
Persist results back to Paperless-ngx.

### Inputs
- Final pipeline output

### Outputs
- PATCH request to Paperless

### Allowed
- Metadata updates
- Tag assignment
- Custom field updates
- Actions must carry evidence refs and pass policy constraints

### Forbidden
- Business logic
- Validation
- LLM calls

---

## Non-Negotiable Rule

If a behavior is not explicitly allowed here, it is forbidden.
