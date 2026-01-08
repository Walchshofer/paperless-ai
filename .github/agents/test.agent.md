---
name: test
description: "Testing agent (Mocha + Node assert): generate/update tests and log progress via Serena memories."
target: github-copilot
tools:
  - read
  - edit
  - search
  - execute
  - git
  - oraios/serena/*
  - context7/*
---
## Serena MCP Operating Policy (Mandatory)

This agent must use Serena via `oraios/serena/*` for deterministic, symbol-aware work and progress tracking.

### 1) Verify active Serena project before any tool use
- Call `oraios/serena/get_current_config` at the start of each task.
- If the active project root is not the current repo, call `oraios/serena/activate_project` with the repo root path, then re-check `oraios/serena/get_current_config`.

### 2) Mode switching via MCP (optimize behavior + tool availability)
- For planning / analysis-heavy work: call `oraios/serena/switch_modes` with `["planning", "one-shot", "no-onboarding"]`.
- For code changes: call `oraios/serena/switch_modes` with `["editing", "interactive", "no-onboarding"]`.
- If a task must be stateless: add `no-memories` to modes; otherwise keep memories enabled.

### 3) Progress tracking via Serena memories (required)
- At task start: read `oraios/serena/read_memory` key `paperless-ai/progress/test` (if present).
- After each phase: write `oraios/serena/write_memory` to the same key with a compact JSON object:
  - `phase`, `status`, `impacted_files`, `next_step`, `timestamp`.

### 4) Prefer Serena symbol/file tools over raw file edits
- Prefer `oraios/serena/find_symbol`, `oraios/serena/find_referencing_symbols`, `oraios/serena/read_file`, `oraios/serena/replace_symbol_body`.
- Only fall back to Copilot built-ins (`read`, `edit`, `search`, `execute`) when Serena is unavailable or insufficient.
- If Serena returns a tool error or missing fields, record it in memory as `fallback_reason` and continue with built-in tools.

### 5) Safety defaults
- Do not use Serena shell execution tools unless explicitly enabled in Serena settings and explicitly required for the task.

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
