# Architecture Overview

This document describes the high-level architecture of the paperless-ai system,
its services, and their responsibilities.

It provides a **conceptual system view only**.
All runtime behavior, retries, and execution logic are defined in
`EXPERT_PIPELINE_DECISION_TABLE.md`.

---

## Core Services

### 1) paperless-ai (Node.js)

**Role:** Orchestration and business logic

Responsibilities:
- Execute the Expert Pipeline stages in order
- Enforce pipeline precedence and retry policy
- Manage ExecutionContext and stage outputs
- Invoke Guidance service when eligible
- Perform PromptRegistry fallback when required
- Select OCR source (Visual OCR vs Tesseract)
- Apply validator-driven retries
- Apply advisory corrections (e.g. FIN_REASONER)
- Interact with Visual RAG for enrichment
- Patch final results back to Paperless-ngx
- Emit logs, telemetry, and request tracing

Owns:
- Pipeline correctness
- Retry determinism
- Final authority over outputs

Does NOT:
- Enforce constrained generation
- Store embeddings
- Perform OCR inside the Visual RAG service

---

### 2) guidance-service (Python)

**Role:** Constrained LLM execution and caching

Responsibilities:
- Execute Guidance templates
- Enforce strict JSON / grammar constraints
- Validate outputs before returning
- Cache Guidance responses
- Abstract model providers via LiteLLM

Guarantees:
- Deterministic outputs for constrained templates
- No business logic
- No retries
- No fallback decisions

Does NOT:
- Orchestrate stages
- Decide whether Guidance is used
- Replace PromptRegistry
- Apply retries or escalation logic

---

### 3) visual-rag service (Python + PostgreSQL)

**Role:** Durable visual memory and retrieval

Responsibilities:
- Ingest images and derived visual overlays
- Compute and store embeddings
- Retrieve visual regions for evidence enrichment

Guarantees:
- Best-effort operation
- Optional enrichment only

Does NOT:
- Perform OCR
- Extract structured data
- Execute LLM reasoning
- Block the pipeline if unavailable

---

## Data & Control Flow (High Level)

1. Document arrives in paperless-ai
2. Expert Pipeline executes sequential stages
3. Guidance is attempted when eligible
4. PromptRegistry fallback is used if Guidance fails
5. Visual OCR is compared with Tesseract OCR
6. Validator-driven retries are applied if required
7. Visual RAG enrichment is fetched optionally
8. Final result is patched to Paperless-ngx

Failures are isolated per service and never cascade.

---

## Design Principles

- Orchestrator-first control
- Deterministic retries
- Explicit fallback paths
- Graceful degradation
- PromptRegistry as authoritative source
- Guidance as optional optimization
- Visual RAG as enrichment only

---

## Non-Negotiable Rule

No service may assume responsibilities outside those defined here.
