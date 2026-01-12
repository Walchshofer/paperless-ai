---
name: verification-telemetry
stage: 060-test
agent: test-agent
prompt_id: 013-native-alpha-9-observability-verification
---

<objective>
Validate the Native Protocol Alpha-9 Telemetry stack. Ensure X-Request-Id 
propagation across the Node/Python boundary, MaxSim performance tracking, 
and RTX 3090 Ti VRAM metrics are deterministic.
</objective>

<context>
Observability for Alpha-9 must track the handshake between the Node.js 
core and the ColQwen3 Sidecar. We must validate that high-fidelity metrics 
are captured for late-interaction retrieval and hardware health.

**Hardware Baseline:** RTX 3090 Ti (Ampere SM86).
**Critical Metric:** `maxsim_score_mean` (Threshold 0.85).
</context>

<requirements>
1. **Sidecar Propagation (Node -> Python)**:
   - Verify that `X-Request-Id` is propagated from the Node.js Gateway 
     to the Python Sidecar (:8001).
   - **Test:** A unique ID sent to `/api/visual-rag/search/visual` must 
     appear in the Python structured logs.

2. **Native Alpha-9 Metrics (/metrics)**:
   - Validate the presence of the following new counters/histograms:
     - `visual_query_execution_time_ms`: Time for multi-vector retrieval.
     - `maxsim_score_distribution`: Histogram of result confidence.
     - `sidecar_vram_usage_bytes`: Real-time RTX 3090 Ti memory footprint.
     - `circuit_breaker_open_total`: Count of 503 Initializing fallbacks.

3. **Hybrid SOT Consistency Logging**:
   - Ensure `feedback_events` write-operations log the associated 
     `qdrant_vector_id` and the `postgres_doc_id` together for auditability.

4. **Structured Log Audit**:
   - Verify that all logs produced during a "Red Pen" search include 
     `hardware_target: "RTX 3090 Ti"` and `model_id: "colqwen3-4b-awq"`.

5. **Linter & "Detox" Audit**:
   - Verify that telemetry helper scripts in Python adhere to 
     **Flake8 (79-char)** and **Pylance typing** standards.
</requirements>



<implementation>
- **Node.js Helper:** `test/helpers/metrics-snapshot.js` (Prometheus parser).
- **Integration Test:** `test/integration/telemetry-alpha9.spec.js`.
- **Sidecar Monitor:** Add a telemetry verification endpoint to the 
  Python sidecar that returns the current VRAM/Latency stats.
</implementation>

<output>
- `test/integration/telemetry-alpha9.spec.js`
- `test/helpers/metrics-snapshot.js`
- `prompts/summaries/013-telemetry-verification-summary.md`
</output>

<verification>
- Trigger a "Red Pen" search and verify the `X-Request-Id` in sidecar logs.
- Scrape `/metrics` and confirm `maxsim_score_distribution` contains values.
- Simulate a Sidecar timeout and confirm `circuit_breaker_open_total` increments.
- Verify `nvidia-smi` matches the `sidecar_vram_usage_bytes` metric reported.
</verification>

<lifecycle>
1. Generate machine-readable summary: `prompts/summaries/013-telemetry-verification-summary.md`.
2. Update `docs/OBSERVABILITY_AND_TELEMETRY.md` with the Alpha-9 metric map.
3. Move to `prompts/completed/` after 100% telemetry pass.
</lifecycle>