# Verification: Circuit Breaker Behaviour for Visual Sidecar & Visual Queries

<objective>
Verify the circuit breaker implementation protects the pipeline from Visual RAG sidecar failures, provides observable state transitions, and drives graceful degradation with appropriate telemetry.
</objective>

<context>
The Visual RAG integration includes a circuit breaker to prevent visual-sidecar failures from cascading. This prompt codifies automated tests and expectations for state transitions and telemetry.
References: docs/VISUAL_RAG_INTEGRATION.md, docs/OBSERVABILITY_AND_TELEMETRY.md
</context>

<requirements>
1. Test harness that can simulate sidecar responses (healthy, 500, timeout).
2. Access to `/metrics` to assert `circuit_breaker_state` and related metrics.
3. Configurable environment vars: `VISUAL_SIDECAR_FAILURE_THRESHOLD`, `VISUAL_SIDECAR_COOLDOWN_MS` for faster tests.
</requirements>

<implementation>
- Implement unit tests for the breaker state machine and integration tests that hit the pipeline endpoints under simulated sidecar failures.
- Provide helper that toggles sidecar mock behavior and waits for metric propagation.
- Instrument an automated test that asserts extraction-only responses when breaker is OPEN and recovery transitions on healthy responses.
</implementation>

<output>
- `test/integration/circuit-breaker.spec.js` (Created)
- Helper `test/helpers/sidecar-mock.js` (Created)
</output>

<verification>
- Simulate 3 failed sidecar responses and assert `circuit_breaker_state` becomes OPEN and `circuit_breaker_open_total` increments.
- Confirm `context.visualSidecarAvailable=false` in pipeline responses when OPEN.
- Wait for cooldown, simulate healthy sidecar, and assert transition to CLOSED and resumption of visual results.
- Assert structured logs and metrics contain `request_id`, `stage='visual_query'`, and `fallback_reason='circuit_breaker_open'`.
</verification>

<lifecycle>
1. Add the test to `verification-fast` or `verification-e2e` CI jobs depending on duration.
2. Document failures and create an incident runbook if flaky.
3. Archive prompt in `prompts/completed/` and add a summary to `prompts/summaries/`.
