# Agent Read Policy

This repository uses *disciplined, minimal, and repeatable* documentation reads. The goal is to keep agents accurate without repeatedly loading the entire docs corpus.

## Tier 0 — Always read first (mandatory)

Read **only what you need**, but for any non-trivial work you must start with these:

1. `docs/EXPERT_PIPELINE_DECISION_TABLE.md` — pipeline gates, retries, contracts.
2. `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` — PromptRegistry authority, Guidance optimization, fallback mapping.
3. `.github/architecture/coding-standards.md` — code style, logging, error handling.
4. `.github/architecture/pipeline-contract.md` — pipeline contract invariants.
5. `.github/architecture/service-boundaries.md` — service responsibilities and boundaries.

**Rule:** If a proposed change conflicts with Tier 0, Tier 0 wins.

## Tier 1 — Read when relevant (situational)

Read these *only when the task touches their scope*:

- `docs/PIPELINE_STAGE_CONTRACTS.md` (stage I/O contract changes)
- `docs/VALIDATION_AND_RETRY_POLICY.md` (retry / validation behavior changes)
- `docs/SCHEMA_EVOLUTION_GUIDE.md` (schema changes / migrations)
- `docs/OBSERVABILITY_AND_TELEMETRY.md` (telemetry/logging changes)
- `docs/ENVIRONMENT_VARIABLES.md` (env/config changes)
- `docs/TEST_ENVIRONMENT.md` (test harness changes)
- Any domain-specific docs under `docs/` that match the component being edited

## Tier 2 — Reference only (rare)

Read these only if you are actively working in that subsystem or need precise wording:

- `docs/DATABASE_SETUP.md`
- `docs/FRONTEND_ARCHITECTURE.md`
- `docs/RAG_SYSTEMS_REFERENCE.md`
- `docs/VISUAL_RAG_INTEGRATION.md`
- Historical/archived material under `docs/archive/` is **non-authoritative**

## Serena memory rule (prevents “doc re-reads”)

Use Serena memories as the canonical handoff mechanism so downstream agents do not re-open the same documents.

At the start of a task:
1. `get_current_config` (confirm active project and enabled tools)
2. `read_memory("run-active")` and `read_memory("handoff-next")`

After each phase:
- `write_memory("run-active", ...)` with your progress envelope
- `write_memory("handoff-next", ...)` with next-agent instructions

If a Tier-1/Tier-2 doc was consulted, record that in `run-active` under `context_you_read`.

## Quick decision checklist

Before you read more docs, decide:

1. **Does this change behavior at runtime?**  
   - Yes → Tier 0 + relevant Tier 1 (usually retry, contracts, telemetry)
2. **Is this only a refactor/no behavior change?**  
   - Tier 0 + local code context is usually sufficient
3. **Is this prompt/template work?**  
   - Tier 0 + `docs/PROMPT_CHANGE_GUIDE.md` (Tier 1) + prompt registry file(s)

