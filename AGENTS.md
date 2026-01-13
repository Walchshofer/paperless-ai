# Agent Instructions for paperless-ai

## Doc-first guardrails
- Read and follow `docs/EXPERT_PIPELINE_DECISION_TABLE.md` and 
  `docs/QDRANT_MIGRATION.md` before any changes.
- Authoritative docs (must follow):
  - `docs/EXPERT_PIPELINE_DECISION_TABLE.md`
  - `docs/QDRANT_MIGRATION.md` (Hybrid SOT Authority)
  - `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` (Hardware Authority)
  - `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`
  - `docs/PIPELINE_STAGE_CONTRACTS.md`
  - `docs/VALIDATION_AND_RETRY_POLICY.md`
- If guidance conflicts with these docs, the docs win.
- Ignore `docs/archive/` as non-authoritative.

## Architecture and Scope (Alpha-9)
- **Hybrid SOT:** PostgreSQL is for metadata/RLHF only; Qdrant is the sole 
  Vector Source of Truth.
- **Distance Metric Lock:** `visual_pages` must use **Dot Product** for 
  ColQwen3 MaxSim compatibility.
- **Hardware Profile:** Optimized for RTX 3090 Ti (Ampere SM86). Respect 
  the ~3.5GB VRAM sidecar baseline.
- **Detox Rule:** Python code MUST adhere to **79-character** Flake8 limits 
  and strict Pylance typing.

## Quality Gates
- Add Mocha + Node assert (JS) or PyTest (Python) for new behavior.
- **Payload Mirroring:** Any metadata change in Postgres must be mirrored 
  to Qdrant payloads for "Expert Filtering".
- Provide a checklist mapping changes back to `docs/EXPERT_PIPELINE_DECISION_TABLE.md`.

## Multi-container Runtime
- **Compose Root:** `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml`.
- **Core Services:** paperless-ai (Node), visual-rag sidecar (Python), 
  Qdrant (Vector DB), postgres (Metadata DB), redis (Broker).
- **Sidecar Handshake:** Implement 5s timeouts and handle `503 Initializing` 
  states via the "GPU Preparing" UI fallback.
- **Ollama:** Connects to host via `http://host.docker.internal:11434`.

## Tooling & Memory
- **Memory:** Use `oraios/serena` tools for all agent handoffs.
- **Serena Bridge:** CODEX uses `codex-serena-bridge.py` for async Serena access.
  Use Serena tools normally; the bridge is transparent to agents.
- **Bridge Logs:** Debug output is written to `bridge_debug.log`.
- **Entrypoint:** `server.js` (Node/Express).
- **Tests:** `npm test`, `npm run test:integration` (sidecar-enabled).
