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
            output.includes('user_correction_rate{pipeline_id="financial"}'),
            'Expected user correction rate to be recorded'
        );
        assert.ok(
            output.includes('extraction_accuracy_per_field_type{field_type="total_amount"}'),
            'Expected per-field accuracy to be recorded'
        );
        assert.ok(
            output.includes('field_detection_f1{document_type="unknown"}'),
            'Expected field detection F1 to be recorded'
        );
    });
});
