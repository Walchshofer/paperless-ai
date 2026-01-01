# Codex-Serena-Bridge Gap Report

Timestamp: 2026-01-13T07:33:24

## Scope
- docs/bridge/*
- codex-serena-bridge.py
- bridge/
- mcp/
- mcp_local_stub/
- scripts/
- other touched files

## Findings
### Gap 1: Documented entrypoint does not execute bridge logic
- Doc source:
  - docs/bridge/DEPLOYMENT_CHECKLIST.md:24
  - docs/bridge/CODEX_CONFIGURATION.md:11,49
- Code source:
  - codex-serena-bridge.py:636-648
  - bridge/codex-serena-bridge.py:1-18
  - rg "codex_serena_bridge" (only in bridge/codex-serena-bridge.py)
- Expected behavior:
  - Running python codex-serena-bridge.py starts the bridge loop.
- Actual behavior:
  - codex-serena-bridge.py ends after signal handler definitions and never
    invokes sync_main() or main().
  - The thin entrypoint under bridge/ imports codex_serena_bridge, which does
    not exist in the repo.
- Impact:
  - Deployment instructions can result in a no-op process or an ImportError,
    breaking startup as documented.
- Recommendation:
  - Add a __main__ entrypoint to codex-serena-bridge.py or adjust docs to
    reference the working entrypoint.

### Gap 2: SERENA_API_KEY never applied to SSE connection
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:18-22
- Code source:
  - codex-serena-bridge.py:53 (SERENA_API_KEY)
  - codex-serena-bridge.py:281 (sse_client without headers)
- Expected behavior:
  - API key is sent with the SSE connection (header or auth) when set.
- Actual behavior:
  - The bridge reads SERENA_API_KEY but never uses it in the SSE client call.
- Impact:
  - Authenticated Serena deployments will fail to connect.
- Recommendation:
  - Pass the API key to sse_client (e.g., headers) or update docs if auth is
    intentionally unsupported in this implementation.

### Gap 3: Ordered delivery promised, but responses are emitted by completion
- Doc source:
  - docs/bridge/MIGRATION_V3_TO_V4.md:7
- Code source:
  - codex-serena-bridge.py:457-471 (enqueue on completion)
  - codex-serena-bridge.py:595-603 (deliver FIFO by completion)
  - bridge/orderer.py:1-43 (unused ordering helper)
- Expected behavior:
  - Responses are delivered in request order even when completed out of order.
- Actual behavior:
  - Responses are queued and delivered as soon as orward_request completes.
- Impact:
  - Out-of-order JSON-RPC responses can break CODEX clients relying on order.
- Recommendation:
  - Wire an ordering mechanism (e.g., ResponseOrderer) or revise docs/tests.

### Gap 4: LOG_FILE env variable in docs is ignored by bridge
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:24-27
- Code source:
  - codex-serena-bridge.py:58-63
- Expected behavior:
  - LOG_FILE env var controls log output path.
- Actual behavior:
  - Only CODEX_BRIDGE_LOG_FILE is read; LOG_FILE is ignored.
- Impact:
  - Operators following docs cannot redirect logs as described.
- Recommendation:
  - Accept LOG_FILE as fallback or update docs to reflect CODEX_BRIDGE_LOG_FILE.

### Gap 5: REQUEST_TIMEOUT default is 30s, docs say 60s
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:39-41
- Code source:
  - codex-serena-bridge.py:64
- Expected behavior:
  - Default timeout is 60s.
- Actual behavior:
  - Default timeout is 30s.
- Impact:
  - Longer tool calls may time out unexpectedly in default config.
- Recommendation:
  - Align code default to docs or update docs to 30s.

### Gap 6: RETRY_CONFIG documented but not used for request retries
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:59-62
- Code source:
  - codex-serena-bridge.py:74-78 (RETRY_CONFIG defined)
  - codex-serena-bridge.py:397-405 (should_retry uses fixed max_attempts=3)
- Expected behavior:
  - Retry/backoff uses RETRY_CONFIG values.
- Actual behavior:
  - RETRY_CONFIG is never referenced; backoff uses 2**attempts.
- Impact:
  - Tuning retry behavior per docs has no effect.
- Recommendation:
  - Wire RETRY_CONFIG into retry logic or update docs.

### Gap 7: HEALTH_CHECK_INTERVAL does not perform a health check
- Doc source:
  - docs/bridge/ENVIRONMENT_VARIABLES.md:55-57
- Code source:
  - codex-serena-bridge.py:326
- Expected behavior:
  - Interval used to validate session health while connected.
- Actual behavior:
  - Interval is only used to periodically wait on shutdown; no health check.
- Impact:
  - Silent session failures may go undetected longer than expected.
- Recommendation:
  - Implement a lightweight health probe or adjust docs to reflect current
    behavior.

### Gap 8: Test stub guard does not enforce BRIDGE_TEST_STUBS
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
  - Production runs can silently use stubs instead of real MCP SDK.
- Recommendation:
  - Restore guard behavior or update docs to match always-on stubs.

## Summary
- Highest-risk gap:
  - Entrypoint mismatch and missing ordered delivery can break startup and
    JSON-RPC behavior in production.
- Quick wins:
  - Align LOG_FILE and REQUEST_TIMEOUT defaults with docs.
  - Wire SERENA_API_KEY into SSE headers.

## Compliance checklist
- [ ] Debug-agent checklist followed
- [ ] Serena memory updated (run-active/handoff-next)
- [ ] Evidence includes file paths and line numbers
- [ ] Report saved to docs/bridge/debug
