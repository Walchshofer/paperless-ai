# Troubleshooting — CODEX-Serena Bridge

This troubleshooting guide lists common failure modes, log messages, and recommended actions.

## Common issues

### 1) Bridge cannot connect to Serena (SSE)

Symptom:
- Logs show repeated `Connecting to Serena SSE (attempt N)` followed by `SSE connection error: <reason>`.

Likely causes & fixes:
- Network/hostname misconfiguration: Ensure `SERENA_SSE_URL` and `SERENA_BASE` are correct and reachable from the bridge host.
- Authentication failure: If Serena requires an API key, confirm `SERENA_API_KEY` is set and valid.
- SSL/TLS issues: When using HTTPS endpoints, ensure certificates are trusted or provide CA bundle in the environment.

Check:
- `curl -v $SERENA_BASE/sse` or `curl -v $SERENA_BASE/health`
- Bridge log entries around connection attempts.

### 2) Timeouts forwarding requests

Symptom:
- `Timeout forwarding <method> (id=<id>)` and requests return JSON-RPC error `-32603`.

Likely causes & fixes:
- Tool backend is slow or overloaded: increase `REQUEST_TIMEOUT`.
- Network issues: verify connectivity and latency.
- Tool-specific delays: for tools with heavy workloads (e.g., large code search), set specialized timeouts at call-site.

### 3) Retries exhaust and permanent errors

Symptom:
- `Retry attempt N for id=...` followed by `Bridge timeout` or permanent error message.

Diagnosis:
- Inspect the exception type. `asyncio.TimeoutError` and HTTP 503/429 are retried; `PermanentError` or HTTP 400 are treated as permanent.
- Check `RETRY_CONFIG` environment variables if you need to tune max attempts.

### 4) Responses delivered out-of-order or missing

Symptom:
- CODEX receives responses with unexpected order or does not receive responses when a previous request times out.

Likely causes & fixes:
- Verify the bridge's `PendingRequest` bookkeeping. Ensure each request has a unique `id` and that CODEX writes full JSON-RPC objects.
- Increase `REQUEST_TIMEOUT` to give slow tools time to return.
- For debugging, set `LOG_LEVEL=DEBUG` and follow `match_response` and `deliver_responses` logs.

## Log interpretation quick guide

- `Connecting to Serena SSE (attempt N)` — connector starting a new SSE connection.
- `Serena session ready` — session initialized and tools fetched.
- `Fetched N tools: <names>` — tools list has been cached.
- `Error forwarding <method>: <exc>` — a forward failed and triggered a reconnect or an error response.
- `Timeout forwarding <method>` — per-request timeout occurred.
- `Retry attempt N for id=...: <msg>` — a transient error triggered a retry attempt.

## Debugging checklist

1. Confirm `SERENA_BASE` and `SERENA_SSE_URL` settings.
2. Confirm `SERENA_API_KEY` if required.
3. Set `LOG_LEVEL=DEBUG` on the bridge, restart, and reproduce the issue.
4. Inspect logs and search for `SSE connection error`, `Timeout forwarding`, or `Retry attempt` messages.
5. If SSE connects but tools don't arrive, check Serena's `/tools` endpoint and network logs.

## When to escalate

- If logs show non-transient exceptions or repeated authentication failures, open an incident and include log excerpts (`CODEX_BRIDGE_LOG_FILE`).
- For persistent performance issues, consider profiling the tool backend or increasing resource allocations.

For additional context, see `docs/BRIDGE_CONFIGURATION.md` and `docs/DEPLOYMENT_CHECKLIST.md`.
