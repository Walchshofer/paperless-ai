/* eslint-env mocha */
const assert = require('assert');
const client = require('prom-client');
const { PrometheusMetrics } = require('../../services/metrics/PrometheusMetrics');

describe('Phase 5 Metrics Registration', function() {
    it('should register canonical metrics', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);
        const output = await metrics.getMetrics();

        const expected = [
            'ocr_reconciliation_conflict_rate',
            'ocr_visual_latency_ms',
            'ocr_tesseract_latency_ms',
            'sidecar_availability',
            'field_detection_f1',
            'embedding_query_latency_ms',
            'visual_query_execution_time_ms',
            'visual_queries_executed_total',
            'visual_element_detection_latency_ms',
            'circuit_breaker_state',
            'circuit_breaker_transitions_total',
            'visual_confirmation_rate',
            'visual_ocr_selection_rate',
            'ocr_source_attribution_rate',
            'extraction_accuracy_per_field_type',
            'user_correction_rate',
            'pipeline_stage_latency_ms',
            'circuit_breaker_open_total',
            'visual_query_timeouts_total',
            'ocr_conflicts_total',
            'extraction_errors_total',
            'integration_errors_total',
            'retry_rate',
            'fallback_rate',
            'guidance_success_rate',
            'average_pipeline_duration'
        ];

        expected.forEach((name) => {
            assert.ok(
                output.includes(name),
                `Expected metric ${name} to be registered`
            );
        });
    });
});
