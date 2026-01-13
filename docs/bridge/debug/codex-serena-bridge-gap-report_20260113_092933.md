# Codex-Serena-Bridge Gap Report

Timestamp: 2026-01-13T09:29:33

## Scope
- docs/bridge/*
- codex-serena-bridge.py
- bridge/
- mcp/
- mcp_local_stub/
- scripts/
- other touched files

## Findings
### Resolved 1: Entrypoint starts bridge loop
- Doc source:
  - docs/bridge/DEPLOYMENT_CHECKLIST.md:24
  - docs/bridge/CODEX_CONFIGURATION.md:11,49
- Code source:
  - codex-serena-bridge.py:807-824
  - bridge/codex-serena-bridge.py:10-34
- Expected behavior:
  - Running python codex-serena-bridge.py starts the bridge loop.
- Actual behavior:
  - codex-serena-bridge.py now defines main() and calls sync_main().
  - ridge/codex-serena-bridge.py now loads the root entrypoint.
- Impact:
  - Startup matches docs.
- Recommendation:
  - None.

### Resolved 2: SERENA_API_KEY applied to SSE connection
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:18-22
- Code source:
  - codex-serena-bridge.py:100-106
  - codex-serena-bridge.py:343-357
- Expected behavior:
  - API key is sent with the SSE connection when set.
- Actual behavior:
  - Headers are built via uild_sse_headers() and passed to sse_client().
- Impact:
  - Authenticated Serena deployments can connect.
- Recommendation:
  - None.

### Resolved 3: Ordered delivery enforced for pipelined requests
- Doc source:
  - docs/bridge/MIGRATION_V3_TO_V4.md:7
- Code source:
  - codex-serena-bridge.py:150-247
  - codex-serena-bridge.py:571-650
- Expected behavior:
  - Responses are delivered in request order.
- Actual behavior:
  - Sequence tracking + wait_turn() enforces ordered enqueueing.
- Impact:
  - JSON-RPC response order matches docs and tests.
- Recommendation:
  - None.

### Resolved 4: LOG_FILE honored and REQUEST_TIMEOUT default aligned
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:24-41
- Code source:
  - codex-serena-bridge.py:58-85
- Expected behavior:
  - LOG_FILE controls log path; REQUEST_TIMEOUT default is 60s.
- Actual behavior:
  - LOG_FILE used as fallback; REQUEST_TIMEOUT defaults to 60s.
- Impact:
  - Runtime config matches docs.
- Recommendation:
  - None.

### Resolved 5: RETRY_CONFIG used for request retries
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:59-62
- Code source:
  - codex-serena-bridge.py:87-106
  - codex-serena-bridge.py:507-538
- Expected behavior:
  - Retry/backoff uses RETRY_CONFIG values.
- Actual behavior:
  - RETRY_CONFIG parsed and applied in should_retry().
- Impact:
  - Retry tuning works as documented.
- Recommendation:
  - None.

### Resolved 6: Health check now runs while connected
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:55-57
- Code source:
  - codex-serena-bridge.py:271-290
  - codex-serena-bridge.py:400-431
- Expected behavior:
  - Interval used to validate session health while connected.
- Actual behavior:
  - check_session_health() runs on each interval and triggers reconnect.
- Impact:
  - Detects stalled sessions sooner.
- Recommendation:
  - None.

### Open 1: BRIDGE_TEST_STUBS guard behavior
- Doc source:
  - docs/bridge/TROUBLESHOOTING.md:65-66
- Code source:
  - mcp/__init__.py:15
  - mcp_local_stub/__init__.py:12-16
- Expected behavior:
  - Importing mcp without BRIDGE_TEST_STUBS=1 raises ImportError.
- Actual behavior:
  - Local stub packages are always importable (default BRIDGE_TEST_STUBS=1).
- Impact:
  - Production runs can silently use stubs instead of the real SDK.
- Recommendation:
  - Reinstate guard or update docs to match current behavior.

## Summary
- Highest-risk gap:
  - BRIDGE_TEST_STUBS guard mismatch remains open.
- Quick wins:
  - Align stub guard behavior or update troubleshooting docs.

## Compliance checklist
- [ ] Debug-agent checklist followed
- [ ] Serena memory updated (run-active/handoff-next)
- [ ] Evidence includes file paths and line numbers
- [ ] Report saved to docs/bridge/debug
