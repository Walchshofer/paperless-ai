# Performance Tuning — CODEX-Serena Bridge

This guide collects tuning knobs and recommended practices to optimize bridge performance.

## Timeouts & Backoff

- `REQUEST_TIMEOUT` (default 60s): Increase for slow tool backends or heavy processing workloads (e.g., `REQUEST_TIMEOUT=120`).
- `SSE_TIMEOUT` (default 30s): Controls SSE socket inactivity. Increase for high-latency networks.
- `MAX_RECONNECT_ATTEMPTS` (default 10): Number of failures before bridge enters degraded mode; lower for aggressive failure modes, higher for flaky networks.
- `RECONNECT_BACKOFF_BASE` and `RECONNECT_BACKOFF_MAX`: Use exponential backoff to avoid thundering herd; e.g., base=2, max=30.
- `HEALTH_CHECK_INTERVAL`: Decrease for faster detection of required reconnects in tests, increase in production for lower churn.

## Concurrency

- Bridge supports pipelined concurrency; ensure your CODEX client provides unique `id` fields for each JSON-RPC request to benefit from ordering guarantees.
- On the Serena side, ensure it supports concurrent tool processing; otherwise, increase `REQUEST_TIMEOUT` and consider queueing on the tool backend.

## Logging

- Avoid `LOG_LEVEL=DEBUG` in high-throughput production as it significantly increases I/O; use `INFO` or `WARN`.
- Ensure log files are forwarded to a centralized system for analysis (ELK/Datadog).

## Resource Sizing

- CPU: Bridge is I/O bound; a single core is often sufficient. Increase for heavy JSON-RPC framing or embedded pre/post processing.
- Disk: Ensure enough space for logs and temporary payloads; log rotation recommended.

## Monitoring

- Expose Prometheus metrics for:
  - `bridge_sse_connected{}` — 1 when connected
  - `bridge_forward_time_seconds` — histogram of forward_request latency
  - `bridge_retry_count_total` — cumulative retries

- Add an alert if `bridge_sse_connected` falls to zero for > 5m or if `bridge_retry_count_total` spikes.

## Large Codebase Notes

- If tools perform large codebase searches or heavy analyses, set `REQUEST_TIMEOUT` to 120–300s and ensure tool backends are horizontally scalable.
- Consider adding specialized endpoints that accept batch jobs and return job IDs to avoid long synchronous waits.

## Vision Pipeline Tuning (RTX 3090 Ti)

High-resolution document processing (300 DPI) requires specific hardening to prevent truncation and timeouts.

### Hardened Baselines
- **Context Window (`num_ctx`)**: Set to **32768 (32k)** for vision tasks. This provides sufficient space for high-res image tokens.
- **Prediction Budget (`num_predict`)**: Set to **8192 (8k)**. This prevents the `done_reason: length` truncation observed in complex documents (e.g., medical laboratory reports).
- **Prompt Sanitization**: Ensure vision prompts explicitly forbid internal monologue/thinking tags to reserve the entire token budget for actual output.

### Rendering Strategy
- **High-Res (300 DPI)**: Recommended for maximum accuracy in text extraction. Verified stable with the 32k/8k baseline.
- **Optimized (150 DPI)**: Use for faster feedback in non-critical environments (e.g., Test Lab) if GPU resources are heavily constrained.

**Tip:** Document any tuning changes in `docker-compose.env` and the deployment runbook for traceability. Reconcile all model-specific limits via `config.expertModels` Source of Truth.
