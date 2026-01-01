# Coding Standards (Guardrails)

## General
- Prefer explicit, deterministic logic over cleverness.
- Avoid implicit behavior changes; if behavior changes, update docs first.
- Preserve pipeline precedence and fallback contracts.

## Node.js (paperless-ai)
- No silent fallbacks: log reason codes (`guidance_timeout`, `guidance_unavailable`, `validator_low_confidence`, etc.).
- All retries must be bounded; no infinite loops.
- Any new cross-service call must propagate `X-Request-Id`.

## Python (guidance-service)
- Provider abstraction must keep model identity stable for caching.
- Validate final JSON before returning for constrained templates.
- Avoid long-running requests after client timeout (server timeout <= client timeout - buffer).

## Prompt edits (PromptRegistry)
- PromptRegistry is authoritative; Guidance is optional optimization.
- Prompt edits must preserve output schema guarantees.
- Any prompt change must include a test update demonstrating the intended effect.

## Testing (Repo Standard)
### Framework & Tools
- Runner: Mocha
- Assertions: Node.js built-in `assert`
- Environment bootstrap: `test/setup-env.js`

### Directory layout
- `test/unit/`: isolated tests for utilities/helpers
- `test/integration/`: end-to-end pipeline coordination tests
- `test/services/`: service client tests (telemetry, rag, guidance)
- `test/fixtures/`: mock documents, JSON responses, base64 samples

### Conventions
- Test files end with `.test.js`
- Each test file begins with: `/* eslint-env mocha */`
- Prefer lightweight mock classes (e.g., `MockOllamaService`) over heavy mocking libraries.
- Increase timeouts explicitly (30s–60s) for AI-simulated flows when needed.

### Commands
- All tests: `npm test`
- Grep: `npm test -- --grep "Expert Pipeline"`
- Integration tests: `npm run test:integration`
