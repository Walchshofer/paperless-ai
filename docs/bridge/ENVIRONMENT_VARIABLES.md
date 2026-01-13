# Bridge Environment Variables

This reference documents environment variables used by the CODEX-Serena
bridge (`bridge/codex-serena-bridge.py`) and recommended defaults.

> Note: Many of these variables are referenced in `docs/ENVIRONMENT_VARIABLES.md`.
> This page gathers bridge-specific variables with explicit defaults and
> deployment guidance.

## Core variables

- SERENA_BASE
  - Default: `http://127.0.0.1:9121`
  - Description: Base URL for Serena; used to construct SSE endpoints.
  - Example (local): `export SERENA_BASE=http://127.0.0.1:9121`

- SERENA_SSE_URL
  - Default: `${SERENA_BASE}/sse` (constructed if unset)
  - Description: SSE endpoint to connect to Serena.
  - Example: `export SERENA_SSE_URL=http://serena.example:9121/sse`

- SERENA_API_KEY
  - Default: (empty)
  - Description: API key used to authenticate with Serena. The bridge sends
    it as both `Authorization: Bearer` and `X-API-KEY` headers.
  - Example: `export SERENA_API_KEY=secret-token`

- CODEX_BRIDGE_LOG_FILE
  - Default: unset
  - Description: Preferred log file path for the bridge.

- LOG_FILE
  - Default: `./bridge_debug.log` (project dir)
  - Description: File path used for bridge logs when
    `CODEX_BRIDGE_LOG_FILE` is unset.
  - Example: `export LOG_FILE=/var/log/codex-serena-bridge.log`

- LOG_LEVEL
  - Default: `INFO`
  - Values: `DEBUG`, `INFO`, `WARN`, `ERROR`

## Timeouts & retry configuration

- SSE_TIMEOUT
  - Default: `30` (seconds)
  - Description: SSE connect timeout.

- SSE_READ_TIMEOUT
  - Default: `300` (seconds)
  - Description: SSE read timeout for idle connections.

- REQUEST_TIMEOUT_DEFAULT
  - Default: `60` (seconds)
  - Description: Default timeout for requests when no override exists.

- REQUEST_TIMEOUT
  - Default: `60` (seconds)
  - Description: Legacy alias for `REQUEST_TIMEOUT_DEFAULT`.

- REQUEST_TIMEOUT_LIST
  - Default: `30` (seconds)
  - Description: Timeout for list operations (`tools/list`, `resources/list`).

- REQUEST_TIMEOUT_READ
  - Default: `60` (seconds)
  - Description: Timeout for read operations (`resources/read`, `prompts/get`).

- REQUEST_TIMEOUT_INIT
  - Default: `10` (seconds)
  - Description: Timeout for MCP initialize.

- REQUEST_TIMEOUT_SEARCH
  - Default: `120` (seconds)
  - Description: Timeout for search tools (e.g., `search_code`).

- MAX_RECONNECT_ATTEMPTS
  - Default: `10`
  - Description: Reconnect attempts after a disconnect before degraded mode.

- RECONNECT_BACKOFF_BASE
  - Default: `2` (seconds)
  - Description: Initial reconnect backoff (exponential).

- RECONNECT_BACKOFF_MAX
  - Default: `30` (seconds)
  - Description: Maximum reconnect backoff.

- HEALTH_CHECK_INTERVAL
  - Default: `15` (seconds)
  - Description: Interval used to check session health while connected.

- RETRY_MAX_ATTEMPTS
  - Default: `3`
  - Description: Retry attempts for transient request errors.

- RETRY_BACKOFF_BASE
  - Default: `1` (seconds)
  - Description: Initial retry backoff (exponential).

- RETRY_BACKOFF_MAX
  - Default: `4` (seconds)
  - Description: Maximum retry backoff.

## Testing & CI gating

- SERENA_E2E
  - Default: unset
  - Description: Set to `true` in CI to enable Serena E2E tests.

- For CI: provide `SERENA_BASE` and optionally `SERENA_API_KEY` as secrets.

## Examples

- Local (development):

```bash
export SERENA_BASE=http://127.0.0.1:9121
export LOG_LEVEL=DEBUG
export REQUEST_TIMEOUT_DEFAULT=60
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
- Tune `REQUEST_TIMEOUT_*` values for long-running tools and adjust retry
  settings conservatively for transient errors.