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
| 4 | Visual OCR | OCR via vision model |
| 5 | Extraction | Structured data extraction |
| 6 | Reasoning | Advisory consistency checks |
| 7 | Validation | Output validation |
| 8 | Enrichment | Visual RAG overlays |
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

## Stage 4: Visual OCR (Direct Ollama)

**Execution**
- Direct call to Ollama vision model (e.g. `qwen3-vl`)
- Visual RAG is NOT used

**Comparison**
Visual OCR output is scored against Tesseract OCR using:
- Length ratio
- Structural integrity
- Garbage detection

**Selection**
- If visual score ≥ threshold → use Visual OCR
- Else → fallback to Tesseract OCR

**Output**
- `enhanced_ocr_text` = Selected Best OCR (Visual vs Tesseract)

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
- Optional
- Best effort

**Rules**
- No pipeline failure if unavailable
- Evidence only (no OCR, no extraction)

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
