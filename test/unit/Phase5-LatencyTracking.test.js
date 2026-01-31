
const assert = require('assert');
const client = require('prom-client');
const { PrometheusMetrics } = require('../../services/metrics/PrometheusMetrics');

describe('Phase 5 Latency Tracking', function() {
    it('should record pipeline stage latency', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);

        metrics.recordStageLatency('stage-ocr', 'TEXT_EXTRACTION', 250);
        const output = await metrics.getMetrics();

        assert.ok(
            /pipeline_stage_latency_ms_count\{[^}]*stage_name="stage-ocr"[^}]*stage_type="TEXT_EXTRACTION"[^}]*\}/.test(output),
            'Expected stage latency count sample'
        );
    });

    it('should record visual query execution time', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);

        metrics.observeVisualQueryExecutionTime('financial', 120);
        const output = await metrics.getMetrics();

        assert.ok(
            /visual_query_execution_time_ms_count\{[^}]*document_type="financial"[^}]*\}/.test(output),
            'Expected visual query execution time count sample'
        );
    });
});
