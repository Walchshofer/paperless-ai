# GitHub Copilot — Repository Instructions (Guardrails)

This repository uses Disciplined Guardrail-Based Development.

## 0) Golden Rule: Doc-first
1. Read and follow:
   - `docs/EXPERT_PIPELINE_DECISION_TABLE.md` (pipeline gates, retries, contracts).
   - `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` (PromptRegistry authority + Guidance optimization + fallback mapping).
2. If implementation changes affect runtime behavior, update docs first, then implement.

## 0.1) Authoritative Documentation (Must Read)

GitHub Copilot MUST treat the following files as authoritative:

1. `docs/README.md`
2. `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`
3. `docs/PIPELINE_STAGE_CONTRACTS.md`
4. `docs/VALIDATION_AND_RETRY_POLICY.md`
5. `docs/SCHEMA_EVOLUTION_GUIDE.md`
6. `docs/PROMPT_CHANGE_GUIDE.md`
7. `docs/ARCHITECTURE_OVERVIEW.md`
8. `docs/OBSERVABILITY_AND_TELEMETRY.md`
9. `docs/ENVIRONMENT_VARIABLES.md`
10. `docs/DATABASE_SETUP.md`
11. `docs/EXPERT_PIPELINE_FLOW.md`
12. `docs/FEEDBACK_PERSISTENCE_STRATEGY.md`
13. `docs/FRONTEND_ARCHITECTURE.md`
14. `docs/jsdoc_standards.md`
15. `docs/RAG_SYSTEMS_REFERENCE.md`
16. `docs/EXPERT_PIPELINE_DECISION_TABLE.md`
17. `docs/TEST_ENVIRONMENT.md`
18. `docs/VISUAL_RAG_INTEGRATION.md`

**If a suggestion conflicts with these documents, Copilot MUST:**
- Assume the suggestion is wrong
- Align with the documentation
- Ask for clarification if necessary

**Archived files under `docs/archive/` are non-authoritative and must be ignored.**

## 0.2) Serena MCP is the Primary Code Intelligence Layer

This repo is developed with Serena MCP available globally in VS Code.

**Rules for agents and Copilot:**
1. Prefer Serena tools for symbol-aware operations (e.g., find/refs/replace_symbol_body) over raw text edits.
2. At the start of a task, verify tool/project state:
   - Call Serena `get_current_config` to confirm the active project and enabled tools.
   - If the active project is not the current repo workspace, call `activate_project` and re-verify.
3. Use Serena memory for progress tracking when running multi-step work:
   - Read: `paperless-ai/progress/<agent>`
   - Write: `paperless-ai/progress/<agent>` after each phase

**Safety default:** `execute_shell_command` must remain disabled unless the user explicitly requests enabling it.

## 0.3) Paperless MCP Servers (paperless-ngx and paperless-ai)

This repo can optionally use:
- a Paperless-ngx MCP server (REST v9 wrapper)
- a paperless-ai MCP server (pipeline/webserver wrapper)

**Default posture:** these servers are *not* required for normal coding tasks and should not be assumed available.
If an agent needs them, it must:
- state why the MCP server is required, and
- provide a fallback plan using standard HTTP clients or mock/test doubles.

## 1) Architecture rules (non-negotiable)
Copilot must follow these guardrail docs before changing code:
- `.github/architecture/pipeline-contract.md`
- `.github/architecture/service-boundaries.md`
- `.github/architecture/coding-standards.md`

## 2) Scope rules (what Copilot may change)
### Allowed
- paperless-ai orchestration logic, retries, telemetry, header propagation.
- guidance-service provider plumbing (LiteLLM), caching namespace header support, request id propagation.
- Visual OCR/OCR selection logic only if compliant with the decision table.
- PromptRegistry prompt templates and configs (see Prompt Safety Rules below).

### Not allowed without explicit instruction
- Changing precedence ordering.
- Removing or bypassing PromptRegistry as the source of truth.
- Changing fallback mapping semantics (Guidance failure must still fall back to PromptRegistry + JsonRepair).

## 3) Prompt Safety Rules (PromptRegistry edits allowed with guardrails)
When modifying prompts in `services/prompts/PromptRegistry.js` or related templates:

1. Preserve the documented stage contracts:
   - Guidance is an optional optimization; PromptRegistry remains authoritative.
   - Fallback mapping must remain valid (Guidance template -> PromptRegistry promptId).

2. Do not weaken constraints that protect correctness:
   - Keep required schema fields and output format guarantees.
   - Maintain or strengthen instructions that enforce evidence-backed outputs.

3. Any prompt change must include:
   - A test update or new test that demonstrates improved behavior.
   - A note in PR description about intended behavior change and risk.

4. If prompt changes expand token usage, also add/adjust:
   - summarization/truncation guards
   - evidence budgeting where applicable

## 4) Quality gates
Every change must include:
- Unit tests (Mocha + Node assert) for new behavior.
- If behavior changes, add/update telemetry/logging (request-id, retry scope, fallback reason).
- A brief PR checklist mapping changes back to `docs/EXPERT_PIPELINE_DECISION_TABLE.md`.

## 5) Required output format
When implementing, Copilot must produce:
1) a short plan,
2) a file-by-file diff summary,
3) code changes,
4) tests,
5) a checklist mapping changes back to the decision table.

## 6) Custom Agents
Use the appropriate agent for specialized tasks (invoke via `@agent-name` in chat):

| Agent | Purpose |
|-------|---------|
| `@optimize` | MoE Orchestrator - Coordinates all agents for production excellence |
| `@docs` | Documentation updates (doc-first workflow) |
| `@implement` | Feature implementation with guardrails |
| `@test` | Test generation (Mocha + Node assert) |
| `@debug` | Root cause analysis and diagnostics |
| `@schema-evolution` | Schema changes with migration plans |
| `@pipeline-orchestration` | LLM chains, validation, OCR strategy |
| `@paperless-api-expert` | Paperless-ngx REST API v9 integration (guidance + patterns) |
| `@guidance-expert` | Guidance AI framework (gen, select, LiteLLM) |

Agent files are located in `.github/agents/`.

### MoE Orchestration Workflow
For comprehensive codebase optimization, use `@optimize` which sequences all agents:
```
@optimize → @docs → @schema-evolution → @pipeline-orchestration → @guidance-expert → @implement → @test → @debug → @paperless-api-expert
```
Each phase produces deliverables that feed into the next phase via handoffs.

## 7) Instructions Files
Pattern-based instructions in `.github/instructions/` are auto-applied based on `applyTo` glob patterns.

| File | Applies To | Purpose |
|------|-----------|---------|
| `javascript.instructions.md` | `**/*.js` | JS coding standards, logging, error handling |
| `test.instructions.md` | `test/**/*.js` | Mocha test patterns, AAA structure, mocking |
| `docs.instructions.md` | `docs/**/*.md` | Documentation standards, authoritative docs |
| `python.instructions.md` | `**/*.py` | Python standards for guidance/rag services |
| `services.instructions.md` | `services/**/*.js` | Service layer patterns, pipeline contracts |
| `routes.instructions.md` | `routes/**/*.js` | Express routes, Swagger/JSDoc standards |

Instructions are automatically included when editing matching files.

## 8) Docker Build Safety
- Critical: Dockerfiles in this repo depend on `requirements.txt` being present in the build context.
- Rule: Never run `docker build .` from the repo root for sub-services.
- Correct usage: Always set the build context to the service directory (e.g., `services/visual-rag-sidecar`) or use `docker-compose build` which is configured correctly.
