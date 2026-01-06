# PHASE 5: Metrics and Monitoring

**Phase Number:** 5 of 6  
**Status:** Can overlap with Phase 4 final stages  
**Prerequisite:** Phases 1–4 implementations in place  

## Domain Keywords (for routing classification)

`metrics` `monitoring` `logging` `telemetry` `prometheus` `circuit-breaker` `error` `retry` `availability` `latency` `accuracy` `pipeline` `observability` `instrumentation`

**Expected Classification:** @general-purpose (multi-domain) OR @agent-pipeline-orchestration-expert

## Prerequisites Met
- CircuitBreaker (Phase 1) with state management
- Parallel OCR (Phase 2) with reconciliation metrics
- Query generation (Phase 3) with success tracking
- Query execution (Phase 4) with latency tracking
- Repo has metrics client + logging infra (or add as part of Phase 5)

## Objective

Implement comprehensive metrics collection and monitoring for all pipeline stages.

Purpose:
- Track latency per stage (p50/p95/p99)
- Monitor accuracy metrics (F1/precision/recall)
- Track circuit breaker transitions and effectiveness
- Track sidecar availability
- Monitor user correction rate (drift indicator)
- Enable dashboards + alerts

## Requirements

### Canonical Metrics (Prometheus-oriented)

Use the canonical names from `docs/OBSERVABILITY_AND_TELEMETRY.md`:

1. `ocr_reconciliation_conflict_rate` (Gauge, 0–1)
2. `sidecar_availability` (Gauge, 0–1)
3. `field_detection_f1` (Gauge, 0–1)
4. `embedding_query_latency_ms` (Histogram)
5. `visual_query_execution_time_ms` (Histogram)
6. `visual_queries_executed_total` (Counter)
7. `visual_element_detection_latency_ms` (Histogram)
8. `circuit_breaker_state` (Gauge)
9. `circuit_breaker_transitions_total` (Counter)
10. `visual_confirmation_rate` (Gauge)
11. `ocr_source_attribution_rate` (Gauge)
12. `extraction_accuracy_per_field_type` (Gauge)
13. `user_correction_rate` (Gauge)

Use canonical names from `docs/OBSERVABILITY_AND_TELEMETRY.md`. Include sensible labels (document_type, field_type, query_type, stage_name, etc.).
All percentages as 0.0–1.0 floats. All timestamps UTC. All latencies milliseconds.

### Dashboards
Create dashboards (Grafana or equivalent):
- pipeline latency per stage
- field accuracy trends
- circuit breaker state history
- sidecar availability
- OCR conflict rate
- user correction rate
- error rates by type

### Alerts
Configure alert rules (examples):
- `field_detection_f1 < 0.85` → CRITICAL
- `sidecar_availability < 0.995` → WARNING
- `ocr_reconciliation_conflict_rate > 0.10` → WARNING
- circuit breaker OPEN > 5m → CRITICAL
- pipeline stage p95 > 2000ms → WARNING
- user correction rate > 0.05 → INVESTIGATE

### Error Tracking
Track counts for:
- circuit breaker opens
- query timeouts
- OCR conflicts
- extraction errors
- aggregation/integration errors

## Expected Deliverables

### Code
- metrics registration + exporter (~150 lines)
- per-stage latency tracking (~100 lines)
- accuracy metric calculation (~50 lines)
- circuit breaker instrumentation (~50 lines)
- sidecar health check integration (~50 lines)
- user correction tracking interface (~50 lines)
- dashboard JSON definitions
- alert rule definitions

### Testing
- unit tests for metric registration/latency/accuracy
- integration tests for metrics end-to-end
- performance tests: overhead < 5%

### Documentation
- metrics reference
- dashboard guide
- alert guide
- architecture notes
- how to add new metrics

## Success Criteria
- All 11 metrics registered and collecting data
- p50/p95/p99 per stage available
- No pipeline failures if metrics collection fails (non-blocking)
- Metrics overhead < 5%
- Dashboards render correctly
- Alerts trigger correctly
- Tests passing
- Ready for Phase 6

## Test Execution Instructions

```bash
# Unit tests (examples; adjust)
npm test -- Phase5-MetricsRegistration.test.js --verbose
npm test -- Phase5-LatencyTracking.test.js --verbose
npm test -- Phase5-AccuracyMetrics.test.js --verbose

# Integration tests
npm test -- Phase5-MetricsCollection.test.js --verbose
npm test -- Phase5-DashboardQueries.test.js --verbose

# Performance tests
npm test -- Phase5-Performance.test.js --verbose

# Verify exporter
curl http://localhost:9090/metrics | grep -E "ocr_reconciliation_conflict_rate|sidecar_availability|pipeline_stage_latency_ms" || true
```

## Constraints & Notes
- Do NOT modify Phase 1–4 logic (only add instrumentation)
- Do NOT store PII in metrics
- Do NOT block pipeline on metrics failures
- Retain historical data ≥ 30 days
