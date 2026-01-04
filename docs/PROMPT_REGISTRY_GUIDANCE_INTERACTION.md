# Prompt Registry & Guidance Interaction

This document defines the authoritative relationship between the Node.js
`PromptRegistry` and the Python-based `Guidance` service.

It governs how LLM prompts are executed, constrained, retried, and recovered.

This document is authoritative and must remain consistent with:
- `docs/EXPERT_PIPELINE_DECISION_TABLE.md`

---

## Core Principles

### 1) PromptRegistry is the Authority

The `PromptRegistry` (in `services/prompts/PromptRegistry.js`) is the **single
source of truth** for:

- Prompt content (system + user messages)
- Prompt identifiers (`promptId`)
- Model selection
- Default decoding parameters
- Expected output schemas

It defines the **default behavior** for every pipeline stage.

All LLM-driven stages MUST ultimately be representable as a PromptRegistry
execution.

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
