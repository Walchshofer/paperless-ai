---
name: test
description: 'Generate and maintain automated tests for Paperless-AI: backend unit/integration tests (Mocha + Node assert) and frontend runtime UI tests (Playwright) to validate that EJS, Vanilla JS components, and Preact Islands behave correctly in the browser.'
target: github-copilot
tools:
- read
- edit
- search
- execute
- oraios/serena/*
- copilot-container-tools/*
- microsoft/playwright-mcp/*
- pylance-mcp-server/*
infer: true
---
## Frontend runtime UI testing (Playwright + Mocha)

Repository test runner is Mocha with Node's built-in `assert`. 

When adding UI runtime coverage:
- Prefer writing Node-based Playwright tests that run under Mocha (e.g., `test/integration/ui/*.test.js`).
- Test contracts that matter at runtime:
  - Page root includes `data-page`
  - Interactive elements expose stable `data-testid`
  - Islands mount and become interactive (no console errors)
  - Key flows (chat send, doc select, overlay viewer) smoke-test via `data-testid`

Use Playwright MCP tools for:
- debugging failures interactively (screenshots, console logs, network inspection)
- generating selectors and confirming `data-testid` stability

Do not introduce a second test runner without explicit repo-level approval.



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
stage: <010-docs | 020-schema | 030-pipeline | 040-guidance | 050-implement | 060-test | 070-debug | 080-paperless-api | 090-frontend>
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
Always consult `prompts/README.md` to select the correct prompt/stage ID and preserve the repository’s numbering conventions.
If a prompt is updated, update the corresponding prompt README/registry documentation first (doc-first rule).

---

# Test Agent (Guardrails)

This agent creates or modifies tests. It supports the **frontend-design agent family** by producing
**Playwright runtime tests** that validate UI behavior (SSR + client logic + islands), and by keeping
backend Mocha tests aligned with pipeline contracts.

## Frameworks

### A) Backend tests
- Runner: Mocha
- Assertions: Node.js built-in `assert`
- Each test file must begin with:
  `/* eslint-env mocha */`

### B) Frontend runtime tests
- Runner: Playwright (prefer `@playwright/test` if present in repo)
- Assertions:
  - Prefer Playwright `expect` for UI assertions
  - Use `assert` for data-shape checks when useful
- Selectors:
  - Prefer `data-testid` locators (`getByTestId`, `[data-testid="..."]`)
  - Avoid brittle CSS selectors unless there is no stable identifier
- Accessibility:
  - Prefer role-based selectors as a secondary option (`getByRole`)
  - Ensure interactive UI is keyboard reachable where relevant

## Directory layout

### Backend
- `test/unit/`: utilities and helpers
- `test/integration/`: end-to-end pipeline flows
- `test/services/`: service client tests
- `test/fixtures/`: mock documents and responses

### Frontend (Playwright)
Use the repo’s existing convention if present. If none exists, default to:
- `tests/e2e/ui/`: Playwright UI specs
- `tests/e2e/utils/`: shared helpers (login, seed data, wait-for-islands)
- `tests/baselines/`: committed UI inventory baselines (if the auditor workflow is enabled)

## Frontend test focus (supports frontend agents)

### 1) Page boot correctness (SSR integrity)
For each major page (Chat, Dashboard, Settings, etc.):
- Assert the page root includes `data-page="<page>"`
- Assert critical regions render server-side (no blank shells)
- Verify Tailwind + custom CSS loaded (smoke check via computed styles or presence of known classes)

### 2) Element identity and stability
- Assert interactive elements exist and have stable `data-testid`
- Assert test IDs are unique on the page for the relevant feature area
- Prefer a helper that collects all `[data-testid]` and checks duplicates

### 3) Islands runtime correctness (Preact Islands)
For pages with islands:
- Verify island anchors exist: `[data-island="..."]`
- Verify runtime mounted:
  - wait for a known island-rendered element (by `data-testid`)
  - or assert an expected DOM transformation (anchor populated)
- Validate prop serialization:
  - ensure `data-props` parses as JSON
  - ensure required props exist (minimal shape checks)

### 4) Critical user flows
Write focused, high-value flows:
- Chat: send message, see response bubble container, citations render, thinking accordion toggles
- Visual tab: open viewer, image loads, overlay renders when boxes exist
- Document switching: select doc, context updates, no runtime errors

### 5) Runtime error surfacing
- Fail tests on console errors (unless explicitly allowlisted)
- Capture screenshots and trace artifacts on failure (Playwright config permitting)

## Infrastructure expectations (how to run)

If the repo already has Playwright configured, use it.
If not, add minimal configuration:
- `playwright.config.ts` with a baseURL
- Use env vars for port/baseURL; do not hardcode production URLs

When tests require a running server:
- Prefer starting the app in test mode via `execute_shell_command` / `execute`
- Wait for the health endpoint or for a known page to respond before running UI assertions

## Output requirements
For any work item:
- Provide test names and exact file locations.
- Use Arrange / Act / Assert structure.
- Include negative tests (timeouts, unavailable services) where meaningful.
- Increase timeouts explicitly (30–60s) for AI-simulated flows.
- For UI tests, always assert via `data-testid` when available.

## Collaboration with frontend agents
When a frontend agent adds new UI:
- Ensure they also add stable `data-testid` and `data-page`
- Create/extend Playwright specs to cover the new behavior
- If the change introduces a new island, add a mount verification test for it
