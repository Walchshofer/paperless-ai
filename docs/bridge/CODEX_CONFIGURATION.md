# CODEX Configuration Guide (Bridge)

This guide explains a recommended JSON configuration that CODEX (or any orchestrator) can use to spawn and manage the bridge process.

## Minimal JSON example

```json
{
  "name": "codex-bridge",
  "command": "python",
  "args": ["codex-bridge.py"],
  "cwd": "/opt/paperless-ai",
  "env": {
    "SERENA_BASE": "http://serena.example:9121",
    "SERENA_API_KEY": "${SERENA_API_KEY}",
    "LOG_LEVEL": "INFO",
    "REQUEST_TIMEOUT": "60"
  },
  "restart": "on-failure",
  "stdout": "/var/log/codex-bridge.stdout.log",
  "stderr": "/var/log/codex-bridge.stderr.log"
}
```

## Authentication setup

- If Serena enforces authentication, set `SERENA_API_KEY` either via environment variable or a secret manager. Avoid embedding secrets in plaintext files.
- Example using OS env: `export SERENA_API_KEY=xxxxx`

## Logging & debugging

- Bridge logs to `LOG_FILE` (env) and stderr—configure host capture (e.g., systemd journal or a log aggregator).
- For verbose debugging set `LOG_LEVEL=DEBUG` (only in dev or short-lived troubleshooting sessions).

## Runtime supervision (examples)

- systemd (example service snippet) — prefer this for production on single hosts:

```ini
[Unit]
Description=CODEX-Serena Bridge
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/paperless-ai
Environment=SERENA_BASE=http://serena:9121
Environment=SERENA_API_KEY=%p
ExecStart=/usr/bin/python3 codex-bridge.py
Restart=on-failure
StandardOutput=append:/var/log/codex-bridge.log
StandardError=append:/var/log/codex-bridge.log

[Install]
WantedBy=multi-user.target
```

- Docker Compose: see `docs/bridge/ENVIRONMENT_VARIABLES.md` for an example snippet.

## Notes

- Ensure your orchestrator restarts the bridge when it exits unexpectedly; the bridge will try to reconnect but should be restarted by the supervisor if it enters degraded mode.
