/* eslint-env mocha */
const assert = require('assert');
const { QdrantAdapter, COLLECTIONS } = require('../../services/visual-rag-client/QdrantAdapter');
const HOST = process.env.QDRANT_HOST || 'localhost';
const PORT = parseInt(process.env.QDRANT_PORT || '6333');

describe('QdrantAdapter Unit Tests', function () {
    it('should upsert visual overlays and call client.upsert with correct args', async function () {
        const adapter = new QdrantAdapter({ host: HOST, port: PORT });
        let called = false;
        const saved = {};
        adapter.client = {
            upsert: async (collectionName, { points }) => {
                called = true;
                saved.collection = collectionName;
                saved.points = points;
                return;
            },
            getCollections: async () => ({ collections: [] })
        };

        const points = [ { id: 'p1', embedding: [0.1, 0.2], payload: { doc_id: 1 } } ];
        const res = await adapter.upsertVisualOverlays(points);

        assert.ok(called, 'client.upsert should be called');
        assert.strictEqual(saved.collection, COLLECTIONS.visual_overlays.name);
        assert.strictEqual(res.status, 'ok');
        assert.strictEqual(res.count, 1);
    });

    it('should search visual overlays and return mapped results', async function () {
        const adapter = new QdrantAdapter({ host: HOST, port: PORT });
        adapter.client = {
            search: async (collectionName, { vector, limit }) => [
                { id: 'p1', score: 0.98, payload: { doc_id: 1, semantic_label: 'test' } }
            ]
        };

        const results = await adapter.searchVisualOverlays([0.1, 0.2], { limit: 5 });
        assert.ok(Array.isArray(results));
        assert.strictEqual(results[0].id, 'p1');
        assert.strictEqual(results[0].payload.semantic_label, 'test');
    });

    it('should delete visual overlays by doc id and return ok', async function () {
        const adapter = new QdrantAdapter({ host: HOST, port: PORT });
        let deleteCalled = false;
        adapter.client = {
            delete: async (collectionName, body) => { deleteCalled = true; return; }
        };

        const res = await adapter.deleteVisualOverlaysByDocId(42);
        assert.ok(deleteCalled);
        assert.strictEqual(res.status, 'ok');
    });

    it('should get a point via getPoint and return payload', async function () {
        const adapter = new QdrantAdapter({ host: HOST, port: PORT });
        adapter.client = {
            getPoint: async (collectionName, id) => ({ id, payload: { doc_id: 2 } })
        };

        const point = await adapter.getPoint('visual_overlays', 'p1');
        assert.ok(point);
        assert.strictEqual(point.payload.doc_id, 2);
    });

    it('healthCheck should reflect collections existence', async function () {
        const adapter = new QdrantAdapter({ host: HOST, port: PORT });
        adapter.client = {
            getCollections: async () => ({ collections: [{ name: COLLECTIONS.visual_overlays.name }] })
        };

        const status = await adapter.healthCheck();
        assert.strictEqual(status.healthy, true);
        assert.ok(status.collections.visual_overlays.exists);
    });

    it('should upsert document embeddings', async function () {
        const adapter = new QdrantAdapter({ host: HOST, port: PORT });
        let called = false;
        adapter.client = {
            upsert: async (collectionName, { points }) => { called = true; return; }
        };

        const docs = [{ id: 'doc_1', embedding: new Array(384).fill(0.01), payload: { doc_id: 1 } }];
        const res = await adapter.upsertDocumentEmbeddings(docs);
        assert.ok(called);
        assert.strictEqual(res.status, 'ok');
        assert.strictEqual(res.count, 1);
    });
});
