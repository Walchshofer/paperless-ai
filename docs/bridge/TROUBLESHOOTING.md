# Bridge Troubleshooting Guide

This guide lists common problems, their symptoms, and recommended actions.

## 1) SSE connection error / cannot connect

Symptoms:
- Logs: `SSE connection error: <description>`
- Bridge repeatedly attempts to connect and may enter degraded mode after
  `MAX_RECONNECT_ATTEMPTS`

Action:
- Verify `SERENA_BASE` and `SERENA_SSE_URL` are correct and reachable:
  - `curl -v $SERENA_SSE_URL` or `curl -v $SERENA_BASE/health`
- Check network/firewall settings and proxy configuration
- Increase `RECONNECT_BACKOFF_BASE` for transient network issues

## 2) "Serena unavailable" errors

Symptoms:
- Calls return JSON-RPC error with messages like:
  - `Serena unavailable - connection in progress (attempt N)`
  - `Serena unavailable after connection loss (10 retries exhausted)`

Action:
- Ensure the bridge has successfully connected (look for
  `Serena session ready` and `Fetched N tools` in logs)
- Verify Serena is reachable and authentication headers are correct

## 3) Tool call timeouts

Symptoms:
- Errors: `Bridge timeout after <Ns> waiting for Serena response to '<tool>'`

Action:
- Increase `REQUEST_TIMEOUT_*` values for long-running tools
- Validate the tool on the Serena side (implementation may be slow)

## 4) Max SSE retries exceeded / degraded mode

Symptoms:
- Bridge enters degraded mode after repeated failures. Look for logs like:
  - `Reconnect attempts exhausted, entering degraded mode`

Action:
- The bridge continues background retries while accepting requests (which
  return enriched errors). Check for sustained network outages or misconfigured
  `SERENA_BASE`.
- Review reconnect parameters: `MAX_RECONNECT_ATTEMPTS`,
  `RECONNECT_BACKOFF_BASE`, `RECONNECT_BACKOFF_MAX`
- Consider supervising the bridge with systemd/docker restart policies

## 5) JSON-RPC errors returned to CODEX

Symptoms:
- JSON-RPC response contains `error` property (e.g., permanent errors)

Action:
- Inspect `error.data.context` to see the bridge-provided context
- Determine if the error is permanent (bad request, 400) or transient (timeouts,
  503) and adjust retry strategy

## 6) Bridge stops immediately / STDIO closes

Symptoms:
- Logs show `Bridge stopped` within seconds of startup
- Log line: `Server task exited before shutdown; STDIO likely closed`
- Log line: `STDIN is closed; CODEX must keep STDIO open`

Action:
- Confirm CODEX keeps stdin open for the MCP stdio server
- Run the diagnostic helper:
  `python bridge/testscripts/test_stdin_lifecycle.py`
- Check `docs/bridge/debug/stdio_diagnostic_results.md` for scenario guidance
- Set `STDIO_INITIALIZE_GRACE_SECS=0.1` to tolerate startup races
- Set `STDIO_INITIALIZE_TIMEOUT_SECS=2` to require an initialize handshake

## Useful commands & log locations

- Tail logs: `tail -F $CODEX_BRIDGE_LOG_FILE` (if set) or stream the bridge process stderr via your supervisor/service manager.
- Run a quick local check with Mock Serena server in tests:
  - `pytest test/integration/test_connection_lifecycle.py -q`

## 7) Local MCP test stubs

- Primary stubs live in `test/fixtures/mcp_client_stubs.py`.
- Legacy stub packages were moved to `test/fixtures/mcp_stub/` to avoid
  shadowing the real `mcp` SDK at runtime.
- Tests use `BRIDGE_TEST_STUBS=1` to activate the fixture stubs.

## When to escalate

- If the bridge repeatedly enters degraded mode after configuration adjustments
  and Serena/networking are verified, collect logs and open an issue with a
  minimal reproduction case.
