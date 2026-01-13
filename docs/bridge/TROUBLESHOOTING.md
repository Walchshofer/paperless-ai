# Bridge Troubleshooting Guide

This guide lists common problems, their symptoms, and recommended remediations.

## 1) SSE connection error / cannot connect

Symptoms:
- Logs: `SSE connection error: <description>`
- Bridge repeatedly attempts to connect and then enters degraded mode after `MAX_RECONNECT_ATTEMPTS`

Action:
- Verify `SERENA_BASE` and `SERENA_SSE_URL` are correct and reachable from the host:
  - `curl -v $SERENA_SSE_URL` or `curl -v $SERENA_BASE/health`
- Check network/firewall settings and proxy configuration
- Increase `RECONNECT_BACKOFF_BASE` for transient network issues

## 2) "Not connected to Serena" errors

Symptoms:
- Calls return JSON-RPC error {code -32603, message: "Not connected to Serena"}

Action:
- Ensure the bridge has successfully connected (look for `Serena session ready` and `Fetched N tools` in logs)
- Check the `state.session` and `state.connected` values if debugging interactively

## 3) Tool call timeouts

Symptoms:
- Errors: `Timeout waiting for Serena response` (enriched in the bridge logs)

Action:
- Increase `REQUEST_TIMEOUT` for long-running tool operations
- Validate the tool on Serena side (tool implementation may be slow)
- Inspect `mock_serena_server` in tests to reproduce slower responses

## 4) Max SSE retries exceeded / degraded mode

Symptoms:
- Bridge enters degraded mode after repeated failures. Look for logs like:
  - `Entering degraded mode after <N> failures. Continuing background retries.`

Action:
- The bridge no longer shuts down here; it will continue background retries while accepting requests (which will return enriched errors). Check for sustained network outage or misconfigured `SERENA_BASE`.
- Review reconnect parameters: `MAX_RECONNECT_ATTEMPTS`, `RECONNECT_BACKOFF_BASE`, `RECONNECT_BACKOFF_MAX`
- Consider supervising bridge with systemd/docker restart policy to restart after prolonged degraded mode

## 5) JSON-RPC errors returned to CODEX

Symptoms:
- JSON-RPC response contains `error` property (e.g., permanent errors)

Action:
- Inspect `error.data.context` to see the bridge-provided context (id, method)
- Determine if the error is permanent (bad request, 400) or transient (timeouts, 503) and adjust retry strategy

## Useful commands & log locations

- Tail logs: `tail -F /var/log/codex-serena-bridge.log` or `tail -F bridge_debug.log`
- Run a quick local check with Mock Serena server in tests:
  - `pytest test/integration/test_connection_lifecycle.py -q`

## 6) Local MCP test stubs

- Location: `mcp/` (lightweight test-only stubs) and `test/fixtures/mcp_client_stubs.py`
- Behavior: These stubs are provided for unit/integration tests only and are guarded by the `BRIDGE_TEST_STUBS` environment variable. Importing `mcp` without `BRIDGE_TEST_STUBS=1` will raise an ImportError to avoid accidentally shadowing the real `mcp` SDK in production.
- If you need to run tests that rely on the stubs, set `BRIDGE_TEST_STUBS=1` in your test environment.

## When to escalate

- If bridge repeatedly enters degraded mode after configuration adjustments, and Serena / networking are verified, collect logs and open an issue with the bridge log and a minimal reproduction case.
