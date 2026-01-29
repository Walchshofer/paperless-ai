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
- **Monitor system health** (Paperless-ngx API, SQLite, AI Providers)

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

**Location:** `containers/guidance-service/`

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

**Location:** `containers/visual-rag/`

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

### 5) text-rag service (Python)

**Location:** `containers/text-rag/`

**Role:** Text semantic search and document retrieval

Responsibilities:
- Index document text with multilingual embeddings (384-dim)
- Provide semantic search via Qdrant `document_embeddings` collection
- Support BM25 + semantic hybrid search
- Expose `/search`, `/context`, `/health` endpoints
- Maintain compatibility with paraphrase-multilingual-MiniLM-L12-v2 model

Guarantees:
- Text-only retrieval (no visual processing)
- Best-effort enrichment; pipeline can operate without it
- Fallback option when visual-rag is unavailable

Does NOT:
- Process images or visual content (use visual-rag for that)
- Perform constrained generation (use guidance-service)
- Replace visual retrieval (complementary service)

---

## Health & Monitoring

The system implements real-time health monitoring for critical dependencies, exposed via the Dashboard and specialized API endpoints.

- **Paperless-ngx**: Verified via active API ping (`/api/documents/`) and document count validation.
- **Local Database**: Verified via SQLite `SELECT` query on the `processed_documents` table.
- **AI Services**: Verified via configuration state and provider-specific connectivity checks.
- **Observability**: Metrics are aggregated across services and visualized in the dashboard with automated empty-state handling for stale data.

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

$1

### User Isolation & Security

The system enforces strict user isolation for document history and processing metadata.

- **History Isolation**: Users can only view history records they own (`username = ?`). The legacy behavior of showing unassigned (`NULL`) records to everyone has been removed.
- **Attribution**: All document processing actions (scans, webhooks, re-analysis) must be explicitly attributed to a user or the `system` account.
- **Legacy Data**: A startup migration automatically assigns legacy unassigned records to the configured admin user ('elfman') to ensure data retention without compromising isolation.

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
