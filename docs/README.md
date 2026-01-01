 
# paperless-ai Documentation

This directory contains the **authoritative documentation** for the paperless-ai
Expert Pipeline.

All runtime behavior, retries, fallbacks, and architectural guarantees are
defined here. GitHub Copilot and contributors MUST treat these documents as
source-of-truth.

---

## 🚨 Mandatory Reading Order (Authoritative)

1. **EXPERT_PIPELINE_DECISION_TABLE.md**  
   The single source of truth for:
   - pipeline stages
   - retry logic
   - OCR strategy
   - Guidance vs PromptRegistry behavior
   - Visual RAG usage
   - terminal states

2. **PROMPT_REGISTRY_GUIDANCE_INTERACTION.md**  
   Defines:
   - PromptRegistry authority
   - Guidance as an optimization layer
   - relaxed fallback semantics
   - JsonRepair guarantees

3. **PIPELINE_STAGE_CONTRACTS.md**  
   What each pipeline stage:
   - may do
   - must not do
   - is responsible for

---

## 🧭 Architecture & Governance

4. **ARCHITECTURE_OVERVIEW.md**  
   High-level system architecture, service boundaries, and responsibilities.

5. **VALIDATION_AND_RETRY_POLICY.md**  
   Validator output semantics, severity levels, retry behavior, and terminal
   outcomes.

6. **SCHEMA_EVOLUTION_GUIDE.md**  
   Rules for changing schemas (router output, validation output, overlays,
   pipeline results) safely and compatibly.

---

## 🧪 Operations & Quality

7. **OBSERVABILITY_AND_TELEMETRY.md**  
   Logging, telemetry events, debugging workflow, and production diagnostics.

8. **PROMPT_CHANGE_GUIDE.md**  
   Governance rules for modifying PromptRegistry prompts.

---

## ⚙️ Configuration Reference

9. **ENVIRONMENT_VARIABLES.md**  
   Reference list of environment variables.

   ⚠️ Note: This file does **not** define behavior.  
   Runtime behavior is defined exclusively in
   `EXPERT_PIPELINE_DECISION_TABLE.md`.

---

## 📦 Archived / Deprecated Documentation

Archived documents (if present under `docs/archive/`) are **not authoritative**
and must not be used to infer system behavior.

---

## Non-Negotiable Rule

If documentation and code ever disagree, **this directory wins**.
