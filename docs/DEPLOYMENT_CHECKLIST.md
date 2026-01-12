# Deployment Checklist — CODEX-Serena Bridge (v4.0)

This checklist helps operators deploy the codex-bridge reliably for v4.0.

## Pre-deployment

- [ ] Ensure Serena is installed and reachable at `SERENA_BASE` (e.g., `http://serena:9121`).
- [ ] Add `SERENA_API_KEY` to secrets if Serena requires authentication.
- [ ] Populate `docker-compose.env` (or system environment) with bridge variables (see `docs/BRIDGE_CONFIGURATION.md`).
- [ ] Install dependencies in Python environment: `pip install -r requirements.txt` (includes `mcp[cli]`, `pytest` for tests).

## Start Bridge (local)

- Export env vars and start:

```bash
export SERENA_BASE=http://127.0.0.1:9121
export LOG_LEVEL=INFO
python codex-bridge.py
```

- Verify logs show `Serena session ready` and `Fetched N tools`.

## Start Bridge (Docker)

- Add the following to your service definition (example):

```yaml
services:
  codex-bridge:
    image: python:3.11-slim
    volumes:
      - ./:/app
    working_dir: /app
    env_file: docker-compose.env
    command: python codex-bridge.py
```

- Ensure `CODEX_BRIDGE_LOG_FILE` points to a writable path and logs are rotated by your logging/host agent.

## Verification

- Check health & logs:
  - `tail -f /var/log/codex_bridge.log` or `docker logs <codex-bridge>`
  - Expect: `Connecting to Serena SSE`, `Serena session ready`, `Fetched N tools`.

- Run smoke calls:
  - `curl -s -X POST ${SERENA_BASE}/tools/list` (or use an authenticated client) and verify responses.

## Rollback

- If bridge fails to start, revert to the previous release/commit and restore previous `docker-compose.env` values.
- Example: `git checkout <previous-tag>` and restart the service.

## Notes

- For managed CI: enable the gated E2E job (set `SERENA_E2E=true` and `SERENA_BASE` secret) to validate end-to-end behavior in a controlled environment.
- For production: ensure log files are shipped to central logging (ELK, Datadog) and set log rotation.
