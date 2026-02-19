This **GEMINI.md** file serves as the definitive project intelligence for the Gemini CLI when operating within the `paperless-ai` repository. It synthesizes the authoritative guardrails, architecture, and institutional memory required for expert-level autonomous development.

---

# GEMINI.md: Project Intelligence for paperless-ai

## 1. System Overview

`paperless-ai` is a high-performance document processing pipeline optimized for production excellence. It leverages a Mixture of Experts (MoE) orchestration model to integrate LLM reasoning (Guidance, LiteLLM) with advanced visual analysis (Ollama Vision, ColQwen3) and robust vector storage.

## 2. Authoritative Documentation (Guardrails)

Every action must strictly adhere to these documents. If a conflict arises between code behavior and these docs, the documentation is the source of truth:

* **`docs/EXPERT_PIPELINE_DECISION_TABLE.md`**: The master contract for pipeline stages, gates, and retry logic.
* **`docs/QDRANT_MIGRATION.md`**: Authority on the Vector Source of Truth and hybrid storage rules.
* **`docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md`**: Hardware-specific authority for VRAM management and GPU profiles.
* **`docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`**: Implementation guide for logit bias and prompt orchestration.
* **`docs/VALIDATION_AND_RETRY_POLICY.md`**: Rules for deterministic, document-scoped retries.

## 3. Architecture & Technical Profile

* **Hybrid SOT**: PostgreSQL is utilized for metadata and RLHF/metadata persistence. **Qdrant** is the sole Vector Source of Truth.
* **Vector Spec**: The `visual_pages` collection MUST use **Dot Product** distance metrics for ColQwen3 MaxSim compatibility.
* **Hardware Profile**: Optimized for **RTX 3090 Ti** (Ampere SM86). The visual-rag sidecar respects a ~3.5GB VRAM baseline.
* **Language Standards**:
  * **JavaScript (Node.js)**: Uses Express; entrypoint is `server.js`. Testing via Mocha and Node built-in `assert`.
  * **Python**: Must adhere to **79-character** Flake8 limits and strict Pylance typing.

## 4. Tooling & Memory (MCP Integration)

The Gemini CLI uses these primary tools for all orchestration:

* **`oraios-serena`**: The primary memory engine for agent handoffs. Use the `run-active` (current objective/risks) and `handoff-next` (next concrete steps) memories for every task.
* **`context7`**: Used for resolving library documentation and API reference points.
* **`sequential-thinking`**: Engaged for multi-step reasoning and planning phases.
* **`windows-mcp`**: Provides local system and file-level integration.

## 5. Multi-container Runtime

* **Compose Root**: `C:\Users\pwalc\MyApps\paperless-ai\docker-compose.yml`.
* **Services**:
  * `paperless-ai` (Node/Express)
  * `visual-rag sidecar` (Python/GPU)
  * `Qdrant` (paperless_qdrant)
  * `Postgres` (Metadata DB)
  * `Redis` (Broker).

* **External Connections**: Ollama connects to the host via `http://host.docker.internal:11434`.

## 6. Quality Gates & Validation

* **Doc-First Rule**: Update authoritative documentation before implementing code changes that affect system behavior.
* **Testing Requirements**:
  * New behavior must be covered by `npm test` or `npm run test:integration`.

* **Payload Mirroring**: Any metadata change in Postgres MUST be mirrored to Qdrant payloads to ensure "Expert Filtering" remains accurate.

## 7. Institutional Memory & Known Risks

* **Environment SOT**: `docker-compose.env` at root is authoritative. Standard loader is `require("./config/config")`.
* **Docker Context Warning**: Manual Docker builds may inadvertently use the wrong `requirements.txt` if the build context is incorrect.
  * **Mitigation**: Add Dockerfile headers and use the project Makefile for all builds.

* **Sidecar Handshake**: Implement 5s timeouts for sidecar connections and handle `503 Initializing` states via the "GPU Preparing" UI fallback.

