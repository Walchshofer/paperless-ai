# GitHub Copilot — Repository Instructions (Guardrails)

This repository uses Disciplined Guardrail-Based Development.

---
## Decision Matrix — Documentation Loading Strategy

| Option | Safety / Guardrails | Token Efficiency | Agent Focus | Multi-Agent Scalability | Verdict |
|------|----------------------|------------------|-------------|-------------------------|---------|
| Force-read all docs every task | High | Very Low | Poor | Poor | ❌ |
| Minimal docs only | Medium | High | High | Medium | ❌ |
| Tiered + Serena memory caching | **High** | **High** | **High** | **High** | ✅ **Selected** |

**Selected strategy:** Tiered authoritative documentation with Serena memory caching.

---
## 0) Golden Rule: Doc-first (Tiered)

### Tier 0 — Always Read (Hard Gate)
Copilot MUST read and comply with these documents before proposing or implementing changes:

0. `docs/AGENT_READ_POLICY.md` (Master Policy)
1. `docs/EXPERT_PIPELINE_DECISION_TABLE.md`
2. `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`
3. `.github/architecture/coding-standards.md`
4. `.github/architecture/pipeline-contract.md`
5. `.github/architecture/service-boundaries.md`
6. `docs/QDRANT_MIGRATION.md` (Hybrid SOT Authority)

If implementation changes affect runtime behavior, update these docs first, then implement.

---
## 0.1) Tier 1 — Authoritative, Read-On-Demand

The following documents are authoritative **when relevant to the task scope**.  
Copilot MUST read them *only if the task touches the corresponding concern*.

- `docs/README.md`
- `docs/PIPELINE_STAGE_CONTRACTS.md`
- `docs/VALIDATION_AND_RETRY_POLICY.md`
- `docs/SCHEMA_EVOLUTION_GUIDE.md`
- `docs/PROMPT_CHANGE_GUIDE.md`
- `docs/ARCHITECTURE_OVERVIEW.md`
- `docs/OBSERVABILITY_AND_TELEMETRY.md`
- `docs/ENVIRONMENT_VARIABLES.md`
- `docs/DATABASE_SETUP.md`
- `docs/EXPERT_PIPELINE_FLOW.md`
- `docs/FEEDBACK_PERSISTENCE_STRATEGY.md`
- `docs/FRONTEND_ARCHITECTURE.md`
- `docs/jsdoc_standards.md`
- `docs/RAG_SYSTEMS_REFERENCE.md`
- `docs/TEST_ENVIRONMENT.md`
- `docs/VISUAL_RAG_INTEGRATION.md`
- `docs/USING_OPTIMIZE_CHATMODE_EFFECTIVELY.md`
- `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md`
- `docs/MULTI_AGENT_WORKFLOW_AND_MEMORY_MODEL.md`

**Rule:** Do NOT read Tier 1 docs unless the task requires them.

Archived files under `docs/archive/` are non-authoritative and must be ignored.

---
## 0.2) Serena Memory Substitution Rule (Anti-Toxicity)

To avoid repeated document reads in multi-agent workflows:

1. If a doc has already been read during the current run:
   - Write a concise summary to Serena memory (`run-active` or `decisions`).
2. Subsequent agents MUST:
   - Read the Serena memory summary instead of re-reading the document.
3. Re-reading a document is allowed only if:
   - The scope materially changes, or
   - The memory summary is insufficient.

---
## 0.3) Serena MCP Is the Primary Code Intelligence Layer

This repo is developed with Serena MCP available globally in VS Code.

Rules:
1. Prefer Serena symbol-aware tools over raw text edits.
2. At task start:
   - Call `get_current_config`.
   - Verify the active project.
3. For multi-step work:
   - Read `run-active` memory at start.
   - Write progress before handoff.

**Safety default:** `execute_shell_command` remains disabled unless explicitly enabled by the user.

---
## 0.4) Paperless MCP Servers

Paperless MCP servers are optional and must not be assumed available.
Agents must justify usage and provide a fallback plan.

---
## 1) Architecture Rules (Non-Negotiable)
- `.github/architecture/pipeline-contract.md`
- `.github/architecture/service-boundaries.md`
- `.github/architecture/coding-standards.md`

---
## 2) Scope Rules

### Allowed
- paperless-ai orchestration, retries, telemetry.
- Guidance plumbing (LiteLLM).
- OCR logic compliant with decision tables.
- PromptRegistry templates under safety rules.

### Not Allowed Without Explicit Instruction
- Changing precedence ordering.
- Bypassing PromptRegistry.
- Altering fallback semantics.

---
## 3) Prompt Safety Rules
- **Registry Authority:** All prompts must reside in `prompts/` or the `PromptRegistry`. Do not hardcode prompts in source files.
- **Schema Compliance:** Edits to prompts must preserve the JSON output schema expected by the parser.
- **Review:** Any change to a prompt requires a corresponding update to `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` if the contract changes.

---
## 4) Quality Gates
- **Python:**
  - Line length: **79 characters** (Flake8 standard).
  - Typing: Strict Pylance/MyPy compliance.
  - No `print()` statements in production code; use `logging`.
- **JavaScript/TypeScript:**
  - Strict typing for Zod contracts.
  - JSDoc required for all public methods.
- **Database:**
  - **Detox Rule:** No `vector` or `embedding` columns in PostgreSQL tables.
  - Migrations must be idempotent.
- **Testing:**
  - New features must include unit tests.
  - Integration tests required for cross-service logic (e.g., Node -> Sidecar).

---
## 5) Required Output Format
- **File Paths:** Use full absolute paths (e.g., `c:\Users\pwalc\MyApps\paperless-ai\...`).
- **Diffs:** Use unified diff format for code changes.
- **Brevity:** Do not explain standard code patterns; focus on the *why* of architectural decisions.

---
## 6) Custom Agents
This repository uses specific agent personas for tasks:
- **@optimize:** Orchestrator (MoE). Manages handoffs and high-level planning.
- **@docs:** Documentation authority. Enforces the "Doc-First" rule.
- **@schema-evolution:** Database and Qdrant migration specialist.
- **@implement:** Production code generator. Enforces coding standards.
- **@test:** Test generation and validation specialist.

---
## 7) Instructions Files
Hierarchy of instruction files:
1. `.github/copilot-instructions.md` (Global Guardrails - **This File**)
2. `AGENTS.md` (Agent-specific operational guides)
3. `prompts/README.md` (Prompt engineering standards)
4. `docs/AGENT_READ_POLICY.md` (Documentation access policy)

---
## 8) Docker Build Safety
- **Context:** Builds often require the parent directory context.
- **Secrets:** Never hardcode secrets in `Dockerfile` or `docker-compose.yml`. Use `docker-compose.env`.
- **Images:** Pin versions for production images (e.g., `postgres:16`, `qdrant/qdrant:v1.13.0`).
