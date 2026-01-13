# Migration Guide: v3.0 -> v4.0 (Bridge)

This document helps teams migrate from bridge v3.x to v4.0 safely.

## Summary of changes (high level)
- Connection transport: v4 uses an SSE-based lifecycle and a ConnectionManager
  for more robust reconnection and tool discovery.
- Pipelined concurrency: v4 supports multiple in-flight requests and ordered
  delivery.
- Error handling: v4 includes error classification (transient vs permanent),
  enriched error messages, and smart retry logic.
- Configuration: additional env vars (timeouts, retry/backoff) introduced.
- CI and tests: new integration tests + E2E gating available.

## Backward compatibility
- v4 preserves the JSON-RPC interface CODEX uses to call tools and resources.
- Validate any CODEX consumers that rely on timing assumptions; with pipelining,
  ordering is guaranteed but latencies may differ.

## Migration steps
1. Read the release notes for v4.0 and identify relevant feature flags.
2. Backup current bridge config and logs.
3. Update environment variables as needed (see `docs/bridge/ENVIRONMENT_VARIABLES.md`).
4. Deploy v4 on a staging environment and run integration tests:
   - `pytest test/integration -q`
5. Optionally run E2E tests (see docs for gating). If Serena is available:
   - `export SERENA_E2E=1; export SERENA_BASE=<url>`
   - `pytest test/e2e -q`
6. Monitor logs and metrics; if issues arise, follow rollback procedure below.

## Rollback procedure
- If critical failures occur, revert to the previous image or checkout the v3
  branch:
  - For docker: `docker run yourorg/codex-serena-bridge:v3.0`
  - For source deploy: checkout `v3.0` tag and restart supervisor.
- Reapply backed-up configuration and notify stakeholders.

## Common migration issues & mitigation
- Increased latencies: adjust `REQUEST_TIMEOUT_*` values for long-running tools.
- Session flapping (frequent reconnects): increase backoff and ensure network
  stability.

## Acceptance checklist
- [ ] Bridge started successfully in staging, tools discovered
- [ ] All integration tests pass in staging
- [ ] No regressions observed in tools usage
- [ ] Performance baselines validated (latency/throughput)