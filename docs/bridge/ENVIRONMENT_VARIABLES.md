# Bridge Environment Variables

This reference documents environment variables used by the CODEX↔Serena bridge (`codex-serena-bridge.py`) and recommended defaults.

> Note: Many of these variables are already referenced in `docs/ENVIRONMENT_VARIABLES.md`. This page gathers bridge-specific variables with explicit defaults, examples and deployment guidance.

## Core variables

- SERENA_BASE
  - Default: `http://127.0.0.1:9121`
  - Description: Base URL for Serena; used to construct SSE and REST endpoints.
  - Example (local): `export SERENA_BASE=http://127.0.0.1:9121`

- SERENA_SSE_URL
  - Default: `#{SERENA_BASE}/sse` (constructed if unset)
  - Description: SSE endpoint to connect to Serena.
  - Example: `export SERENA_SSE_URL=http://serena.example:9121/sse`

- SERENA_API_KEY
  - Default: (empty)
  - Description: API key used to authenticate with Serena (if required by deployment)
  - Example: `export SERENA_API_KEY=secret-token`

- LOG_FILE
  - Default: `./bridge_debug.log` (project dir)
  - Description: File path used for bridge logs.
  - Example: `export LOG_FILE=/var/log/codex-serena-bridge.log`

- LOG_LEVEL
  - Default: `INFO`
  - Values: `DEBUG`, `INFO`, `WARN`, `ERROR`

## Timeouts & Retry configuration

- SSE_TIMEOUT
  - Default: `30` (seconds)
  - Description: Low-level SSE connect/read timeout

- REQUEST_TIMEOUT
  - Default: `60` (seconds)
  - Description: Default timeout for tool calls (override per-tool in CODEX if needed)

- MAX_RECONNECT_ATTEMPTS
  - Default: `10`
  - Description: Number of reconnect attempts before the bridge enters degraded mode.

- RECONNECT_BACKOFF_BASE
  - Default: `2` (seconds)
  - Description: Initial reconnect backoff multiplier (exponential backoff applied)

- RECONNECT_BACKOFF_MAX
  - Default: `30` (seconds)
  - Description: Maximum backoff between reconnect attempts

- HEALTH_CHECK_INTERVAL
  - Default: `15` (seconds)
  - Description: Interval used to check the session health while connected

- RETRY_CONFIG (structured default)
  - max_attempts: `3`
  - backoff_base: `1`
  - backoff_max: `4`

## Testing & CI gating

- SERENA_E2E
  - Default: unset
  - Description: Set to `true` in CI to enable Serena E2E tests

- For CI: provide `SERENA_BASE` and optionally `SERENA_API_KEY` as secrets.

## Examples

- Local (development):

```bash
export SERENA_BASE=http://127.0.0.1:9121
export LOG_LEVEL=DEBUG
export REQUEST_TIMEOUT=60
```

- Docker Compose snippet (example):

```yaml
services:
  codex-serena-bridge:
    image: ghcr.io/yourorg/codex-serena-bridge:latest
    environment:
      - SERENA_BASE=http://serena:9121
      - SERENA_API_KEY=${SERENA_API_KEY}
      - LOG_LEVEL=INFO
    volumes:
      - ./bridge_debug.log:/var/log/codex-serena-bridge.log
```

## Notes

- Prefer specifying `SERENA_BASE` and let the bridge derive `SERENA_SSE_URL`.
- Tune `REQUEST_TIMEOUT` for long-running tools (code search, indexing tasks) and adjust `RETRY_CONFIG` conservatively for transient errors.
