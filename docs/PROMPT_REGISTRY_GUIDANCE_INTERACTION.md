# Prompt Registry & Guidance Interaction

This document defines the authoritative relationship between the Node.js
`PromptRegistry` and the Python-based `Guidance` service.

It governs how LLM prompts are executed, constrained, retried, and recovered.

This document is authoritative and must remain consistent with:
- `docs/EXPERT_PIPELINE_DECISION_TABLE.md`

---

## Core Principles

### 1) PromptRegistry is the Authority

The `PromptRegistry` (in `services/prompts/PromptRegistry.js`) is the **authoritative registry** for:

- Prompt content (system + user messages)
- Prompt identifiers (`promptId`)
- Logical model mapping (Decoupled from specific strings)
- Default decoding parameters
- Expected output schemas

It defines the **default behavior** for every pipeline stage.

All LLM-driven stages MUST ultimately be representable as a PromptRegistry
execution.

---

### 2) ExpertModels is the Source of Truth (SOT)

While `PromptRegistry` defines *how* a prompt is structured, `config.expertModels` (in `config/config.js`) is the **Source of Truth** for:

- **Specific Model Names**: Maps logical experts (e.g., `medicalImaging`) to actual model identifiers (e.g., `llava-med-v1.6`).
- **Resource Limits**: Defines the `contextWindow` and `maxResponseTokens` for each expert domain.

**Prompt Decoupling Rule**: Prompts MUST reference logical constants (e.g., `MODEL_NAMES.multimodalVision`) rather than hardcoded model strings. These constants are resolved at runtime against `config.expertModels`.

---

### 2) Guidance is an Optional Optimization

The Guidance service (accessed via `GuidanceClient.js`) is a **high-precision
optimization layer** used when:

- Strict JSON adherence is required
- Grammar- or regex-constrained generation improves reliability

Guidance:
- Does NOT define business logic
- Does NOT control retries
- Does NOT decide fallbacks
- Does NOT replace PromptRegistry

Guidance must always be treated as **replaceable infrastructure**.

---

### 3) Graceful Fallback is Mandatory

If Guidance is:
- Disabled
- Unavailable
- Times out
- Returns invalid output

The system MUST fall back to standard PromptRegistry execution.

Fallback is **not optional** and must not be bypassed.

---

## Guidance Template Authoring Rules (Required)

These rules apply to all Guidance templates used for classification, extraction,
reasoning, and visual query generation.

- **Determinism**: Use `temperature=0.0` for classification and extraction tasks.
- **Fixed options**: Use `select()` for enums (doc_type, action, severity,
  expected_element_type).
- **Identifiers**: Use regex constraints for identifiers (UUIDs, invoice numbers,
  dates, amounts).
- **Schema enforcement**: Use `guidance_json(schema=..., name="output")` for any
  structured JSON output.
- **Immutability**: Capture and return the updated LM state
  (`lm = model + template(...)`); do not assume in-place mutation.
- **Tools**: When tools are required, use `Tool.from_callable` or
  `Tool.from_regex` and surface errors explicitly (no silent failures).

---

## Context Pack Contract (Required)

Guidance templates must accept a canonical Context Pack as their only context.
This keeps extraction deterministic and evidence-backed.

**Context Pack fields**:
- `document`: { `doc_id`, `source`, `timestamps`, `tenant_id`, `user_id` }
- `classification_priors`: { `doc_type_candidates[]`, `confidence` }
- `evidence_bundle`:
  - `visual_hits[]`: { `page_id`, `bbox`, `score` }
  - `ocr_snippets[]`: { `page_id`, `bbox`, `text` }
  - `text_snippets[]`: { `chunk_id`, `text`, `score` }
  - `normalization`: { `rotate`, `deskew_angle`, `crop_box`, `dpi` }
- `policy_constraints`: { `allowed_roots[]`, `allowed_path_segments[]`, `naming_templates[]`, `retention_rules[]` }
- `user_preferences`: { `vendors[]`, `taxonomy[]`, `locale`, `currency` }
- `system_state`: { `existing_tags[]`, `duplicate_candidates[]`, `related_docs[]` }

No stage may pass full OCR dumps or raw document content outside the Context Pack.

---

## Multimodal Attachment Contract (Required)

For multimodal prompt execution (`modelType = multimodal`):

- Attach **PNG file paths** (`__image_path` / `__image_paths`) as the primary
  transport contract between runtime context and prompt-test execution.
- `__image_paths` must cover the full normalized page set for the document when
  `VIS_OCR_V1` or multimodal extraction runs (no single-page truncation).
- Convert PNG files to base64 only at the final Ollama API call boundary.
- Inline base64 fields (`__image_data`, `image_data`, `document_image_b64`) are
  compatibility fallback only.
- If an explicit PNG path attachment is provided but unreadable, fail with
  `VISUAL_ATTACHMENT_FAILED` (no silent text fallback).
- If no image attachment exists for multimodal execution, fail with
  `VISUAL_INPUT_MISSING`.

---

## Guidance Output Contracts (Required)

Guidance outputs are split into three focused calls. Each output must include
`evidence_refs[]` pointing to `page_id+bbox`, `chunk_id`, or `ocr_offset`.

1) **Classification + Tagging**
```json
{
  "doc_type": "string",
  "tags": ["string"],
  "entities": [{"name": "string", "value": "string"}],
  "confidence": 0.0,
  "rationale": "string",
  "evidence_refs": ["page:1:box:...", "chunk:uuid"]
}
```

2) **Field Extraction**
```json
{
  "fields": [
    {
      "name": "string",
      "value": "string",
      "confidence": 0.0,
      "evidence_ref": "page:1:box:..."
    }
  ]
}
```

3) **Autonomous Storage Plan**
```json
{
  "folder_path": "string",
  "filename": "string",
  "actions": ["tag", "move", "rename"],
  "confidence": 0.0,
  "safety_checks": ["allowed_path", "not_destructive"]
}
```

---

## Interaction Flow

The `ExpertPipelineExecutor` orchestrates this interaction inside
`_executeLLMStage`.

### Step 1: Guidance Eligibility Check

Guidance is attempted only if **all** of the following are true:

- `guidanceEnabled === true`
- `stage.guidanceTemplate` is defined
- `guidanceClient.isAvailable()` returns true

If any condition fails, Guidance is skipped.

---

### Step 2: Attempt Guidance Execution

If eligible:

- The executor calls `guidanceClient.generate()` with:
  - `guidanceTemplate`
  - resolved template variables
  - a **stable model identifier**
- Guidance executes via LiteLLM (provider abstraction)
- Output is validated server-side before return

**Success**
- Structured JSON output is returned directly

**Failure / Timeout**
- Error is logged
- Control immediately passes to the fallback path

---

### Step 3: PromptRegistry Fallback (Relaxed Mode)

If Guidance is skipped or fails, the executor resolves a `promptId`:

1. Uses `stage.promptId` if defined  
2. Otherwise resolves via  
   `getFallbackPromptId(stage.guidanceTemplate)` from `GuidanceClient.js`

The executor then:
- Retrieves the prompt from `PromptRegistry`
- Builds messages via `buildMessages()`
- Executes a standard `_callOllamaWithTimeout()`
- Applies `JsonRepairService` to guarantee valid JSON output

#### What “Relaxed” Means

- The **same promptId** is used
- No `_RELAXED` prompt variant exists
- No decoding parameters are changed
- The only difference is:
  - Guidance grammar/regex constraints are removed
  - Best-effort JSON is repaired via JsonRepair

This preserves semantic parity while removing strict constraints.

---

## Guidance Template → PromptRegistry Mapping

The `GuidanceClient.js` maintains the mapping
`TEMPLATE_TO_PROMPT_FALLBACK`.

This mapping is **authoritative** and must remain in sync with this table.

| Guidance Template | PromptRegistry ID | Description |
|------------------|------------------|------------|
| `medical_classifier` | `MED_RADIOLOGY_V1` | Medical imaging analysis |
| `medical_extractor` | `MED_DOCTOR_V1` | Clinical text extraction |
| `medical_integrator` | `MED_INTEGRATOR_V1` | Data integration |
| `medical_integrator_v2` | `MED_INTEGRATOR_V1` | Data integration (V2 Schema) |
| `financial_extractor` | `FIN_EXTRACT_V1` | Financial document data |
| `financial_extractor_v2` | `FIN_EXTRACT_V1` | Financial document data (V2 Schema) |
| `financial_reasoner` | `FIN_REASONER_V1` | Math & consistency checks |
| `financial_reasoner_v2` | `FIN_REASONER_V1` | Math & consistency checks (V2 Schema) |
| `vat_expert_analyzer` | `FIN_VAT_EXPERT_V1` | VAT compliance |
| `legal_classifier` | `LEGAL_ORCHESTRATOR_V1` | Legal routing & complexity |
| `legal_extractor` | `LEGAL_EXTRACTOR_V1` | Legal clause analysis |
| `legal_extractor_v2` | `LEGAL_EXTRACTOR_V1` | Legal clause analysis (V2 Schema) |
| `general_extractor` | `GEN_FALLBACK_V1` | Generic document analysis |
| `general_extractor_v2` | `GEN_FALLBACK_V1` | Generic document analysis (V2 Schema) |
| `cross_pipeline_router` | `SYS_ROUTER_V1` | System routing |
| `normalization_geometry` | `SYS_ROUTER_V1` | Pre-vision geometry analysis |

If a stage defines a `guidanceTemplate` but not a `promptId`,
the fallback MUST be resolved using this table.

---

## Provider Abstraction (LiteLLM)

The Guidance service uses **LiteLLM** as a provider abstraction layer.

### Required Guarantees

- Stable model identity must be preserved for caching
- Provider-specific identifiers must not break cache determinism
- Server-side timeouts must not exceed client timeouts
- Streaming outputs must be fully assembled and validated before return

---

## Summary of Responsibilities

- **PromptRegistry**
  - Defines prompts, models, parameters, and schemas
  - Is always authoritative

- **Guidance Service**
  - Implements constrained generation via templates
  - Provides optimization and caching
  - Never owns business logic

- **ExpertPipelineExecutor**
  - Decides execution path
  - Enforces fallback
  - Guarantees robustness

---

## Non-Negotiable Guarantees

- PromptRegistry remains authoritative
- Guidance is optional and replaceable
- Fallback is mandatory and deterministic
- JsonRepair guarantees valid JSON in fallback path
- No pipeline stage may depend exclusively on Guidance
