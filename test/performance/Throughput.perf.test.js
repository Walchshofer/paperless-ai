
const assert = require('assert');
const client = require('prom-client');
const { VisualQueryExecutor } = require('../../services/experts/VisualQueryExecutor');
const { PrometheusMetrics } = require('../../services/metrics/PrometheusMetrics');
const { scoreOcrQuality } = require('../../services/experts/utils/ocrQuality');

describe('Performance: Throughput', function() {
    it('should score OCR quality for 200 payloads under 1000ms', function() {
        const visualText = 'Invoice 123\nTotal 45.00\nThank you';
        const paperlessText = 'Invoice 123 Total 45.00';

        const start = Date.now();
        for (let i = 0; i < 200; i += 1) {
            scoreOcrQuality(visualText, paperlessText, { logMetrics: false });
        }
        const duration = Date.now() - start;

        assert.ok(duration < 1000, `Expected <1000ms, got ${duration}ms`);
    });

    it('should execute 20 query batches under 2000ms', async function() {
        const visualSearchClient = {
            search: async () => ({
                bounding_boxes: [{ x: 0.2, y: 0.2, width: 0.1, height: 0.1 }],
                scores: [0.9],
                page_numbers: [1]
            })
        };
        const executor = new VisualQueryExecutor(visualSearchClient, {
            timeoutBudget: 50,
            hardTimeout: 200,
            maxConcurrentQueries: 5
        });
        const queries = Array.from({ length: 5 }).map((_, idx) => ({
            question: `query ${idx}`,
            field_target: `field_${idx}`,
            expected_element_type: 'field_extraction',
            priority: 0.8,
            confidence: 0.9,
            rarity_factor: 0.1
        }));

        const start = Date.now();
        for (let i = 0; i < 20; i += 1) {
            await executor.executeQueries({
                visualQueries: queries,
                extractionResults: { fields: [] },
                documentMetadata: { id: `perf-doc-${i}`, documentType: 'financial' },
                documentImage: 'dGVzdA=='
            });
        }
        const duration = Date.now() - start;

        assert.ok(duration < 2000, `Expected <2000ms, got ${duration}ms`);
    });

    it('should record 200 metrics updates under 200ms', async function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);

        const start = Date.now();
        for (let i = 0; i < 200; i += 1) {
            metrics.recordPipelineCompletion('financial', 120);
            metrics.recordRetry({ pipelineId: 'financial', stageName: 'stage', reason: 'execution_failed', severity: 'high' });
        }
        const duration = Date.now() - start;

        const output = await metrics.getMetrics();
        assert.ok(output.includes('retry_rate'));
        assert.ok(duration < 200, `Expected <200ms, got ${duration}ms`);
    });

    it('should record 300 OCR source updates under 200ms', function() {
        const registry = new client.Registry();
        const metrics = new PrometheusMetrics(registry);

        const start = Date.now();
        for (let i = 0; i < 300; i += 1) {
            metrics.recordOcrSource('financial', i % 2 === 0 ? 'visual-ocr' : 'tesseract-ocr');
        }
        const duration = Date.now() - start;

        assert.ok(duration < 200, `Expected <200ms, got ${duration}ms`);
    });
});
