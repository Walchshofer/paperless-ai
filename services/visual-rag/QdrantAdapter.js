/**
 * QdrantAdapter.js
 * Native Protocol Alpha-9 Compliant Adapter
 * Provides named collections and helper methods for document embeddings,
 * visual_overlays (320D Cosine) and visual_pages (320D Dot)
 */

const { QdrantClient } = require('@qdrant/js-client-rest');

const COLLECTIONS = {
    document_embeddings: { name: 'document_embeddings', vectorSize: 384, distance: 'Cosine' },
    visual_overlays: { name: 'visual_overlays', vectorSize: 320, distance: 'Cosine' },
    visual_pages: { name: 'visual_pages', vectorSize: 320, distance: 'Dot' }
};

class QdrantAdapter {
    constructor(options = {}) {
        this.client = null;
        this.host = options.host || process.env.QDRANT_HOST || 'qdrant';
        this.port = parseInt(options.port || process.env.QDRANT_PORT || '6333', 10);
    }

    async initialize() {
        if (this.client) return;

        this.client = new QdrantClient({
            url: `http://${this.host}:${this.port}`,
            apiKey: process.env.QDRANT_API_KEY
        });

        await this._ensureCollections();
    }

    async _ensureCollections() {
        try {
            const result = await this.client.getCollections();
            const existing = new Set(result.collections.map(c => c.name));

            for (const key of Object.keys(COLLECTIONS)) {
                const cfg = COLLECTIONS[key];
                if (!existing.has(cfg.name)) {
                    await this.client.createCollection(cfg.name, {
                        vectors: { size: cfg.vectorSize, distance: cfg.distance }
                    });

                    // Common payload indexes for filtering
                    await Promise.all([
                        this.client.createPayloadIndex(cfg.name, { field_name: 'doc_id', field_schema: 'integer' }),
                        this.client.createPayloadIndex(cfg.name, { field_name: 'correspondent_id', field_schema: 'integer' }),
                        this.client.createPayloadIndex(cfg.name, { field_name: 'tag_ids', field_schema: 'integer' })
                    ]).catch(() => {});
                }
            }
        } catch (err) {
            // Surface a helpful error for diagnostics
            console.error('[Qdrant] _ensureCollections failed:', err && err.message);
            throw err;
        }
    }

    async healthCheck() {
        try {
            if (!this.client) await this.initialize();
            const info = await this.client.getCollections();
            const collections = {};
            for (const key of Object.keys(COLLECTIONS)) {
                const cfg = COLLECTIONS[key];
                const found = info.collections.find(c => c.name === cfg.name);
                collections[key] = {
                    vectorSize: cfg.vectorSize,
                    distance: cfg.distance,
                    exists: !!found
                };
            }
            return { healthy: true, collections };
        } catch (err) {
            return { healthy: false, error: err.message, collections: null };
        }
    }

    // Generic upsert helper
    async _upsertCollection(collectionName, points = []) {
        if (!this.client) await this.initialize();
        const qPoints = points.map(p => ({ id: p.id, vector: p.embedding || p.vector || p.vec, payload: p.payload || {} }));
        await this.client.upsert(collectionName, { points: qPoints });
        return { status: 'ok', count: qPoints.length };
    }

    async _searchCollection(collectionName, vector, opts = {}) {
        if (!this.client) await this.initialize();
        const limit = opts.limit || 5;
        const res = await this.client.search(collectionName, { vector, limit, with_payload: true });
        return (res || []).map(r => ({ id: r.id, score: r.score, payload: r.payload || {} }));
    }

    async _deleteByFilter(collectionName, filter) {
        if (!this.client) await this.initialize();
        try {
            await this.client.delete(collectionName, { filter });
            return { status: 'ok' };
        } catch (err) {
            // Best-effort: return ok but surface the error in logs
            console.warn(`[QdrantAdapter] delete failed for ${collectionName}: ${err.message}`);
            return { status: 'ok', warning: err.message };
        }
    }

    // Document embeddings (384D, Cosine)
    async upsertDocumentEmbeddings(points = []) {
        return this._upsertCollection(COLLECTIONS.document_embeddings.name, points);
    }

    async searchDocumentEmbeddings(vector, opts = {}) {
        return this._searchCollection(COLLECTIONS.document_embeddings.name, vector, opts);
    }

    async deleteDocumentEmbeddings(ids = []) {
        // delete by point ids
        if (!this.client) await this.initialize();
        try {
            await this.client.delete(COLLECTIONS.document_embeddings.name, { points: ids });
            return { status: 'ok' };
        } catch (err) {
            console.warn('[QdrantAdapter] deleteDocumentEmbeddings failed:', err.message);
            return { status: 'ok', warning: err.message };
        }
    }

    // Visual Overlays (320D, Cosine)
    async upsertVisualOverlays(points = []) {
        return this._upsertCollection(COLLECTIONS.visual_overlays.name, points);
    }

    async searchVisualOverlays(vector, opts = {}) {
        return this._searchCollection(COLLECTIONS.visual_overlays.name, vector, opts);
    }

    async deleteVisualOverlaysByDocId(docId) {
        const filter = { must: [{ key: 'doc_id', match: { value: docId } }] };
        return this._deleteByFilter(COLLECTIONS.visual_overlays.name, filter);
    }

    // Visual Pages (320D, Dot)
    async upsertVisualPages(points = []) {
        return this._upsertCollection(COLLECTIONS.visual_pages.name, points);
    }

    async searchVisualPages(vector, opts = {}) {
        return this._searchCollection(COLLECTIONS.visual_pages.name, vector, opts);
    }

    async deleteVisualPagesByDocId(docId) {
        const filter = { must: [{ key: 'doc_id', match: { value: docId } }] };
        return this._deleteByFilter(COLLECTIONS.visual_pages.name, filter);
    }

    async getPoint(collectionName, id) {
        if (!this.client) await this.initialize();
        try {
            // Qdrant REST client provides a getPoint method
            const resp = await this.client.getPoint(collectionName, id);
            return resp;
        } catch (err) {
            console.warn(`[QdrantAdapter] getPoint failed for ${collectionName}/${id}: ${err.message}`);
            return null;
        }
    }

    /**
     * Update payload fields for all points belonging to a doc_id in a collection.
     * This is best-effort and performed in-place by re-upserting existing points
     * with their original vector and merged payload.
     * @param {string} collectionName
     * @param {number} docId
     * @param {object} fields - key/value pairs to merge into payload
     */
    async updatePayloadForDoc(collectionName, docId, fields = {}) {
        if (!this.client) await this.initialize();
        try {
            // Find points by doc_id filter
            const filter = { must: [{ key: 'doc_id', match: { value: docId } }] };
            const res = await this.client.search(collectionName, { vector: [0], filter, limit: 100, with_payload: true, with_vector: true });

            // If none found, nothing to update (best-effort)
            if (!res || res.length === 0) return { status: 'ok', updated: 0 };

            const pointsToUpsert = res.map(r => {
                const mergedPayload = Object.assign({}, r.payload || {}, fields);
                return { id: r.id, vector: r.vector || null, payload: mergedPayload };
            });

            // Upsert (replaces existing payload)
            await this.client.upsert(collectionName, { points: pointsToUpsert });
            return { status: 'ok', updated: pointsToUpsert.length };
        } catch (err) {
            console.warn(`[QdrantAdapter] updatePayloadForDoc failed for ${collectionName}/${docId}: ${err.message}`);
            return { status: 'error', error: err.message };
        }
    }
}

// Exports: named class + singleton for convenience
module.exports = { QdrantAdapter, COLLECTIONS, qdrantAdapter: new QdrantAdapter() };