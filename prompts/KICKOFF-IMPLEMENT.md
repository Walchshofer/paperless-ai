---
name: implementation-kickoff
stage: 050-implement
agent: implement
prompt_id: KICKOFF-IMPLEMENT
---

# Implementation Agent Kickoff — Paperless-AI

This file adapts the project kickoff for the *Implementation* agent.

Objective
- Implement tasks assigned by the Orchestrator and follow the Prompt
  Lifecycle for each prompt (docs → code → tests → summary → handoff).

Starter checklist
1. Read Tier-0 docs (obligatory):
   - `docs/AGENT_READ_POLICY.md`
   - `docs/EXPERT_PIPELINE_DECISION_TABLE.md`
   - `docs/QDRANT_MIGRATION.md`
   - `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md`
2. Read the prompt to implement: `prompts/002-enhance-paperless-integration.md`.
3. Implement required code changes (see Prompt 002 requirements):
   - `services/paperlessService.js` (normalize `custom_fields` and idempotent
     update pattern)
   - `routes/manual.js` (implement orchestrator route `POST /manual/updateDocument`)
   - Tests: `test/manual_orchestration.test.js` (unit and integration with
     mocks for Paperless-ngx and Qdrant)
4. Follow Detox standards (Python ≤ 79 chars, no vector columns in Postgres).
5. Create machine-readable summary: `prompts/summaries/002-paperless-integration-summary.md`.
6. Update memories when milestones are reached:
   - Write `run-active` memory when starting and when Prompt 002 is complete.
   - Write `handoff-next` to indicate the next agent and tasks to run.

Notes & Handoff
- On start: call `oraios/serena/get_current_config` and `oraios/serena/read_memory("run-active")` and `read_memory("handoff-next")` to verify context and avoid duplicate doc reads.
- At task start: **write** `run-active` memory with an envelope indicating you began implementation (see template below).
- On completion: create the machine-readable summary at `prompts/summaries/<prompt-id>-summary.md`, move prompt to `prompts/completed/` if applicable, and call `oraios/serena/write_memory` to:
  1) mark `run-active` with completion status and artifacts
  2) write `handoff-next` with the next agent, tasks, context files, and acceptance criteria
- Use `oraios/serena/write_memory` for all memory updates; do not modify memories directly via files.

Memory envelope template (use when writing `run-active`):

```markdown
[meta]
timestamp: <ISO8601 UTC>
agent: implement
stage: 050-implement
prompt_ref: prompts/<prompt-file>.md

[summary]
<one-line summary of what started/completed and key decisions>

[artifacts]
- <files changed or produced>
- <tests added>

[next]
- <next concrete steps and responsible agent>
```


Prefilled example (Prompt 003 - Visual Annotation UI)

```markdown
[meta]
timestamp: 2026-01-15T12:31:00Z
agent: implement
stage: 050-implement
prompt_ref: prompts/003-implement-visual-annotation-ui.md

[summary]
Starting Prompt 003: Implement VisualAnnotationIsland for Red Pen annotations.

[artifacts]
- files to create/modify:
  - `src/islands/VisualAnnotationIsland.tsx`
  - `src/ui/contracts/VisualAnnotation.contract.ts`
  - `views/manual.ejs` (mount island)
  - `src/islands/runtime.browser.tsx / src/islands/runtime.js` (register island)
  - tests: `test/unit/contracts.spec.ts`, Playwright E2E for island mount and payloads

[next]
- Implement island and contract; add unit and Playwright E2E tests; verify Zod schema and GPU handshake UX; on success write `prompts/summaries/003-visual-annotation-ui-summary.md` and call `oraios/serena/write_memory` to update `run-active` and `handoff-next`.
```

Acceptance criteria (summary)
- `POST /manual/updateDocument` updates Paperless-ngx, records a `feedback_events` row, and triggers an async Qdrant payload update when Tags or Correspondent changed.
- Create machine-readable summary file `prompts/summaries/<prompt-id>-summary.md` and write memories (`run-active`, `handoff-next`) via Serena tools.
- Unit and integration tests pass locally and on CI. Latency target: < 500ms for the orchestration loop under test conditions.
