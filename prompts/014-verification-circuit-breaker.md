---
name: verification-circuit-breaker
stage: 060-test
agent: test-agent
prompt_id: 014-native-alpha-9-resilience-verification
---

<objective>
Verify the Native Protocol Alpha-9 Circuit Breaker behavior. Ensure the 
orchestrator provides deterministic fallbacks during sidecar initialization 
and high-load VRAM pressure on the RTX 3090 Ti.
</objective>

<context>
The Visual RAG integration must handle the transition between the warm-up 
phase (model loading) and the active phase. This verification ensures that 
a `503 Initializing` response or a 5-second timeout triggers the correct 
fallback path without cascading failures.

**Hardware Baseline:** RTX 3090 Ti (Ampere SM86).
**VRAM Profile:** ~3.5GB baseline for sidecar; monitored via `nvidia-smi`.
</context>

<requirements>
1. **Alpha-9 Handshake Validation**:
   - Verify that the Node.js orchestrator correctly interprets a `503` 
     response with the body `Initializing` as a "Warm-up" state.
   - **Success Criteria:** UI displays a "GPU Preparing" indicator and the 
     backend executes a Text-Only RAG fallback.

2. **State Transition Audit (Circuit Breaker)**:
   - **CLOSED to OPEN:** Trigger 3 consecutive 5-second timeouts. Assert 
     the breaker trips to OPEN and `circuit_breaker_open_total` increments.
   - **OPEN state:** Assert that subsequent requests return a 503 error 
     immediately without attempting to contact the sidecar :8001.
   - **HALF-OPEN:** Wait for `VISUAL_SIDECAR_COOLDOWN_MS`. Send a healthy 
     request and verify the transition back to CLOSED.

3. **Hardware-Aware Telemetry**:
   - Scrape `/metrics` to assert the presence of:
     - `sidecar_availability`: Binary (1 for healthy, 0 for unavailable).
     - `sidecar_vram_usage_bytes`: Real-time RTX 3090 Ti usage.
   - Assert structured logs include `fallback_reason='sidecar_initializing'` 
     or `fallback_reason='circuit_breaker_open'`.

4. **Detox & Standards Compliance**:
   - Ensure the `circuit-breaker.spec.js` adheres to the 79-character 
     Python limit (where applicable in helper scripts) and strict Preact/JS 
     typing.
</requirements>



<implementation>
- **Node.js Test:** `test/integration/circuit-breaker-alpha9.spec.js` 
  using Mocha + Node `assert`.
- **Sidecar Mock:** `test/helpers/sidecar-mock-alpha9.js` to simulate 
  503 Initializing, timeouts, and success states.
- **Monitoring:** Integration with a shell-based VRAM scraper to correlate 
  breaker trips with RTX 3090 Ti pressure.
</implementation>

<output>
- `test/integration/circuit-breaker-alpha9.spec.js`
- `test/helpers/sidecar-mock-alpha9.js`
- `prompts/summaries/014-circuit-breaker-verification-summary.md`
</output>

<verification>
- Run the Alpha-9 resilience suite: `npm test test/integration/circuit-breaker-alpha9.spec.js`.
- Simulate a "Model Swap" event (503 Initializing) and confirm Text-RAG fallback.
- Confirm `circuit_breaker_state` metrics correctly reflect the internal state machine.
- Verify `nvidia-smi` logs during the test show stable VRAM allocation.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/014-circuit-breaker-verification-summary.md`.
2. Move to `prompts/completed/` after 100% resilience pass.
</lifecycle>