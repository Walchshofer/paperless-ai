/* eslint-env mocha */
const assert = require('assert');
const { HybridSearchService } = require('../../services/visual-rag-client/HybridSearchService');

describe('HybridSearchService Integration', function () {
    const mockVisualResult = {
        results: [
            { docId: 101, pageNum: 1, score: 0.95, metadata: { source: 'visual' } }
        ],
        totalResults: 1
    };

    const mockTextResult = [
        { docId: 102, score: 0.85, content: 'text match', title: 'Text Doc' }
    ];

    const mockVisualClient = {
        isAvailable: async () => true,
        search: async () => mockVisualResult
    };

    const mockRagService = {
        checkStatus: async () => ({ server_up: true, index_ready: true, data_loaded: true }),
        search: async () => mockTextResult
    };

    it('should return fused results when both services are available', async function () {
        const service = new HybridSearchService({
            visualSearchClient: mockVisualClient,
            ragService: mockRagService
        });

        // Force availability check
        await service.isAvailable();

        const results = await service.search('test query');
        
        assert.ok(results.results.length > 0, 'Should return results');
        assert.strictEqual(results.sources.visual, true, 'Visual source should be active');
        assert.strictEqual(results.sources.text, true, 'Text source should be active');
        assert.ok(results.fusionStats, 'Fusion telemetry should be present');
        assert.strictEqual(results.fusionStats.fusionMethod, 'weighted_score');

        // Check fusion (docId 101 from visual, docId 102 from text)
        const docIds = results.results.map(r => r.docId);
        assert.ok(docIds.includes(101));
        assert.ok(docIds.includes(102));
    });

    it('should apply default weighted fusion formula (visual 0.7, text 0.3)', async function () {
        const weightedVisualClient = {
            isAvailable: async () => true,
            search: async () => ({
                results: [
                    { docId: 201, pageNum: 1, score: 0.9 },
                    { docId: 202, pageNum: 1, score: 0.4 }
                ]
            })
        };
        const weightedRagService = {
            checkStatus: async () => ({
                server_up: true,
                index_ready: true,
                data_loaded: true
            }),
            search: async () => ([
                { docId: 201, score: 0.5, title: 'Overlap' },
                { docId: 203, score: 0.95, title: 'Text-only' }
            ])
        };
        const service = new HybridSearchService({
            visualSearchClient: weightedVisualClient,
            ragService: weightedRagService
        });

        await service.isAvailable();
        const output = await service.search('weighted');

        const overlap = output.results.find(r => r.docId === 201);
        assert.ok(overlap, 'Overlapping doc should exist');
        assert.strictEqual(
            Number(overlap.fusedScore.toFixed(4)),
            Number(((0.9 * 0.7) + (0.5 * 0.3)).toFixed(4))
        );
        assert.strictEqual(overlap.source, 'hybrid');
        assert.strictEqual(overlap.inBoth, true);
    });

    it('should deduplicate results by docId using the best source score', async function () {
        const dedupeVisualClient = {
            isAvailable: async () => true,
            search: async () => ({
                results: [
                    { docId: 301, pageNum: 1, score: 0.2 },
                    { docId: 301, pageNum: 2, score: 0.8 }
                ]
            })
        };
        const emptyRagService = {
            checkStatus: async () => ({
                server_up: true,
                index_ready: false,
                data_loaded: false
            }),
            search: async () => []
        };
        const service = new HybridSearchService({
            visualSearchClient: dedupeVisualClient,
            ragService: emptyRagService
        });

        await service.isAvailable();
        const output = await service.search('dedupe');
        const deduped = output.results.filter(result => result.docId === 301);

        assert.strictEqual(deduped.length, 1, 'docId should be deduplicated');
        assert.strictEqual(deduped[0].pageNum, 2, 'Best visual score should win');
        assert.strictEqual(output.fusionStats.visualInputCount, 2);
        assert.strictEqual(output.fusionStats.visualDedupedCount, 1);
    });

    it('should fallback to text RAG when visual confidence is below threshold', async function () {
        const lowConfidenceVisualClient = {
            isAvailable: async () => true,
            search: async () => ({
                results: [
                    { docId: 401, pageNum: 1, score: 0.62 }
                ]
            })
        };
        const lowConfidenceTextService = {
            checkStatus: async () => ({
                server_up: true,
                index_ready: true,
                data_loaded: true
            }),
            search: async () => ([
                { docId: 402, score: 0.92, title: 'Text Winner' },
                { docId: 403, score: 0.73, title: 'Text Runner-Up' }
            ])
        };
        const service = new HybridSearchService({
            visualSearchClient: lowConfidenceVisualClient,
            ragService: lowConfidenceTextService
        });

        await service.isAvailable();
        const output = await service.search('fallback query', { maxResults: 2 });

        assert.strictEqual(output.fallbackUsed, 'text-rag');
        assert.strictEqual(output.fallbackReason, 'visual_low_confidence');
        assert.strictEqual(
            Number(output.originalVisualConfidence.toFixed(2)),
            0.62
        );
        assert.strictEqual(output.fusionStats.fusionMethod,
            'text_fallback_low_visual_confidence');
        assert.strictEqual(output.fusionStats.confidenceThreshold, 0.7);
        assert.strictEqual(output.fusionStats.fallbackLatencyTargetMs, 1000);
        assert.ok(typeof output.fusionStats.fallbackLatencyMs === 'number');
        assert.ok(output.fusionStats.fallbackLatencyMs >= 0);
        assert.strictEqual(output.results.length, 2);
        assert.strictEqual(output.results[0].source, 'text');
    });

    it('should keep weighted fusion when visual confidence is above threshold', async function () {
        const highConfidenceVisualClient = {
            isAvailable: async () => true,
            search: async () => ({
                results: [
                    { docId: 501, pageNum: 1, score: 0.88 }
                ]
            })
        };
        const highConfidenceTextService = {
            checkStatus: async () => ({
                server_up: true,
                index_ready: true,
                data_loaded: true
            }),
            search: async () => ([
                { docId: 502, score: 0.91, title: 'Text result' }
            ])
        };
        const service = new HybridSearchService({
            visualSearchClient: highConfidenceVisualClient,
            ragService: highConfidenceTextService
        });

        await service.isAvailable();
        const output = await service.search('no fallback query');

        assert.strictEqual(output.fallbackUsed, undefined);
        assert.strictEqual(output.fusionStats.fusionMethod, 'weighted_score');
        assert.ok(output.results.some(r => r.docId === 501));
        assert.ok(output.results.some(r => r.docId === 502));
    });

    it('should fallback to text search when visual sidecar is unavailable', async function () {
        const unavailableVisualClient = {
            isAvailable: async () => false,
            search: async () => { throw new Error('Unavailable'); }
        };

        const service = new HybridSearchService({
            visualSearchClient: unavailableVisualClient,
            ragService: mockRagService
        });

        await service.isAvailable();

        const results = await service.search('test query');

        assert.ok(results.results.length > 0, 'Should return results from text fallback');
        assert.strictEqual(results.sources.visual, false, 'Visual source should be inactive');
        assert.strictEqual(results.sources.text, true, 'Text source should be active');
        
        // Verify result comes from text source
        const firstResult = results.results[0];
        assert.strictEqual(firstResult.docId, 102);
        assert.strictEqual(firstResult.source, 'text');
    });

    it('should fallback to visual search when text RAG is unavailable', async function () {
        const unavailableRagService = {
            checkStatus: async () => ({ server_up: true, index_ready: false }),
            search: async () => []
        };

        const service = new HybridSearchService({
            visualSearchClient: mockVisualClient,
            ragService: unavailableRagService
        });

        await service.isAvailable();

        const results = await service.search('test query');

        assert.ok(results.results.length > 0, 'Should return results from visual fallback');
        assert.strictEqual(results.sources.visual, true, 'Visual source should be active');
        assert.strictEqual(results.sources.text, false, 'Text source should be inactive');
        
        const firstResult = results.results[0];
        assert.strictEqual(firstResult.docId, 101);
        assert.strictEqual(firstResult.source, 'visual');
    });

    it('should return empty results when both services are unavailable', async function () {
        const unavailableVisualClient = {
            isAvailable: async () => false,
            search: async () => { throw new Error('Unavailable'); }
        };
        const unavailableRagService = {
            checkStatus: async () => ({ server_up: false }),
            search: async () => []
        };

        const service = new HybridSearchService({
            visualSearchClient: unavailableVisualClient,
            ragService: unavailableRagService
        });

        await service.isAvailable();

        const results = await service.search('test query');

        assert.strictEqual(results.totalResults, 0);
        assert.strictEqual(results.sources.visual, false);
        assert.strictEqual(results.sources.text, false);
    });

    it('should maintain response shape contract', async function () {
        const service = new HybridSearchService({
            visualSearchClient: mockVisualClient,
            ragService: mockRagService
        });

        const results = await service.search('test');

        assert.ok(Array.isArray(results.results));
        assert.ok(typeof results.totalResults === 'number');
        assert.ok(results.sources);
        
        if (results.results.length > 0) {
            const item = results.results[0];
            assert.ok(item.docId);
            assert.ok(typeof item.fusedScore === 'number' || typeof item.score === 'number');
        }
    });
});
