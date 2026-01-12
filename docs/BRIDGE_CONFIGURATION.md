# CODEX-Serena Bridge Configuration (codex-bridge)

This document provides a concise configuration guide for the CODEX → Serena bridge (codex-bridge.py). It covers environment variables, sample CODEX JSON launch configuration, logging and debugging guidance, and common deployment scenarios.

## Key Environment Variables (bridge)

- `SERENA_BASE` — Base URL for Serena HTTP endpoints (default: `http://127.0.0.1:9121`).
- `SERENA_SSE_URL` — SSE endpoint (default: `${SERENA_BASE}/sse`).
- `SERENA_API_KEY` — (optional) API key for Serena requests; if required, set this to authenticate API calls.
- `PROJECT_DIR` — Project root (used for default log path; default: repository root).
- `CODEX_BRIDGE_LOG_FILE` — File to write bridge logs to (default: `${PROJECT_DIR}/bridge_debug.log`).
- `LOG_LEVEL` — Logging level for the bridge (`DEBUG|INFO|WARN|ERROR`, default: `INFO`).
- `SSE_TIMEOUT` — Timeout in seconds for SSE operations (default: `30`).
- `REQUEST_TIMEOUT` — Timeout in seconds for per-request operations forwarded to Serena (default: `60`).
- `MAX_RECONNECT_ATTEMPTS` — Maximum number of reconnects before entering degraded mode (default: `10`).
- `RECONNECT_BACKOFF_BASE` — Base backoff in seconds (default: `2`).
- `RECONNECT_BACKOFF_MAX` — Max backoff in seconds (default: `30`).
- `HEALTH_CHECK_INTERVAL` — Interval in seconds between SSE health checks (default: `15`).

## Examples

### Local development (bash)

```bash
export SERENA_BASE=http://127.0.0.1:9121
export SERENA_SSE_URL=${SERENA_BASE}/sse
export REQUEST_TIMEOUT=60
export LOG_LEVEL=DEBUG
python codex-bridge.py
```

### Docker / docker-compose snippet (docker-compose.env)

```bash
# Bridge configuration
SERENA_BASE=http://serena:9121
SERENA_SSE_URL=${SERENA_BASE}/sse
SERENA_API_KEY=your-api-key-here
REQUEST_TIMEOUT=60
SSE_TIMEOUT=30
MAX_RECONNECT_ATTEMPTS=10
RECONNECT_BACKOFF_BASE=2
RECONNECT_BACKOFF_MAX=30
CODEX_BRIDGE_LOG_FILE=/var/log/codex_bridge.log
LOG_LEVEL=INFO
```

### Remote Serena (production)

- Ensure `SERENA_BASE` is set to the reachable address (use internal network hostnames within the Docker network or private IPs).
- Use secrets to store `SERENA_API_KEY` (do not commit API keys to the repo).

## CODEX JSON configuration example

Below is an example `code.json` snippet to spawn the bridge process from CODEX/host tooling (adjust `cmd` to your environment):

```json
{
  "name": "codex-bridge",
  "cmd": ["python", "codex-bridge.py"],
  "env": {
    "SERENA_BASE": "http://127.0.0.1:9121",
    "REQUEST_TIMEOUT": "60",
    "LOG_LEVEL": "INFO",
    "SERENA_API_KEY": "${SERENA_API_KEY:-}"
  },
  "logs": {
    "file": "./bridge_debug.log"
  }
}
```

## Logging & Debugging

- By default, logs are written to both stderr and the configured `CODEX_BRIDGE_LOG_FILE`.
- For debugging connectivity issues, set `LOG_LEVEL=DEBUG` and inspect the log for:
  - `Connecting to Serena SSE (attempt N)` – SSE connect attempts
  - `SSE connection error:` – connection-level errors and reasons
  - `Timeout forwarding <method>` – request timeouts
  - `Retry attempt X for id=...` – retry activity

## Security

- Store `SERENA_API_KEY` as a secret in your orchestration platform (Docker secrets, Kubernetes secrets, or GitHub Secrets for CI). Avoid using plain environment variables in production where possible.

## Tips

- Increase `REQUEST_TIMEOUT` when using long-running tools (e.g., heavy search or large document processing).
- Use `MAX_RECONNECT_ATTEMPTS=0` for permanently connected environments where you prefer indefinite reconnecting (but monitor resource usage).

For additional deployment examples and troubleshooting, see `docs/DEPLOYMENT_CHECKLIST.md` and `docs/TROUBLESHOOTING_BRIDGE.md`.
