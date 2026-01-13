# Bridge Deployment Checklist

Use this checklist when deploying the CODEX↔Serena bridge (v4.0).

## Pre-deployment
- [ ] Ensure Serena (oraios/serena) is running and reachable at `SERENA_BASE`.
- [ ] Backup current configuration and bridge logs.
- [ ] Confirm Python 3.11+ runtime and `pip` available.

## Install
- [ ] Clone repository and switch to appropriate release branch (e.g., `v4.0`).
- [ ] Create and activate a virtual environment:
  - `python -m venv .venv && .venv/bin/activate`
- [ ] Install dependencies:
  - `pip install -r requirements.txt`
  - If using the SDK CLI: `pip install mcp[cli]`

## Configuration
- [ ] Set required environment variables (see `docs/bridge/ENVIRONMENT_VARIABLES.md`), e.g.:
  - `SERENA_BASE`, `SERENA_API_KEY` (optional), `LOG_LEVEL`, `REQUEST_TIMEOUT`
- [ ] If using Docker, add these env vars to the service environment or a `.env` file

## Start & Validate
- [ ] Start the bridge via supervisor (systemd/docker-compose) or directly: `python codex-serena-bridge.py`
- [ ] Verify logs show successful session initialization:
  - Look for: "Fetched <n> tools" and "Serena session ready"
- [ ] Run basic smoke checks (locally):
  - `curl -s ${SERENA_BASE}/health` should return healthy status for Serena
  - `python -c "import requests; print(requests.get('${SERENA_BASE}/status').status_code)"` (if your Serena instance provides a status endpoint)

## Post-deployment verification
- [ ] Run integration tests (if a test Serena endpoint is available): `pytest test/integration -q`
- [ ] Optionally run E2E tests by setting `SERENA_E2E=1` and `SERENA_BASE` and running `pytest test/e2e -q`

## Rollback procedure (if needed)
- Stop the bridge and restore previous branch or container image
- Re-apply previous configuration and restart supervisor
- Verify old bridge instance can re-establish session with Serena

## Operational notes
- For high-latency connections or heavy tool workloads, increase `REQUEST_TIMEOUT` and adjust `RECONNECT_BACKOFF` settings accordingly (see `docs/bridge/PERFORMANCE_TUNING.md`).
