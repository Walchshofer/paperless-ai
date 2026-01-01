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

## Stage 4: Visual OCR

### Purpose
Extract text using a vision-capable LLM.

### Inputs
- Page images

### Outputs
- Visual OCR text

### Allowed
- Direct Ollama vision model calls
- OCR quality scoring vs Tesseract
- OCR source selection

### Forbidden
- Use of Visual RAG
- Page-specific retries
- Schema inference

---

## Stage 5: Extraction

### Purpose
Produce structured data from OCR text.

### Inputs
- Selected OCR text
- Evidence context

### Outputs
- Schema-compliant structured fields

### Allowed
- Guidance execution
- PromptRegistry fallback
- JsonRepair

### Forbidden
- Silent failure
- Partial schema emission
- Skipping validation

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
Attach visual evidence overlays.

### Inputs
- Final structured result

### Outputs
- Visual overlay references

### Allowed
- Best-effort retrieval
- Evidence linking

### Forbidden
- OCR
- Extraction
- Pipeline failure if unavailable

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

### Forbidden
- Business logic
- Validation
- LLM calls

---

## Non-Negotiable Rule

If a behavior is not explicitly allowed here, it is forbidden.
