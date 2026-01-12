---
name: verification-checklist
stage: 060-test
agent: test-agent
prompt_id: 016-native-alpha-9-master-checklist
---

# Master Verification Checklist — Native Protocol Alpha-9

<objective>
Consolidate all Alpha-9 verification gates into a single, CI-friendly checklist. 
Ensure deterministic pass/fail gating for Hybrid SOT synchronization, RTX 3090 Ti 
VRAM stability, MaxSim scoring, and the Islands architecture event bus.
</objective>

<context>
This is the final authoritative checklist for the paperless-ai production 
readiness. It coordinates the outputs of verification prompts 011 through 015.

**Hardware Profile:** RTX 3090 Ti (Ampere SM86).
**Core Protocol:** Unified Qdrant (320D) + Postgres (Relational Metadata).
</context>

<requirements>
1. **CI Infrastructure Requirements**:
   - `POSTGRES_URL`: Relational metadata store.
   - `QDRANT_URL`: Vector store (default `localhost:6333`).
   - `SIDECAR_URL`: ColQwen3-4B-AWQ instance (default `localhost:8001`).
   - `nvidia-smi` access (optional but recommended for VRAM monitoring).

2. **Phase 1: Fast Verification (Gated per Commit)**:
   - **Lint/Detox:** Python (Flake8 79-char) and Node.js strict typing.
   - **Schema Audit:** Confirm 0 vector columns in Postgres; correct 320D/384D 
     dimensions in Qdrant.
   - **Contract Validation:** Zod schemas for all Islands pass unit tests.

3. **Phase 2: Integration Verification (Gated per PR)**:
   - **Handshake Check:** Sidecar 503 Initializing -> Text-RAG Fallback.
   - **Distance Metric Lock:** `visual_pages` is Dot Product; others are Cosine.
   - **Payload Mirroring:** Postgres Correspondent/Tag updates sync to Qdrant within 2s.
   - **Telemetry:** `maxsim_score_mean` and `sidecar_vram_usage` exist in `/metrics`.

4. **Phase 3: E2E Acceptance (Gated per Release)**:
   - **Red Pen Flow:** UI Draw → Sidecar Search → MaxSim Result Rendering.
   - **RLHF Loop:** "Confirm Match" persists to `feedback_events` and Qdrant payloads.
</requirements>



<implementation>
- **Fast Job:** `.github/workflows/alpha9-fast-audit.yml` (Lint + Contracts).
- **Deep Job:** `.github/workflows/alpha9-e2e-stress.yml` (Playwright + Sidecar).
- **Scripts:** Utilize `scripts/verify-qdrant-alpha9.js` and 
  `scripts/alpha9-verify-all.sh`.
</implementation>

<output>
- `.github/workflows/alpha9-fast-audit.yml`
- `.github/workflows/alpha9-e2e-stress.yml`
- `prompts/summaries/016-master-checklist-summary.md`
</output>

<verification>
- **Run Audit:** `bash scripts/alpha9-verify-all.sh`.
- **Criteria:** All Tier-0 (Postgres/Qdrant) and Tier-1 (Sidecar/Orchestrator) 
  checks must return exit code 0.
- **VRAM Verification:** Confirm the test run does not exceed the 3.5GB 
  RTX 3090 Ti baseline.
</verification>

<lifecycle>
1. Any failure in this checklist blocks implementation of 005-010.
2. Update this list when adding new ColQwen3 visual fragments or collections.
3. Move to `prompts/completed/` once the Alpha-9 baseline is stabilized.
</lifecycle>