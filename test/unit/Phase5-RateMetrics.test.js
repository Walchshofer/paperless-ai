
const assert = require('assert');
const client = require('prom-client');
const { PrometheusMetrics } = require('../../services/metrics/PrometheusMetrics');

describe('Phase 5 Rate Metrics', function() {
    it('should record retry/fallback rates and average duration', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);

        metrics.recordRetry({
            pipelineId: 'financial',
            stageName: 'stage-1',
            reason: 'execution_failed',
            severity: 'high'
        });
        metrics.recordFallback({
            pipelineId: 'financial',
            from: 'guidance',
            to: 'prompt_registry',
            reason: 'guidance_unavailable'
        });
        metrics.recordPipelineCompletion('financial', 500);

        const output = await metrics.getMetrics();
        assert.ok(
            /retry_rate\{[^}]*pipeline_id="financial"[^}]*\}/.test(output),
            'Expected retry_rate sample'
        );
        assert.ok(
            /fallback_rate\{[^}]*pipeline_id="financial"[^}]*\}/.test(output),
            'Expected fallback_rate sample'
        );
        assert.ok(
            /average_pipeline_duration\{[^}]*pipeline_id="financial"[^}]*\}/.test(output),
            'Expected average_pipeline_duration sample'
        );
    });

    it('should record guidance success rate', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);

        metrics.recordGuidanceResult('extraction', true);
        metrics.recordGuidanceResult('extraction', false);

        const output = await metrics.getMetrics();
        assert.ok(
            /guidance_success_rate\{[^}]*stage_name="extraction"[^}]*\}/.test(output),
            'Expected guidance_success_rate sample'
        );
    });

    it('should no-op when metrics are disabled', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry, { enabled: false });

        metrics.recordPipelineCompletion('financial', 100);
        const output = await metrics.getMetrics();
        assert.strictEqual(output, '');
    });
});
