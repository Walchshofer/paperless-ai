/* eslint-env mocha */
const assert = require('assert');
const { VisualQueryGenerator } = require('../../services/experts/VisualQueryGenerator');
const { PrometheusMetrics } = require('../../services/metrics/PrometheusMetrics');
const client = require('prom-client');

describe('Performance: Resource Usage', function() {
    it('should keep heap growth under 80MB for repeated query generation', async function() {
        if (global.gc) {
            global.gc();
        }
        const generator = new VisualQueryGenerator();
        const baseline = process.memoryUsage().heapUsed;

        for (let i = 0; i < 200; i += 1) {
            await generator.generateQueries({
                extractionResults: {
                    fields: [{ name: 'invoice_number', value: String(i), confidence: 0.6 }]
                },
                ocrResults: { text: 'invoice data' },
                fieldTaxonomy: { fields: ['invoice_number', 'total_amount'] },
                documentMetadata: { id: `mem-doc-${i}` }
            });
        }

        if (global.gc) {
            global.gc();
        }
        const after = process.memoryUsage().heapUsed;
        const deltaMb = (after - baseline) / (1024 * 1024);

        assert.ok(deltaMb < 80, `Expected heap growth <80MB, got ${deltaMb.toFixed(2)}MB`);
    });

    it('should keep metrics collector growth bounded', function() {
        if (global.gc) {
            global.gc();
        }
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);
        const baseline = process.memoryUsage().heapUsed;

        for (let i = 0; i < 500; i += 1) {
            metrics.recordFeedback({
                pipelineId: 'financial',
                accuracyScore: 0.9,
                corrections: ['total_amount']
            });
        }

        if (global.gc) {
            global.gc();
        }
        const after = process.memoryUsage().heapUsed;
        const deltaMb = (after - baseline) / (1024 * 1024);

        assert.ok(deltaMb < 80, `Expected heap growth <80MB, got ${deltaMb.toFixed(2)}MB`);
    });
});
