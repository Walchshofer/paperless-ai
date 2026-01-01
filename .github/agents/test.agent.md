---
description: Generate or update tests focusing on retries, fallbacks, OCR selection, and cache behavior.
tools: ["codebase"]
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
