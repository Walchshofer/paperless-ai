/* eslint-env mocha */
const assert = require('assert');
const client = require('prom-client');
const { PrometheusMetrics } = require('../../services/metrics/PrometheusMetrics');

describe('Phase 5 Accuracy Metrics', function() {
    it('should record user correction and field accuracy metrics', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);

        metrics.recordFeedback({
            pipelineId: 'financial',
            accuracyScore: 0.9,
            corrections: ['total_amount']
        });

        const output = await metrics.getMetrics();

        assert.ok(
            /user_correction_rate\{[^}]*pipeline_id="financial"[^}]*\}/.test(output),
            'Expected user correction rate to be recorded'
        );
        assert.ok(
            /extraction_accuracy_per_field_type\{[^}]*field_type="total_amount"[^}]*\}/.test(output),
            'Expected per-field accuracy to be recorded'
        );
        assert.ok(
            /field_detection_f1\{[^}]*document_type="unknown"[^}]*\}/.test(output),
            'Expected field detection F1 to be recorded'
        );
    });
});
