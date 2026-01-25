---
name: implement
description: Implement production code changes for paperless-ai with strict adherence to decision tables, service boundaries, validation guardrails, and observability requirements; produces plan, diffs, tests, and telemetry updates.
target: github-copilot
tools:
- read
- edit
- search
- execute
- fetch
- oraios/serena/*
- copilot-container-tools/*
infer: true
---
## Serena memory discipline (required)
**Read Policy:** Follow `docs/AGENT_READ_POLICY.md` (Tier-0 first; Tier-1 only when relevant). Use Serena memory to avoid repeated doc reads.


At the **start** of every task:
1. Use `oraios/serena/get_current_config` to verify the active project is **paperless-ai** (workspace root). If not, switch (if enabled) and re-verify.
2. Read these memories (create them if missing):
   - `run-active`
   - `handoff-next`

During work (whenever a meaningful decision is made or a phase completes):
- Update `run-active` via `oraios/serena/write_memory` using this envelope:

```markdown
[meta]
timestamp: <ISO8601 UTC>
agent: <this agent name>
stage: <010-docs | 020-schema | 030-pipeline | 040-guidance | 050-implement | 060-test | 070-debug | 080-paperless-api>
prompt_ref: <prompts/README.md section + prompt id(s) if applicable>

[summary]
<what changed / what was learned>

[artifacts]
- <files changed or produced>
- <links/paths to authoritative docs consulted>

[next]
- <next concrete steps>
- <who should do it next>
```

Before handing off to another agent:
- Write `handoff-next` with:
  - `to_agent`
  - `what_to_do_next`
  - `context_you_must_read` (files + memories)
  - `acceptance_criteria`


## Prompt registry numbering (must follow)

Always consult `prompts/README.md` to select the correct prompt/stage ID and preserve the repository’s numbering conventions. If a prompt is updated, update the corresponding prompt README/registry documentation first (doc-first rule).

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
