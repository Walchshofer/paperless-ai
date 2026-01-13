# Bridge Performance Tuning

Recommendations for tuning timeouts and behavior for heavy workloads or
unreliable networks.

## Timeouts
- `REQUEST_TIMEOUT_DEFAULT`: Increase when tools perform long-running work
  (search/indexing). Start with 2x the observed median runtime and iterate.
- `REQUEST_TIMEOUT_SEARCH`: Use for long-running search tools (e.g.,
  `search_code`).
- `SSE_TIMEOUT`: Controls how long low-level connects wait. Default 30s is
  usually adequate.
- `HEALTH_CHECK_INTERVAL`: Shorter intervals detect disconnects faster but
  increase background checks; reduce for faster failover during tests.

## Retry/backoff
- `MAX_RECONNECT_ATTEMPTS`: Increase if the network drops for longer windows.
- `RECONNECT_BACKOFF_BASE` and `RECONNECT_BACKOFF_MAX`: Use exponential backoff
  (base 2-4s, max 30-60s) to reduce load on Serena during outages.
- `RETRY_MAX_ATTEMPTS`: Keep request retries conservative to avoid long stalls.

## Concurrency
- The bridge supports pipelined concurrency; incoming request volume may require
  tuning the process supervisor (increase ulimits, CPU shares) and the host's
  IO configuration.
- Monitor ordering stalls when a long request blocks earlier responses.

## Observability
- Export/record the following metrics in your monitoring system:
  connect_attempts, reconnect_count, request_time_ms (p95/p99),
  request_timeouts, session_active.
- Use logs (`LOG_LEVEL=DEBUG`) for detailed timing during tuning and switch
  back to INFO once tuned.

## Load testing recommendations
- Run a realistic load (similar request mix as production) against a staging
  Serena instance.
- Measure the effect of increasing `REQUEST_TIMEOUT_*` and `RECONNECT_BACKOFF`
  on end-to-end latency.