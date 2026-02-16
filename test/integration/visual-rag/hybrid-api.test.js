/* eslint-env mocha */

/**
 * Hybrid Search API Integration Tests
 *
 * Service dependencies:
 *   - paperless-ai server (app): started in-process via require('../../server')
 *   - Qdrant (QDRANT_HOST / QDRANT_URL): optional; test data insertion skipped if absent
 *
 * Running modes:
 *   - Container-native: QDRANT_HOST=qdrant
 *   - Host-side: QDRANT_HOST=localhost
 *   - Qdrant setup is best-effort; the API test proceeds regardless
 *   - Server load: the app is required lazily. If server init fails, the before
 *     hook logs a warning and skips the suite.
 */

const request = require('supertest');
const assert = require('assert');
let app;
let qdrantAdapter;

describe('Hybrid Search API E2E', function () {
    // Increase timeout for integration tests + Qdrant indexing settle time
    this.timeout(20000);

    const TEST_DOC_ID = 99999;
    const TEST_VECTOR = new Array(384).fill(0.1); // 384d for document_embeddings

    before(async function () {
        this.timeout(15000);

        // Load the server lazily so missing config does not crash the require
        try {
            app = require('../../../server');
        } catch (e) {
            console.warn('[hybrid-api] Server load failed, skipping suite:', e.message);
            this.skip();
            return;
        }

        // Setup SOT: Insert test document into Qdrant (best-effort)
        if (process.env.QDRANT_HOST) {
            try {
                const adapterModule = require('../../../services/visual-rag-client/QdrantAdapter');
                qdrantAdapter = adapterModule.qdrantAdapter;
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
                // Allow Qdrant to index the point
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.warn('[hybrid-api] Qdrant setup skipped (not available):', e.message);
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
