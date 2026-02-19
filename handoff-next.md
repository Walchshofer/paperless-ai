# Handoff: Environment SOT & Prompt Optimization Completed

## Accomplishments
- **SOT**: Standardized on `docker-compose.env` at root. Root `.env` and `data/runtime.env` are derived artifacts.
- **Unified Config**: Refactored `config/config.js` and multiple services to remove hardcoded env paths.
- **Tiered Context**: Implemented in `routes/api/prompts-runtime.js`. Router/Orchestrator are now 10x faster by using metadata-only context.
- **Streaming Fix**: Fixed ReferenceErrors and URL hyphenation issues in `GuidanceClient` and `routes/api/prompts.js`.
- **JSON Hardening**: Implemented multi-stage stripping for `<think>` tags in JS and Python (`guidance-service`).
- **Archive**: Legacy stack in `..\paperless-ngx\` moved to `.archive/paperless-ngx/`.

## What to do next
1. **Optimize Domain Prompts**: Use the Test Lab to optimize remaining specialized prompts (`FIN_EXTRACT_V1`, `MED_RADIOLOGY_V1`, etc.).
2. **Verify Tiered Fetching**: Ensure domain-specific prompts correctly trigger Tier 3 (Full Context) when needed.
3. **Nemotron Evaluation**: Re-enable `nemotron-orchestrator:8b` in `PromptRegistry.js` for `SYS_ORCHESTRATOR_V1` and verify performance with the new hardening settings.

## Context to Read
- `.gemini/GEMINI.md`: Authoritative architecture and guardrails.
- `AGENTS.md`: SOT rules and sync commands.
- `routes/api/prompts-runtime.js`: Implementation of Tiered Context.

## Acceptance Criteria
- All prompts pass validation (QS > 0.85).
- Neural simulations produce non-empty JSON results.
- No `data/.env` references remain in the codebase.
