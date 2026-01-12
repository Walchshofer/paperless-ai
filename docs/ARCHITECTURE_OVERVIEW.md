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

### 3) visual-rag service (Metadata, PostgreSQL)

**Role:** Metadata and overlay management (SQL source-of-truth for overlay metadata and feedback events)

Responsibilities:
- Store overlay metadata and application-level signals in PostgreSQL
- Maintain relational metadata only (no vector columns in PostgreSQL)
- Persist RLHF / feedback events and relational metadata (SOT for relational state)

Guarantees:
- ACID for metadata and feedback
- Durable audit trails

Does NOT:
- Perform live MaxSim retrieval
- Host vector search SOT (Qdrant is the vector SOT)
- Perform heavy tensor operations

### 4) visual-rag sidecar (Python — Native Protocol Alpha-9)

**Role:** Native visual retrieval and indexing (ColQwen3 + Qdrant)

Responsibilities:
- Host a native ColQwen3 4B-AWQ embedding bridge (320-dim outputs) optimized for **RTX 3090 Ti / Ampere SM86**
- Compute multi-vector page embeddings and provide native MaxSim (late-interaction) retrieval via PyTorch (`processor.score_multi_vector`)
- Index and synchronize vectors to **Qdrant** as the SOT for vector retrieval
- Serve low-latency search endpoints and health metrics (e.g., `/health` and search `/search`)

Guarantees:
- High-fidelity visual retrieval using late-interaction MaxSim scoring
- Best-effort enrichment; pipeline can fallback to Text RAG if sidecar is unavailable

Does NOT:
- Replace PostgreSQL as SOT for relational metadata
- Perform OCR or structured extraction (use Visual OCR / Guidance services instead)

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

### Storage Pattern (Dual-DB)

- **PostgreSQL**: Source-of-truth (SOT) for relational metadata and RLHF / `feedback_events` (ACID guarantees)
- **Qdrant**: SOT for vector retrieval (text & visual) — high-performance nearest-neighbor search and vector storage
- **Payload Mirroring**: Mirror `doc_id`, `correspondent_id`, and `tag_ids` into Qdrant payloads for expert filtering (see `rag_service/qdrant_adapter.py`).

---

## Data & Control Flow (High Level)

1. Document arrives in paperless-ai
2. Expert Pipeline executes sequential stages
3. Guidance is attempted when eligible
4. PromptRegistry fallback is used if Guidance fails
5. Visual OCR is compared with Tesseract OCR
6. Validator-driven retries are applied if required
7. Visual RAG Gate: The Visual RAG Sidecar performs native MaxSim retrieval (ColQwen3, 320-dim multi-vector) against Qdrant, assembles visual hits + metadata into a Context Pack, and hands results to Guidance for reasoning; if the sidecar is initializing or returns `503 Initializing`, the pipeline will fallback to Text RAG.
8. Final result is patched to Paperless-ngx

---

## Non-Negotiable Rule

No service may assume responsibilities outside those defined here.
