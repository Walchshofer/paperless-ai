# CODEX Configuration Guide (Bridge)

This guide describes a recommended JSON configuration that CODEX (or any
orchestrator) can use to spawn and manage the bridge process.

## Minimal JSON example

```json
{
  "name": "codex-serena-bridge",
  "command": "python",
  "args": ["bridge/codex-serena-bridge.py"],
  "cwd": "/opt/paperless-ai",
  "env": {
    "SERENA_BASE": "http://serena.example:9121",
    "SERENA_API_KEY": "${SERENA_API_KEY}",
    "LOG_LEVEL": "INFO",
    "REQUEST_TIMEOUT_DEFAULT": "60"
  },
  "restart": "on-failure",
  "stdout": "/var/log/codex-serena-bridge.stdout.log",
  "stderr": "/var/log/codex-serena-bridge.stderr.log"
}
```

## Authentication setup

- If Serena enforces authentication, set `SERENA_API_KEY` via an environment
  variable or secret manager. Avoid embedding secrets in plaintext files.
- Example using OS env: `export SERENA_API_KEY=xxxxx`

## Logging & debugging

- Bridge logs to `CODEX_BRIDGE_LOG_FILE` (or `LOG_FILE`) and stderr. Configure
  host capture (systemd journal, container logs, or log aggregator).
- For verbose debugging set `LOG_LEVEL=DEBUG` (dev or short-lived sessions).

## Runtime supervision (examples)

- systemd (example service snippet):

```ini
[Unit]
Description=CODEX-Serena Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/paperless-ai
Environment=SERENA_BASE=http://serena:9121
Environment=SERENA_API_KEY=%p
ExecStart=/usr/bin/python3 bridge/codex-serena-bridge.py
Restart=on-failure
StandardOutput=append:/var/log/codex-serena-bridge.log
StandardError=append:/var/log/codex-serena-bridge.log

[Install]
WantedBy=multi-user.target
```

- Docker Compose: see `docs/bridge/ENVIRONMENT_VARIABLES.md` for a snippet.

## Notes

- Ensure your orchestrator restarts the bridge if it exits unexpectedly.
- Use `REQUEST_TIMEOUT_SEARCH` or `REQUEST_TIMEOUT_READ` for slower tools.