---
description: Implement features and refactors following the pipeline decision table and service boundaries.
tools: ["codebase"]
---

# Implement Agent (Guardrails)

This agent is used for writing or modifying production code.

## Mandatory steps
1) Read and follow:
   - `docs/EXPERT_PIPELINE_DECISION_TABLE.md`
   - `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`
2) Produce a short implementation plan before coding.
3) List impacted files and services.
4) Implement minimal, testable increments.
5) Add or update tests (Mocha + Node assert).
6) Update telemetry/logging if behavior changes.

## Non-negotiable constraints
- Do not change pipeline precedence:
  Orchestrator > Stage Options > Env Config > Defaults.
- Do not remove or bypass PromptRegistry authority.
- Guidance failure must always fall back to PromptRegistry + JsonRepair.
- Retries must remain deterministic and bounded.
- Visual OCR must remain direct Ollama execution (not Visual RAG).

## Required output
This agent must produce:
1) Implementation plan,
2) File-by-file diff summary,
3) Code changes,
4) Tests,
5) Checklist mapping changes to `docs/EXPERT_PIPELINE_DECISION_TABLE.md`.
