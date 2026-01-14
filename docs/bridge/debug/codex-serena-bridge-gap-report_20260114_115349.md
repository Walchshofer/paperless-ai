# Codex-Serena-Bridge Gap Report

Timestamp: 2026-01-14T11:53:49

## Scope
- docs/bridge/*
- bridge/codex_serena_bridge.py
- bridge/router.py
- bridge/state.py
- test/unit/test_router_response_tracking.py

## Findings
### Gap 1: No response-flow logging for CODEX->Serena->CODEX
- Doc source: docs/bridge/PERFORMANCE_TUNING.md (Observability)
- Code source: bridge/router.py:212-274 (added response tracking)
- Expected behavior: ability to trace request/response lifecycle for
  debugging and observability of tool calls.
- Actual behavior: prior to this change, router forwarded without emitting
  per-request response logs, making lost responses indistinguishable.
- Impact: response-loss issues could not be localized.
- Recommendation: add request/response flow logs and response size metrics.

### Gap 2: Server task can exit before pending responses drain
- Doc source: docs/bridge/MIGRATION_V3_TO_V4.md (pipelined concurrency and
  ordered delivery)
- Code source: bridge/codex_serena_bridge.py:392-435 (drain wait added)
- Expected behavior: in-flight responses should be allowed to complete before
  shutdown to preserve ordering guarantees.
- Actual behavior: server task exit could occur while responses were still
  pending.
- Impact: CODEX sees "Serena unavailable" and misses responses.
- Recommendation: track pending responses and wait briefly before exit.

## Summary
- Highest-risk gap: response flow logging missing during response loss.
- Quick wins: add response tracking and drain pending responses on exit.

## Compliance checklist
- [ ] Debug-agent checklist followed
- [ ] Serena memory updated (run-active/handoff-next)
- [ ] Evidence includes file paths and line numbers
- [ ] Report saved to docs/bridge/debug
