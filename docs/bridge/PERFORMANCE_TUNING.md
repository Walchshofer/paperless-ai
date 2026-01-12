# Bridge Performance Tuning

Recommendations for tuning timeouts and behavior for heavy workloads or unreliable networks.

## Timeouts
- `REQUEST_TIMEOUT`: Increase when tools perform long-running work (search/indexing). Start with 2× the observed median runtime and iterate.
- `SSE_TIMEOUT`: Use to control how long low-level reads wait. Default 30s is usually adequate.
- `HEALTH_CHECK_INTERVAL`: Shorter intervals detect disconnects faster but increase background checks; reduce for faster failover during tests.

## Retry/backoff
- `MAX_RECONNECT_ATTEMPTS`: Increase if the network occasionally drops for longer windows. Otherwise keep conservative to avoid tight retry loops.
- `RECONNECT_BACKOFF_BASE` and `RECONNECT_BACKOFF_MAX`: Use exponential backoff (base 2–4s, max 30–60s) to reduce load on Serena during outages.

## Concurrency
- The bridge supports pipelined concurrency; incoming request volume may require tuning the process supervisor (increase ulimits, CPU shares) and the host's IO configuration.
- Monitor the `response_delivery_queue` size (if custom monitoring is added) to detect backpressure; when the queue grows, consider increasing worker throughput or rate-limiting callers.

## Observability
- Export/record the following metrics in your monitoring system: connect_attempts, reconnect_count, request_time_ms (p95/p99), request_timeouts, delivery_queue_length, session_active.
- Use logs (`LOG_LEVEL=DEBUG`) for capturing detailed timing during tuning and switch back to INFO once tuned.

## Load testing recommendations
- Run a realistic load (similar request mix as production) against a staging Serena instance.
- Measure the effect of increasing `REQUEST_TIMEOUT` and `RECONNECT_BACKOFF` on end-to-end latency.

