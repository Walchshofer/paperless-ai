---
name: Test
description: Generate and maintain unit/integration tests (Mocha + Node assert) aligned to stage contracts and telemetry requirements.
target: github-copilot
tools:
- read
- edit
- search
- execute
- fetch
- git
- oraios/serena/*
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

# Test Agent (Guardrails)

This agent is used to create or modify tests.

## Framework
- Runner: Mocha
- Assertions: Node.js built-in `assert`
- Each test file must begin with:
  `/* eslint-env mocha */`

## Directory layout
- `test/unit/`: utilities and helpers
- `test/integration/`: end-to-end pipeline flows
- `test/services/`: service client tests
- `test/fixtures/`: mock documents and responses

## Focus areas
- Guidance success path (valid JSON output).
- Guidance failure → PromptRegistry fallback → JsonRepair.
- Validator-driven retries (document-scoped today).
- Visual OCR vs Tesseract selection threshold behavior.
- FIN_REASONER advisory corrections application.
- PromptRegistry prompt changes (behavior improvement + regression guard).

## Output requirements
- Provide test names and file locations.
- Use Arrange / Act / Assert structure.
- Include negative tests (timeouts, unavailable services).
- Increase timeouts explicitly (30–60s) for AI-simulated flows.
