
const assert = require('assert');
const { VisualQueryExecutor } = require('../../services/experts/VisualQueryExecutor');
const { VisualQueryGenerator } = require('../../services/experts/VisualQueryGenerator');
const { ParallelOcrExecutor } = require('../../services/experts/ParallelOcrExecutor');
const paperlessService = require('../../services/paperlessService');

describe('Performance: Latency', function() {
    it('should execute visual queries under 500ms for 5 queries', async function() {
        const visualSearchClient = {
            search: async () => ({
                bounding_boxes: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }],
                scores: [0.95],
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
            priority: 0.9,
            confidence: 0.9,
            rarity_factor: 0.1
        }));

        const start = Date.now();
        const result = await executor.executeQueries({
            visualQueries: queries,
            extractionResults: { fields: [] },
            documentMetadata: { id: 'perf-doc', documentType: 'financial' },
            documentImage: 'dGVzdA=='
        });
        const duration = Date.now() - start;

        assert.ok(duration < 500, `Expected <500ms, got ${duration}ms`);
        assert.ok(result.execution_metadata.execution_duration_ms < 500);
    });

    it('should generate visual queries under 100ms', async function() {
        const generator = new VisualQueryGenerator();
        const start = Date.now();
        const result = await generator.generateQueries({
            extractionResults: {
                fields: [{ name: 'invoice_number', value: '123', confidence: 0.5 }]
            },
            ocrResults: { text: 'invoice 123 total 45' },
            fieldTaxonomy: { fields: ['invoice_number', 'total_amount'] },
            documentMetadata: { id: 'perf-doc' }
        });
        const duration = Date.now() - start;

        assert.ok(duration < 100, `Expected <100ms, got ${duration}ms`);
        assert.ok(result.visual_queries.length >= 3);
    });

    it('should execute parallel OCR under 1000ms with stubs', async function() {
        const ollamaService = {
            _callOllamaVisionAPI: async () => ({ response: 'test text' })
        };
        const executor = new ParallelOcrExecutor(ollamaService, {
            visualElements: { enabled: false }
        });

        const originalClient = paperlessService.client;
        const originalInit = paperlessService.initialize;
        paperlessService.initialize = () => {};
        paperlessService.client = {
            get: async () => ({
                data: {
                    content: 'tesseract text',
                    tags: [],
                    title: 'test',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    page_count: 1
                }
            })
        };

        try {
            const start = Date.now();
            const result = await executor.execute(
                { id: 'perf-doc', imageBase64: 'dGVzdA==' },
                { documentType: 'financial' }
            );
            const duration = Date.now() - start;

            assert.ok(duration < 1000, `Expected <1000ms, got ${duration}ms`);
            assert.ok(result.metadata.executionTimeMs < 1000);
        } finally {
            paperlessService.client = originalClient;
            paperlessService.initialize = originalInit;
        }
    });

    it('should short-circuit quickly when no visual queries are provided', async function() {
        const visualSearchClient = { search: async () => ({}) };
        const executor = new VisualQueryExecutor(visualSearchClient, {
            timeoutBudget: 50,
            hardTimeout: 200
        });

        const start = Date.now();
        const result = await executor.executeQueries({
            visualQueries: [],
            extractionResults: { fields: [] },
            documentMetadata: { id: 'perf-doc', documentType: 'financial' },
            documentImage: 'dGVzdA=='
        });
        const duration = Date.now() - start;

        assert.ok(duration < 200, `Expected <200ms, got ${duration}ms`);
        assert.ok(result.execution_metadata.fallback);
    });
});
