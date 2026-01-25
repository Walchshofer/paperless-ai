# GitHub Copilot — Repository Instructions (Guardrails)

This repository follows a **doc-first, contract-driven** engineering approach. Prefer explicit, deterministic logic. Preserve pipeline precedence and fallback contracts. No silent fallbacks; always log reason codes. 

## Delegation and subagents

Use Copilot’s `/delegate <agent-name>` to hand tasks to the correct specialist agent. Start frontend/UI work with:

- `/delegate frontend-design-router`

The router delegates to exactly one of:
- `frontend-design-architect`
- `frontend-design-implementer`
- `frontend-design-auditor`

Cross-domain optimization and multi-agent orchestration:
- `/delegate optimize` (the Optimize orchestrator can infer and delegate to all agents)

## Serena operational workflow

Agents must use Serena to stay consistent and leave a reliable trail.

Required practices:
- At start: `get_current_config` and `activate_project` if needed.
- Maintain memories:
  - `run-active`: current plan, progress, and touched files
  - `handoff-next`: next steps and open risks
- Use `switch_modes` to mark phase transitions (plan → implement → verify).
- Use `summarize_changes` before concluding a phase or handing off.

## Authoritative standards (apply by file type)

Follow the standards files for any changes you make:

- General guardrails and testing conventions: `coding-standards.md` 
- Pipeline invariants and vector-store SOT: `pipeline-contract.md` 
- Documentation: `docs.instructions.md` 
- JavaScript: `javascript.instructions.md` 
- Python: `python.instructions.md` 
- Routes and OpenAPI docs: `routes.instructions.md` 
- Services layer: `services.instructions.md` 
- Tests: `test.instructions.md` 

## Frontend guardrails (Paperless-AI)

- EJS templates must only reference `vm.*` fields validated by a Zod contract (`src/ui/contracts/*.contract.ts`).
- Every page root must include `data-page="page-name"`.
- Every interactive element must include a stable `data-testid="kebab-case"`.
- Preact islands must mount via `data-island` anchors and a registry-based runtime (`src/islands/runtime.ts`).

## UI testing expectation

Frontend runtime behavior should be covered by automated tests:
- Prefer Mocha + Node `assert` for the test runner (repo standard). 
- Use Playwright for browser runtime checks where appropriate (UI smoke, island mount, `data-testid` interactions).
