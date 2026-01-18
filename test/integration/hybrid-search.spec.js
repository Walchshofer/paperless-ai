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
        
        // Check fusion (docId 101 from visual, docId 102 from text)
        const docIds = results.results.map(r => r.docId);
        assert.ok(docIds.includes(101));
        assert.ok(docIds.includes(102));
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
