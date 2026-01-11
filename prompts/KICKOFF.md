# Paperless-AI Implementation Kickoff Prompt

> **Orchestrator Agent:** `@optimize` (coordinates all subagents)
> **MCP Required:** `oraios-serena` (memory tools)
> **Execution Model:** Multi-agent with Serena memory handoffs

---

## Expert Agent Reference

| Agent | Stage | Invoke As | Responsibility |
|-------|-------|-----------|----------------|
| **Optimize** | 000 | `@optimize` | MoE orchestrator - coordinates all subagents |
| **Docs** | 010 | `@docs` | Documentation updates (doc-first rule) |
| **Schema Evolution** | 020 | `@schema-evolution` | Database migrations, schema changes |
| **Pipeline Orchestration** | 030 | `@pipeline-orchestration` | Pipeline flow, LLM chains, retries |
| **Guidance Expert** | 040 | `@guidance-expert` | Guidance/LiteLLM, logit bias integration |
| **Implement** | 050 | `@implement` | Production code changes |
| **Test** | 060 | `@test` | Unit/integration tests (Mocha + Node assert) |
| **Debug** | 070 | `@debug` | Root cause analysis, minimal patches |
| **Paperless API Expert** | 080 | `@paperless-api-expert` | Paperless-ngx API integration |

**Canonical Order:** optimize → docs → schema-evolution → pipeline-orchestration → guidance-expert → implement → test → debug → paperless-api-expert

---

## Quick Start (Full Orchestration)

Copy this to start a fully orchestrated run with all agents:

```
@optimize Execute the paperless-ai prompt sequence starting from Phase 5 (Qdrant Migration).

Serena initialization:
1. Call `oraios/serena/get_current_config` - verify active project is paperless-ai
2. Read memories: `run-active`, `handoff-next`
3. Read `prompts/EXECUTION_ORDER.md` for dependency graph

For each prompt, delegate to the appropriate expert agent:
- Schema/migration prompts → @schema-evolution
- Documentation updates → @docs
- Code implementation → @implement
- Verification prompts → @test
- Failures/issues → @debug

Use Serena memory for state persistence and agent handoffs.
```

---

## Quick Start (Single Agent - Implementation Only)

For direct implementation without orchestration:

```
@implement Execute the paperless-ai prompt sequence starting from Phase 5 (Qdrant Migration).

Before starting:
1. Call `oraios/serena/get_current_config` to verify active project is paperless-ai
2. Read memories: `run-active`, `handoff-next`
3. Read `prompts/EXECUTION_ORDER.md` for dependency graph
4. Read `prompts/README.md` for current status

Execute prompts in order per EXECUTION_ORDER.md, using Serena memory for state persistence between phases.
```

---

## Full Kickoff Prompt (Reusable)

```markdown
# Paperless-AI Full Implementation Run

## 1. Serena Initialization (REQUIRED)

Before ANY work, execute these steps:

### Step 1: Verify Project Context
```
oraios/serena/get_current_config
```
Confirm active project is `paperless-ai` (workspace root: `C:\Users\pwalc\MyApps\paperless-ai`).

### Step 2: Read Current State
```
oraios/serena/read_memory name="run-active"
oraios/serena/read_memory name="handoff-next"
```
If memories don't exist, create them with initial state.

### Step 3: Initialize Run (if fresh start)
```
oraios/serena/write_memory name="run-active" content="[meta]
timestamp: <ISO8601 UTC>
run_id: <generate UUID>
agent: implement
stage: 000-init
prompt_ref: prompts/KICKOFF.md

[summary]
Starting fresh implementation run for paperless-ai prompt sequence.

[artifacts]
- prompts/EXECUTION_ORDER.md (execution order)
- prompts/README.md (status tracker)
- docs/QDRANT_MIGRATION.md (breaking change context)

[next]
- Execute Phase 5: Qdrant Migration (prompt 018)
- Then proceed with Phases 1-4 as dependencies allow"
```

---

## 2. Tier-0 Documentation (MUST READ)

Before implementing, read these authoritative documents:

1. `docs/EXPERT_PIPELINE_DECISION_TABLE.md` - Pipeline gates, retries, contracts
2. `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` - PromptRegistry authority
3. `.github/architecture/coding-standards.md` - Code style
4. `.github/architecture/pipeline-contract.md` - Pipeline invariants
5. `.github/architecture/service-boundaries.md` - Service boundaries

**Rule:** If implementation conflicts with Tier-0, Tier-0 wins.

---

## 3. Prompt Execution Sequence

### Phase 5: Qdrant Migration (BREAKING CHANGE - Execute First)
| Prompt | Description | Agent | Status |
|--------|-------------|-------|--------|
| 018 | Qdrant Migration | @implement | Pending |

### Phase 1: Backend Foundation
| Prompt | Description | Agent | Depends On |
|--------|-------------|-------|------------|
| 001 | Feedback Persistence | @implement | 018 |
| 011 | Verify DB Schema | @test | 001 |
| 002 | Paperless Integration | @implement | 001 |
| 013 | Verify Telemetry | @test | 002 |

### Phase 2: Manual Route UI
| Prompt | Description | Agent | Depends On |
|--------|-------------|-------|------------|
| 003 | Visual Annotation UI | @implement | 002 |
| 004 | Manual Feedback UI | @implement | 003 |
| 015 | Feedback E2E Test | @test | 004 |

### Phase 3: History Route Enhancement
| Prompt | Description | Agent | Depends On |
|--------|-------------|-------|------------|
| 005 | Visual Sidecar | @implement | 018 |
| 006 | Visual Search API | @implement | 005 |
| 007 | Verify Visual Search API | @test | 006 |
| 014 | Verify Circuit Breaker | @test | 006 |
| 008 | History Split Layout | @implement | 007 |
| 012 | Verify Frontend Islands | @test | 008 |
| 009 | Visual Red Pen | @implement | 008 |
| 010 | Final Integration Test | @test | 009 |

### Phase 4: Final Verification & Cleanup
| Prompt | Description | Agent | Depends On |
|--------|-------------|-------|------------|
| 016 | Verification Checklist | @test | All above |
| 017 | Refactor Playground | @implement | Independent |

---

## 4. Per-Prompt Execution Protocol

For each prompt, follow this protocol:

### Before Starting Prompt
```
oraios/serena/write_memory name="run-active" content="[meta]
timestamp: <now>
agent: implement
stage: <stage number>
prompt_ref: prompts/<NNN>-<name>.md

[current_task]
Executing prompt <NNN>: <description>

[status]
in_progress"
```

### Read the Prompt
```
Read: prompts/<NNN>-<name>.md
```

### Execute Requirements
1. Follow `<requirements>` section exactly
2. Produce all files listed in `<output>` section
3. Run verification steps from `<verification>` section

### After Completing Prompt
```
oraios/serena/write_memory name="run-active" content="[meta]
timestamp: <now>
agent: implement
stage: <stage number>
prompt_ref: prompts/<NNN>-<name>.md

[summary]
Completed: <what was done>

[artifacts]
- <files created/modified>

[next]
- Proceed to prompt <next NNN>"
```

### Generate Summary (per lifecycle section)
Create: `prompts/summaries/<NNN>-<name>-summary.md`

### Update Handoff (before switching agents)
```
oraios/serena/write_memory name="handoff-next" content="to_agent: <next agent>
what_to_do_next: <specific instructions>
context_you_must_read:
  - memories: run-active
  - files: <relevant files>
acceptance_criteria:
  - <criterion 1>
  - <criterion 2>"
```

---

## 5. Checkpoint Verification

After completing each phase, verify the checkpoint:

### Checkpoint 5: Qdrant Migration (After 018)
- [ ] Qdrant container running
- [ ] Collections created with correct dimensions
- [ ] Adapters implemented and tested

### Checkpoint 1: Database & Telemetry (After 001, 011, 002, 013)
- [ ] feedback_events table exists
- [ ] Telemetry propagating correctly

### Checkpoint 2: Manual Feedback Loop (After 004, 015)
- [ ] Full E2E flow working

### Checkpoint 3: Visual Search Pipeline (After 006, 007, 014)
- [ ] Sidecar integration working
- [ ] Circuit breaker functional

### Checkpoint 4: History Route & Islands (After 008, 009, 012, 010)
- [ ] Split layout rendering
- [ ] Red Pen interaction working

---

## 6. Decisions Memory (Optional)

Record significant decisions for future reference:
```
oraios/serena/write_memory name="decisions" content="[decision]
timestamp: <now>
prompt: <NNN>
decision: <what was decided>
rationale: <why>
alternatives_considered:
  - <alt 1>
  - <alt 2>"
```

---

## 7. Run Log (Optional)

Append to run log for audit trail:
```
oraios/serena/write_memory name="run-log" content="<append>
[<timestamp>] [<agent>] [<prompt>] <action taken>"
```

---

## 8. Error Recovery

If a prompt fails:

1. Write failure to `run-active`:
```
oraios/serena/write_memory name="run-active" content="[meta]
...
[error]
prompt: <NNN>
error: <description>
recovery: <proposed fix>"
```

2. Consult `docs/AGENT_READ_POLICY.md` for relevant Tier-1 docs
3. Fix issue and retry prompt
4. If blocked, write handoff to `@debug` agent

---

## 9. Completion

After all prompts complete:

```
oraios/serena/write_memory name="run-active" content="[meta]
timestamp: <now>
agent: implement
stage: 999-complete
prompt_ref: prompts/KICKOFF.md

[summary]
All prompts completed successfully.

[artifacts]
- See prompts/summaries/ for per-prompt summaries
- See prompts/completed/ for archived prompts

[verification]
- All checkpoints passed
- All tests green"
```
```

---

## Agent Selection Guide

### By Task Type

| Task Type | Agent | Stage | When to Use |
|-----------|-------|-------|-------------|
| Full orchestration | `@optimize` | 000 | Coordinating multi-agent runs |
| Documentation | `@docs` | 010 | Updating docs, creating summaries |
| Schema/migrations | `@schema-evolution` | 020 | Database migrations, API contracts |
| Pipeline flow | `@pipeline-orchestration` | 030 | LLM chains, retries, OCR strategy |
| Guidance/LiteLLM | `@guidance-expert` | 040 | Logit bias, prompt templates |
| Code implementation | `@implement` | 050 | Writing/modifying production code |
| Testing | `@test` | 060 | Unit/integration tests, verification |
| Debugging | `@debug` | 070 | Root cause analysis, minimal patches |
| Paperless API | `@paperless-api-expert` | 080 | Paperless-ngx integration |

### Prompt-to-Agent Mapping

| Prompt | Primary Agent | Secondary Agent | Notes |
|--------|---------------|-----------------|-------|
| **018** Qdrant Migration | `@schema-evolution` | `@implement` | Schema + adapters |
| **001** Feedback Persistence | `@implement` | `@schema-evolution` | Code + migration |
| **002** Paperless Integration | `@implement` | `@paperless-api-expert` | API integration |
| **003** Visual Annotation UI | `@implement` | - | Frontend island |
| **004** Manual Feedback UI | `@implement` | - | Frontend island |
| **005** Visual Sidecar | `@implement` | `@pipeline-orchestration` | Python sidecar |
| **006** Visual Search API | `@implement` | - | API endpoint |
| **007** Verify Visual Search | `@test` | - | Contract tests |
| **008** History Split Layout | `@implement` | - | Frontend island |
| **009** Visual Red Pen | `@implement` | - | Canvas interaction |
| **010** Final Integration | `@test` | - | E2E tests |
| **011** Verify DB Schema | `@test` | `@schema-evolution` | Schema validation |
| **012** Verify Islands | `@test` | - | Frontend contracts |
| **013** Verify Telemetry | `@test` | - | Observability |
| **014** Verify Circuit Breaker | `@test` | `@pipeline-orchestration` | Resilience |
| **015** Feedback E2E | `@test` | - | Full flow test |
| **016** Verification Checklist | `@test` | - | CI gates |
| **017** Refactor Playground | `@implement` | - | Cleanup |

### Agent Handoff Examples

**Schema Evolution → Implement:**
```
@schema-evolution Create migration for Qdrant collections.

When complete, write handoff:
oraios/serena/write_memory name="handoff-next" content="to_agent: implement
what_to_do_next: Implement QdrantAdapter using the schema defined in migration
context_you_must_read:
  - memories: run-active
  - files: migrations/005_qdrant_collections.sql
acceptance_criteria:
  - QdrantAdapter.js implements all CRUD operations
  - Unit tests pass"
```

**Implement → Test:**
```
@implement Complete QdrantAdapter implementation.

When complete, write handoff:
oraios/serena/write_memory name="handoff-next" content="to_agent: test
what_to_do_next: Create integration tests for QdrantAdapter
context_you_must_read:
  - memories: run-active
  - files: services/visual-rag/QdrantAdapter.js
acceptance_criteria:
  - All CRUD operations tested
  - Error handling verified"
```

**Test → Debug (on failure):**
```
@test Run verification tests.

On failure, write handoff:
oraios/serena/write_memory name="handoff-next" content="to_agent: debug
what_to_do_next: Investigate test failure in QdrantAdapter.search()
context_you_must_read:
  - memories: run-active
  - files: test/integration/qdrant-adapter.spec.js
acceptance_criteria:
  - Root cause identified
  - Minimal patch proposed"
```

---

## Quick Reference: Serena Memory Commands

```bash
# Read memory
oraios/serena/read_memory name="<memory-name>"

# Write memory
oraios/serena/write_memory name="<memory-name>" content="<content>"

# Get current config
oraios/serena/get_current_config

# Canonical memory names
- run-active      # Current run state
- handoff-next    # Next agent instructions
- decisions       # Recorded decisions
- run-log         # Audit trail
```

---

## Direct Agent Invocation Examples

### Start Full Run with Orchestrator
```
@optimize

Read prompts/KICKOFF.md and execute the full prompt sequence for paperless-ai.

Initialize Serena memory, then delegate each prompt to the appropriate expert agent:
- 018 (Qdrant Migration) → @schema-evolution then @implement
- 001-006, 008-009, 017 → @implement
- 007, 010-016 → @test

Maintain state in run-active memory and write handoff-next before each agent switch.
```

### Execute Single Prompt with Specific Agent
```
@schema-evolution

Execute prompt 018 (Qdrant Migration) from prompts/018-qdrant-migration.md.

Serena init:
1. oraios/serena/get_current_config
2. oraios/serena/read_memory name="run-active"
3. oraios/serena/read_memory name="handoff-next"

Focus on schema/migration aspects:
- Qdrant collection definitions
- PostgreSQL migration to remove vector columns
- Backward compatibility plan

When schema work is complete, write handoff to @implement for adapter code.
```

### Run Verification Suite
```
@test

Execute verification prompts 007, 010-016 from the prompts directory.

Serena init:
1. oraios/serena/get_current_config
2. oraios/serena/read_memory name="run-active"

For each verification prompt:
1. Read the prompt requirements
2. Execute verification steps
3. Record results in run-active memory
4. If failures occur, write handoff to @debug

Generate summaries in prompts/summaries/ for each completed verification.
```

### Debug a Failure
```
@debug

Investigate the failure reported in run-active memory.

Serena init:
1. oraios/serena/get_current_config
2. oraios/serena/read_memory name="run-active"
3. oraios/serena/read_memory name="handoff-next"

Follow debug checklist:
1. Confirm configuration precedence
2. Identify execution path
3. Check logs and error traces
4. Propose minimal patch

When root cause is identified, write handoff back to @implement or @test.
```

### Update Documentation First (Doc-First Rule)
```
@docs

Update documentation for the Qdrant migration before implementation.

Serena init:
1. oraios/serena/get_current_config
2. oraios/serena/read_memory name="run-active"

Update these docs:
- docs/QDRANT_MIGRATION.md (already created)
- docs/RAG_SYSTEMS_REFERENCE.md (vector store architecture)
- docs/DATABASE_SETUP.md (new Qdrant setup instructions)

When docs are updated, write handoff to @schema-evolution for migrations.
```

---

## Breaking Change Notice

**Qdrant Migration (2026-01):** Prompt 018 must be executed BEFORE other prompts for new deployments. This migrates vector storage from pgVector to Qdrant. See `docs/QDRANT_MIGRATION.md`.
