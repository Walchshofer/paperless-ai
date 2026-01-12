# Migration Guide: v3.0 → v4.0 (CODEX-Serena bridge)

This guide helps operators transition from v3.0 to v4.0 of the CODEX-Serena bridge.

## High-level changes in v4.0

- Connection model: v4.0 uses SSE (server-sent events) via a ConnectionManager to maintain a live session to Serena (improved liveness and tool updates).
- Pipelined concurrency: multiple in-flight requests are supported with ordered delivery of responses (prevents blocking behavior and improves throughput).
- Error handling: error classification (transient vs permanent), smart retry logic, error enrichment for actionable messages.
- Modularization: bridge code split into `services/bridge` helpers (state, config, connection, logging) for maintainability.
- CI & E2E: gated E2E tests that run when `SERENA_E2E` and `SERENA_BASE` are configured.

## Backward Compatibility notes

- The bridge continues to accept CODEX JSON-RPC requests over STDIO; existing CODEX deployments that pipe requests to the bridge should not require functional changes.
- Environment variable names are stable; where new variables were introduced (timeouts, backoff), sensible defaults are provided so most installations do not need immediate changes.

## Migration steps

1. Review new environment variables (see `docs/BRIDGE_CONFIGURATION.md`) and add any custom overrides to `docker-compose.env`.
2. Deploy the new bridge on a staging environment and enable verbose logging (`LOG_LEVEL=DEBUG`) while validating connections to Serena.
3. Run the gated E2E tests in CI by setting the secrets `SERENA_E2E=true` and `SERENA_BASE`.
4. Monitor logs for any `Timeout forwarding` or `SSE connection error` messages and adjust `REQUEST_TIMEOUT` / `SSE_TIMEOUT` as needed.
5. Run smoke queries to ensure pipelined requests behave as expected (multiple concurrent tools/calls).

## Rollback procedure

- If issues are severe, rollback to v3.0 tag or commit:

```bash
git checkout tags/v3.0 -b rollback/v3.0
docker-compose up -d --force-recreate
```

- Restore previous `docker-compose.env` values and monitor health.

## Notes: Troubleshooting while migrating

- If the bridge reports `Not connected to Serena` frequently, check network reachability and that Serena's SSE endpoint is reachable from the host/container.
- If ordered delivery is not observed, verify the CODEX client is not buffering STDIO input and that requests contain distinct `id` fields.

For more details, see `docs/TROUBLESHOOTING_BRIDGE.md` and `docs/DEPLOYMENT_CHECKLIST.md`.
