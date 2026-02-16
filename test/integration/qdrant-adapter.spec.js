/* eslint-env mocha */

/**
 * Integration tests for QdrantAdapter
 *
 * These tests verify the Qdrant adapter functionality.
 * Requires a running Qdrant instance (docker-compose up qdrant).
 *
 * Run with: npm test -- test/integration/qdrant-adapter.spec.js
 */

const assert = require('assert');
const { randomUUID } = require('crypto');
const { QdrantAdapter, COLLECTIONS } = require('../../services/visual-rag-client/QdrantAdapter');

describe('QdrantAdapter Integration Tests', function () {
    this.timeout(30000); // Allow time for Qdrant operations

    let adapter;
    const testDocId = randomUUID();
    const testDocNumeric = Date.now();

    before(async function () {
        // Skip if QDRANT_HOST not set (CI without Qdrant)
        if (!process.env.QDRANT_HOST && !process.env.RUN_QDRANT_TESTS) {
            this.skip();
            return;
        }

        adapter = new QdrantAdapter({
            host: process.env.QDRANT_HOST || 'localhost',
            port: parseInt(process.env.QDRANT_PORT, 10) || 6333
        });

        await adapter.initialize();
    });

    after(async function () {
        // Cleanup test data
        if (adapter) {
            try {
                await adapter.deleteDocumentEmbeddings([testDocId]);
                await adapter.deleteVisualOverlaysByDocId(testDocNumeric);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    });

    describe('Health Check', function () {
        it('should return healthy status', async function () {
            const status = await adapter.healthCheck();

            assert.strictEqual(status.healthy, true, 'Should be healthy');
            assert.ok(status.collections, 'Should have collections info');
            assert.ok(status.collections.document_embeddings, 'Should have document_embeddings');
            assert.ok(status.collections.visual_overlays, 'Should have visual_overlays');
            assert.ok(status.collections.visual_pages, 'Should have visual_pages');
        });

        it('should report correct vector dimensions', async function () {
            const status = await adapter.healthCheck();

            assert.strictEqual(
                status.collections.document_embeddings.vectorSize,
                384,
                'document_embeddings should be 384D'
            );
            assert.strictEqual(
                status.collections.visual_overlays.vectorSize,
                320,
                'visual_overlays should be 320D'
            );
            assert.strictEqual(
                status.collections.visual_pages.vectorSize,
                320,
                'visual_pages should be 320D'
            );
        });
    });

    describe('Document Embeddings (384D)', function () {
        const testEmbedding = new Array(384).fill(0).map(() => Math.random());

        it('should upsert document embeddings', async function () {
            const result = await adapter.upsertDocumentEmbeddings([
                {
                    id: testDocId,
                    embedding: testEmbedding,
                    payload: {
                        title: 'Test Document',
                        doc_id: 12345,
                        correspondent: 'Test Corp'
                    }
                }
            ]);

            assert.strictEqual(result.status, 'ok');
            assert.strictEqual(result.count, 1);
        });

        it('should search document embeddings', async function () {
            // Wait for indexing
            await new Promise(resolve => setTimeout(resolve, 500));

            const results = await adapter.searchDocumentEmbeddings(testEmbedding, {
                limit: 5
            });

            assert.ok(Array.isArray(results), 'Should return array');
            assert.ok(results.length > 0, 'Should find at least one result');

            const found = results.find(r => r.id === testDocId);
            assert.ok(found, 'Should find the test document');
            assert.ok(found.score > 0.9, 'Score should be high for same vector');
            assert.strictEqual(found.payload.title, 'Test Document');
        });

        it('should delete document embeddings', async function () {
            const result = await adapter.deleteDocumentEmbeddings([testDocId]);
            assert.strictEqual(result.status, 'ok');
        });
    });

    describe('Visual Overlays (320D)', function () {
        const testEmbedding = new Array(320).fill(0).map(() => Math.random());
        const overlayId = randomUUID();
        const docId = testDocNumeric;

        it('should upsert visual overlays', async function () {
            const result = await adapter.upsertVisualOverlays([
                {
                    id: overlayId,
                    embedding: testEmbedding,
                    payload: {
                        doc_id: docId,
                        page_number: 1,
                        semantic_label: 'table',
                        bbox: [10, 20, 100, 200]
                    }
                }
            ]);

            assert.strictEqual(result.status, 'ok');
            assert.strictEqual(result.count, 1);
        });

        it('should search visual overlays', async function () {
            await new Promise(resolve => setTimeout(resolve, 500));

            const results = await adapter.searchVisualOverlays(testEmbedding, {
                limit: 5
            });

            assert.ok(Array.isArray(results));
            assert.ok(results.length > 0);

            const found = results.find(r => r.id === overlayId);
            assert.ok(found, 'Should find the test overlay');
            assert.strictEqual(found.payload.semantic_label, 'table');
        });

        it('should delete visual overlays by doc_id', async function () {
            const result = await adapter.deleteVisualOverlaysByDocId(docId);
            assert.strictEqual(result.status, 'ok');
        });
    });

    describe('Visual Pages (320D, Dot Product)', function () {
        const testEmbedding = new Array(320).fill(0).map(() => Math.random());
        const pageId = randomUUID();
        const docId = Date.now();

        it('should upsert visual pages', async function () {
            const result = await adapter.upsertVisualPages([
                {
                    id: pageId,
                    embedding: testEmbedding,
                    payload: {
                        doc_id: docId,
                        page_num: 1,
                        file_path: '/media/documents/test.pdf'
                    }
                }
            ]);

            assert.strictEqual(result.status, 'ok');
            assert.strictEqual(result.count, 1);
        });

        it('should search visual pages', async function () {
            await new Promise(resolve => setTimeout(resolve, 500));

            const results = await adapter.searchVisualPages(testEmbedding, {
                limit: 5
            });

            assert.ok(Array.isArray(results));
            assert.ok(results.length > 0);

            const found = results.find(r => r.id === pageId);
            assert.ok(found, 'Should find the test page');
        });

        it('should delete visual pages by doc_id', async function () {
            const result = await adapter.deleteVisualPagesByDocId(docId);
            assert.strictEqual(result.status, 'ok');
        });
    });

    describe('Collection Constants', function () {
        it('should export correct collection configurations', function () {
            assert.ok(COLLECTIONS.document_embeddings);
            assert.strictEqual(COLLECTIONS.document_embeddings.vectorSize, 384);
            assert.strictEqual(COLLECTIONS.document_embeddings.distance, 'Cosine');

            assert.ok(COLLECTIONS.visual_overlays);
            assert.strictEqual(COLLECTIONS.visual_overlays.vectorSize, 320);
            assert.strictEqual(COLLECTIONS.visual_overlays.distance, 'Cosine');

            assert.ok(COLLECTIONS.visual_pages);
            assert.strictEqual(COLLECTIONS.visual_pages.vectorSize, 320);
            assert.strictEqual(COLLECTIONS.visual_pages.distance, 'Dot');
        });
    });
});
