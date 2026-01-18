/* eslint-env mocha */
const request = require('supertest');
const assert = require('assert');
const app = require('../../../server');
const { qdrantAdapter } = require('../../../services/visual-rag-client/QdrantAdapter');

describe('Hybrid Search API E2E', function () {
    // Increase timeout for integration tests
    this.timeout(10000);

    const TEST_DOC_ID = 99999;
    const TEST_VECTOR = new Array(384).fill(0.1); // 384d for document_embeddings

    before(async function () {
        // Setup SOT: Insert test document into Qdrant
        if (process.env.QDRANT_HOST) {
            try {
                await qdrantAdapter.initialize();
                await qdrantAdapter.upsertDocumentEmbeddings([{
                    id: `doc_${TEST_DOC_ID}`,
                    embedding: TEST_VECTOR,
                    payload: {
                        doc_id: TEST_DOC_ID,
                        title: 'Hybrid API Test Document',
                        content: 'This is a test document for hybrid search API.',
                        correspondent: 'Test Corp'
                    }
                }]);
                // Wait for indexing
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.warn('Skipping Qdrant setup in API test (not available)', e.message);
            }
        }
    });

    after(async function () {
        if (process.env.QDRANT_HOST) {
            try {
                await qdrantAdapter.deleteDocumentEmbeddings([`doc_${TEST_DOC_ID}`]);
            } catch (e) {
                // ignore
            }
        }
    });

    it('POST /api/visual-rag/search should return fused results', async function () {
        const res = await request(app)
            .post('/api/visual-rag/search')
            .send({
                query: 'test document',
                k: 5,
                mode: 'hybrid'
            })
            .expect('Content-Type', /json/)
            .expect(200);

        assert.strictEqual(res.body.success, true);
        assert.ok(Array.isArray(res.body.results));
        assert.ok(res.body.totalResults >= 0);
        
        // If we have results, verify shape
        if (res.body.results.length > 0) {
            const item = res.body.results[0];
            assert.ok(item.docId);
            assert.ok(item.score !== undefined || item.fusedScore !== undefined);
        }
    });

    it('POST /api/visual-rag/search should handle text fallback gracefully', async function () {
        // We can't easily kill the sidecar from here, but we can verify the API doesn't crash
        // and returns a valid structure even if visual search returns nothing (simulated by query)
        
        const res = await request(app)
            .post('/api/visual-rag/search')
            .send({
                query: 'nonexistent_visual_query_fallback_test',
                k: 5,
                mode: 'hybrid'
            })
            .expect(200);

        assert.strictEqual(res.body.success, true);
        assert.ok(Array.isArray(res.body.results));
    });
});
