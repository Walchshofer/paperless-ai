# Implement-Agent Handoff: Codex-Serena Bridge Gap Fixes

Timestamp: 2026-01-13T09:02:00

## Scope
- codex-serena-bridge.py
- bridge/
- docs/bridge/*
- tests under test/unit and test/integration as needed

## Ordered fixes (execute in this order)
1) Entrypoint + auth headers
- Ensure running python codex-serena-bridge.py starts the bridge loop.
- codex-serena-bridge.py currently defines async_main() but never executes it.
- bridge/codex-serena-bridge.py imports codex_serena_bridge (missing).
- SERENA_API_KEY is read but never passed to sse_client (auth not used).
- Targets:
  - codex-serena-bridge.py:636-648 (no __main__)
  - bridge/codex-serena-bridge.py:1-18 (bad import)
  - codex-serena-bridge.py:53, 281 (API key unused)

2) Ordered delivery implementation
- docs promise ordered delivery for pipelined requests (MIGRATION_V3_TO_V4).
- codex-serena-bridge.py currently delivers responses as they complete.
- bridge/orderer.py exists but unused.
- Align response ordering with docs/tests (see test/unit/test_pipelined_ordering.py
  and test/integration/test_ordered_delivery_and_timeouts.py).

3) Config alignment (LOG_FILE/REQUEST_TIMEOUT/RETRY_CONFIG/health check)
- LOG_FILE is documented but ignored in codex-serena-bridge.py; only
  CODEX_BRIDGE_LOG_FILE is read.
- REQUEST_TIMEOUT default is 30s in code vs 60s in docs.
- RETRY_CONFIG is defined but not used for retry/backoff.
- HEALTH_CHECK_INTERVAL is only used as a wait timeout; no health check.
- Targets:
  - codex-serena-bridge.py:58-78, 326, 397-405
  - docs/bridge/ENVIRONMENT_VARIABLES.md:24-62

## Evidence files
- Gap report: docs/bridge/debug/codex-serena-bridge-gap-report_20260113_073324.md
- Docs: docs/bridge/*

## Acceptance criteria
- Entrypoint runs and passes basic integration tests.
- Serena API key is applied to SSE connections when provided.
- Responses are delivered in request order under pipelined concurrency.
- Config defaults and behavior match docs or docs are updated with docs-agent.
- Tests updated/added for ordered delivery and config behaviors.
- Python changes comply with 79-char limit and Pylance typing.
