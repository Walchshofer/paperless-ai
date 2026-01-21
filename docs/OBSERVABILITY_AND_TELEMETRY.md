# Observability and Telemetry

This document defines the logging, telemetry, and diagnostics requirements for
the paperless-ai Expert Pipeline.

Observability is mandatory to ensure retries, fallbacks, and model decisions
are transparent and debuggable.

---

## Required Log Fields

All pipeline-related log entries MUST include:

- `request_id`
- `document_id`
- `pipeline_id`
- `stage`
- `retry_count`
- `fallback_reason` (if applicable)
- `ocr_source_selected` (`visual` | `tesseract`)
- `action_id` (if action event)
- `action_type` (if action event)
- `action_status` (proposed|executed|reverted|failed)

---

## Key Telemetry Events

The system must emit structured telemetry for the following events:

### `normalization_metrics`
- normalization requested
- normalization executed
- actions applied
- re-ingestion performed
- confidence score

---

### `ocr_comparison`
- visual OCR score
- tesseract OCR score
- selected source
- threshold

---

### `retry_triggered`
- stage
- reason
- severity
- retry_scope (`document`)

---

### `fallback_executed`
- from (`guidance`)
- to (`prompt_registry`)
- reason

---

### `prompt_truncated`
- original token count
- truncated token count
- stage

---

### `action_proposed`
- action_type
- confidence
- evidence_refs
- policy_checks

---

### `action_executed`
- action_type
- execution_time_ms
- result_status

---

### `action_reverted`
- action_type
- revert_reason

---

### `action_failed`
- action_type
- error

---

## Metrics (Recommended)

- retry_rate
- fallback_rate
- visual_ocr_selection_rate
- guidance_success_rate
- average_pipeline_duration
- pipeline_stage_latency_ms
- circuit_breaker_open_total
- visual_query_timeouts_total
- ocr_conflicts_total
- extraction_errors_total
- integration_errors_total

## Prometheus Metrics (Canonical Names)

- retry_rate
- fallback_rate
- guidance_success_rate
- average_pipeline_duration
- ocr_reconciliation_conflict_rate
- ocr_visual_latency_ms
- ocr_tesseract_latency_ms
- sidecar_availability
- field_detection_f1
- embedding_query_latency_ms
- visual_query_execution_time_ms
- visual_queries_executed_total
- visual_element_detection_latency_ms
- circuit_breaker_state
- circuit_breaker_transitions_total
- circuit_breaker_open_total
- visual_confirmation_rate
- visual_ocr_selection_rate
- visual_query_timeouts_total
- ocr_source_attribution_rate
- ocr_conflicts_total
- extraction_accuracy_per_field_type
- extraction_errors_total
- integration_errors_total
- user_correction_rate
- pipeline_stage_latency_ms

---

## Error Tracking (Counters)

Use counters to classify failures by subsystem and stage. These counters are
increment-only and must not block the pipeline when recording fails.

- `extraction_errors_total{stage_name}`: Extraction-stage failures (exceptions,
  invalid output, or retries triggered by validation).
- `integration_errors_total{stage_name}`: Aggregation/integration failures
  during Visual Query execution or result merge.
- `visual_query_timeouts_total{document_type,query_type}`: Visual query timeout
  events, including circuit-breaker protected operations.
- `ocr_conflicts_total{document_type}`: OCR reconciliation conflicts when
  disagreement is detected between OCR sources.
- `circuit_breaker_open_total{service}`: Circuit breaker open events by service.

---

## Prometheus Exporter

paperless-ai exposes Prometheus metrics at:

- `/metrics` (text/plain; version=0.0.4)

Metrics collection is non-blocking. If the exporter fails, the pipeline must    
continue without error.
If `ENABLE_MODEL_METRICS` is set to `no`, metrics recording is disabled and
`/metrics` returns HTTP 204.

### Restricting `/metrics` to the internal network (Fail-Hard) ⚠️

For security, `/metrics` is restricted to internal networks by default and
paperless-ai will fail to start if the configuration is invalid while
`METRICS_INTERNAL_ONLY=true` (the default for production).

Environment variables:

- `METRICS_INTERNAL_ONLY` — `true` | `false` (default: `true`)
  - When `true`, the process will validate that `METRICS_ALLOWED_CIDRS` is
    set and correctly formatted on startup and will exit with a clear error
    message if not.
- `METRICS_ALLOWED_CIDRS` — CSV of IPv4 addresses or CIDRs (example:
  `127.0.0.1,::1,172.18.0.0/16`) — **required** when `METRICS_INTERNAL_ONLY=true`.
- `TRUST_PROXY` — `true` | `false` (default: `false`) — set to `true` when
  paperless-ai runs behind a trusted reverse proxy/load-balancer so that
  `X-Forwarded-For` is respected. Only set this if your proxy is trusted to
  avoid IP spoofing.

Behavior and operational notes:

- The server fails fast during startup with the error:
  `Startup failure: METRICS_INTERNAL_ONLY=true but METRICS_ALLOWED_CIDRS is missing or invalid. Set METRICS_ALLOWED_CIDRS to include your Prometheus network or set METRICS_INTERNAL_ONLY=false for tests.`
  This makes misconfiguration visible immediately in CI/CD and deployments.
- Local development/CI: set `METRICS_INTERNAL_ONLY=false` or configure a test
  CIDR (for example `127.0.0.1`) in CI environment variables to avoid
  unexpected startup failures.
- If Prometheus scrapes paperless-ai from outside the cluster/network you
  plan to deploy into, you must either run Prometheus on the same internal
  network (recommended) or migrate to a token-based scrape approach (see
  the monitoring docs for guidance).

Add the following to your Prometheus job when Prometheus runs in the same
internal Docker/k8s network (no additional auth required):

```yaml
  - job_name: 'paperless-ai'
    static_configs:
      - targets: ['paperless-ai:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

If you must scrape from outside the cluster, use a secure token-based
approach and update your Prometheus scrape config accordingly (see docs).


## Dashboards

Grafana dashboards live in `monitoring/grafana/dashboards/`:

- `pipeline-metrics.json`: pipeline latency per stage, OCR conflict rate, sidecar availability
- `visual-queries.json`: query execution latency, confirmation rate, query volume
- `feedback-quality.json`: field detection F1, user correction rate, per-field accuracy

Import the JSON files into Grafana and set the Prometheus data source.

## Alert Rules

Alert rules live in `monitoring/prometheus/alerts.yml`. Recommended rules:

- `field_detection_f1 < 0.85` → CRITICAL
- `sidecar_availability < 0.995` → WARNING
- `ocr_reconciliation_conflict_rate > 0.10` → WARNING
- `circuit_breaker_state == 1` (OPEN) for 5m → CRITICAL
- `pipeline_stage_latency_ms` p95 > 2000ms → WARNING
- `user_correction_rate > 0.05` → INVESTIGATE

## Adding New Metrics

1. Add the metric to this canonical list.
2. Implement the metric in `services/metrics/PrometheusMetrics.js`.
3. Add instrumentation at the source stage or service.
4. Add/update tests in `test/`.
5. Update dashboards and alert rules as needed.

---

## Debugging Workflow

When investigating incorrect results:

1. Identify the `request_id`
2. Trace stage execution order
3. Inspect retry and fallback telemetry
4. Check OCR comparison metrics
5. Review validator output
6. Confirm final terminal state

---

## Non-Negotiable Guarantees

- All retries are logged
- All fallbacks are logged
- OCR source selection is auditable
- Silent failures are forbidden
