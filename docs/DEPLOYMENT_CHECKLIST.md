# Deployment Checklist — CODEX-Serena Bridge (v4.0)

This checklist helps operators deploy the codex-bridge reliably for v4.0.

## Pre-deployment

- [ ] Ensure Serena is installed and reachable at `SERENA_BASE` (e.g., `http://serena:9121`).
- [ ] Add `SERENA_API_KEY` to secrets if Serena requires authentication.
- Populate `docker-compose.env` (repo root) with bridge variables (see `docs/BRIDGE_CONFIGURATION.md`).
- If you rely on legacy `docker-compose` (hyphen) clients, generate the compatibility `.env` at the repo root before invoking `docker-compose`:

```bash
npm run env:sync
# validate
npm run env:validate
```

Note: Do not commit generated `./.env` to git (it's intentionally ignored).
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
    env_file: .env
    command: python codex-bridge.py
```

### Docker registry credentials 💡
If you encounter `error from registry: unauthorized` when `docker compose` pulls images, ensure the following before retrying:

- Authenticate to the registries that host the images (examples):
  - `docker login ghcr.io` (GitHub Container Registry; use a Personal Access Token with `read:packages` scope)
  - `docker login` (Docker Hub)
- Inspect `%USERPROFILE%\\.docker\\config.json` for expired credentials or custom credential helpers and clear/re-authenticate if needed.
- After authenticating, run:
  ```bash
  docker compose --env-file docker-compose.env pull
  docker compose --env-file docker-compose.env up -d --build
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

Note: runtime environment file (data/runtime.env)

- The app persists runtime overrides to `data/runtime.env` (previously `data/.env`).
- `docker-compose.env` remains canonical for infrastructure/secrets.
- `npm run env:sync` regenerates only repo-root `.env` compatibility file.
- Do not commit `data/runtime.env`.
- Run `npm run env:audit` to detect protected-key drift and
  `npm run env:sanitize` to clean `data/runtime.env` if needed.
