# Verification: Circuit Breaker Behaviour for Visual Sidecar & Visual Queries

Goal: Verify circuit breaker implementation protects pipeline from Visual RAG sidecar failures, supports state transitions, and triggers graceful degradation and telemetry.

Checks:

- State Transitions
  - Confirm circuit breaker exposes state (CLOSED=0, OPEN=1, HALF_OPEN=2) via a metric `circuit_breaker_state{service="visual_sidecar"}`.
  - Confirm `circuit_breaker_transitions_total{service="visual_sidecar",from_state,to_state}` increments on transitions.

- Failure Threshold & Cooldown
  - Test that repeated failed calls (e.g., 3 consecutive failed requests or configured threshold) cause circuit to transition to OPEN and block further visual queries.
  - Verify cooldown period respects `VISUAL_SIDECAR_COOLDOWN_MS` and transitions to HALF_OPEN after cooldown.

- Graceful Degradation
  - When circuit is OPEN: Visual queries should be skipped and pipeline must continue (extraction-only). The response should indicate `context.visualSidecarAvailable=false` and no pipeline failure should be returned.
  - Ensure overlays/visual enhancements are not attempted while OPEN.

- Recovery Behaviour
  - In HALF_OPEN, allow a limited number of test requests; if successful, transition to CLOSED and resume normal operation.

- Telemetry & Logs
  - Confirm metrics: `circuit_breaker_open_total`, `visual_query_timeouts_total`, and `sidecar_availability` reflect the failure and recovery events.
  - Confirm structured logs include `request_id`, `stage: 'visual_query'`, and `fallback_reason: 'circuit_breaker_open'` where applicable.

- Prometheus & Alerting
  - Confirm `circuit_breaker_state` is queryable in `/metrics` and that alert rules (e.g., OPEN for 5 minutes) would fire based on metric values.

Suggested Tests (Automated):

1. Simulate sidecar failures (return 500 or timeout) and assert after threshold the circuit opens and subsequent visual queries are skipped.
2. Confirm metrics increment and logs include expected fields when circuit opens.
3. Wait for cooldown period, simulate healthy sidecar, and assert circuit recovers to CLOSED.

Notes:
- Circuit breaker must never cause the entire pipeline to fail; design tests to verify that extraction-only results are returned when visual path is disabled.
- Test both direct visual query endpoints (e.g., `/api/visual-rag/search/visual`) and pipeline-driven visual queries to ensure the breaker is applied consistently.