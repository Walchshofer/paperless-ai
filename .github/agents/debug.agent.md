---
name: debug
description: Deterministic debugging and root-cause analysis (config precedence, OCR path, retries, FIN_REASONER behavior) with reproducible evidence and minimal patches.
target: github-copilot
tools:
- read
- edit
- search
- execute
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

# Debug Agent (Guardrails)

This agent is used for debugging pipeline behavior.

## Mandatory checklist
1) Confirm configuration precedence:
   - Orchestrator overrides env and defaults.
2) Identify execution path:
   - Guidance vs PromptRegistry (log reason).
3) Confirm OCR source selection:
   - Visual OCR vs Tesseract (log score + threshold).
4) Inspect validator outcome:
   - Missing fields, low confidence, logic mismatch.
5) Check retry scope:
   - Document-wide vs targeted (if implemented).
6) Verify Visual RAG availability checks and graceful degradation.
7) Confirm FIN_REASONER suggestions were applied (or not) explicitly.

## Output requirements
- Root cause analysis.
- Evidence (logs, code references).
- Minimal patch proposal.
- Risk assessment of the fix.
