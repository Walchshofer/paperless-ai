/**
 * QdrantAdapter.js
 *
 * Singleton adapter for Qdrant vector database operations.
 * Enforces Distance Metric Locks and integrates with global Circuit Breaker.
 *
 * Architecture Reference: Native Protocol Alpha-9
 * Epic: Structured Feature Development Workflow
 * Ticket: P1.1 Implement Singleton QdrantAdapter with Distance Metric Locks
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const { CircuitBreaker } = require('../experts/CircuitBreaker');
const logger = require('../logger');
const config = require('../../config/config');

const COLLECTIONS = {
    document_embeddings: { name: 'document_embeddings', vectorSize: 384, distance: 'Cosine' },
    visual_overlays: { name: 'visual_overlays', vectorSize: 320, distance: 'Cosine' },
    visual_pages: { name: 'visual_pages', vectorSize: 320, distance: 'Dot' }
};

class QdrantAdapter {
    constructor(options = {}) {
        if (QdrantAdapter.instance && Object.keys(options).length === 0) {
            return QdrantAdapter.instance;
        }

        // Initialize configuration
        const qdrantConfig = config.qdrant || {};
        const host = options.host || process.env.QDRANT_HOST || qdrantConfig.host || 'qdrant';
        const port = options.port || parseInt(process.env.QDRANT_PORT || qdrantConfig.port || '6333');
        const apiKey = options.apiKey || process.env.QDRANT_API_KEY || qdrantConfig.apiKey;
        const url = `http://${host}:${port}`;

        // Initialize Qdrant Client
        const checkCompatibility = (qdrantConfig && typeof qdrantConfig.checkCompatibility !== 'undefined') ? qdrantConfig.checkCompatibility : (process.env.QDRANT_CHECK_COMPATIBILITY !== 'false');
        this.client = new QdrantClient({
            url,
            apiKey,
            checkCompatibility
        });

        let clientVersion = 'unknown';
        try {
            clientVersion = require('@qdrant/js-client-rest/package.json').version;
        } catch (err) {
            logger.warn('[QdrantAdapter] Could not read @qdrant/js-client-rest version: ' + (err && err.message));
        }

        logger.info(`[QdrantAdapter] Initialized client at ${url} (client=${clientVersion}, checkCompatibility=${checkCompatibility})`);

        // Initialize Circuit Breaker for Qdrant operations
        // We use a dedicated breaker instance for vector DB operations
        this.circuitBreaker = CircuitBreaker.getInstance('qdrant-adapter', {
            failureThreshold: 5,
            cooldownPeriod: 30000,
            timeout: 10000, // Vector operations can be heavy
        });

        logger.info(`[QdrantAdapter] Initialized client at ${url}`);

        if (Object.keys(options).length === 0) {
            QdrantAdapter.instance = this;
        }
    }

    /**
     * Get the singleton instance
     * @returns {QdrantAdapter}
     */
    static getInstance() {
        if (!QdrantAdapter.instance) {
            QdrantAdapter.instance = new QdrantAdapter();
        }
        return QdrantAdapter.instance;
    }

    /**
     * Ensure a collection exists with the correct configuration (Distance Metric Lock)
     * @param {string} name - Collection name
     * @param {Object} vectorConfig - Vector configuration (size, distance)
     * @returns {Promise<void>}
     */
    async ensureCollection(name, vectorConfig) {
        const result = await this.circuitBreaker.execute(async () => {
            const exists = await this._collectionExists(name);

            if (exists) {
                const info = await this.client.getCollection(name);
                this._validateDistanceMetric(name, info, vectorConfig);
                logger.info(`[QdrantAdapter] Collection '${name}' verified`);
            } else {
                logger.info(`[QdrantAdapter] Creating collection '${name}'`);
                await this.client.createCollection(name, {
                    vectors: vectorConfig
                });
            }
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error(`Failed to ensure collection ${name}`);
        }
    }

    /**
     * Batch upsert points
     * @param {string} collection 
     * @param {Array} points 
     * @returns {Promise<Object>}
     */
    async upsert(collection, points) {
        const result = await this.circuitBreaker.execute(async () => {
            return await this.client.upsert(collection, {
                points
            });
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error(`Upsert failed for ${collection}`);
        }

        // Normalize to legacy helper response: { status: 'ok', count: N }
        const count = Array.isArray(points) ? points.length : (points && points.points ? points.points.length : 1);
        return { status: 'ok', count };
    }

    /**
     * Search for points
     * @param {string} collection 
     * @param {Object} options - { vector, filter, limit, with_payload }
     * @returns {Promise<Array>}
     */
    async search(collection, options) {
        const result = await this.circuitBreaker.execute(async () => {
            return await this.client.search(collection, options);
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error(`Search failed for ${collection}`);
        }
        return result.data;
    }

    /**
     * Delete points by document ID
     * @param {string} collection 
     * @param {number|string} docId 
     * @returns {Promise<Object>}
     */
    async deleteByDocId(collection, docId) {
        const result = await this.circuitBreaker.execute(async () => {
            return await this.client.delete(collection, {
                filter: {
                    must: [
                        {
                            key: 'doc_id',
                            match: {
                                value: docId
                            }
                        }
                    ]
                }
            });
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error(`Delete failed for ${collection} docId=${docId}`);
        }

        // Return legacy-style success object
        return { status: 'ok' };
    }

    /**
     * Delete points by explicit point IDs
     * @param {string} collection
     * @param {Array<string|number>} pointIds
     * @returns {Promise<Object>}
     */
    async deleteByIds(collection, pointIds) {
        const ids = Array.isArray(pointIds) ? pointIds : [pointIds];
        const result = await this.circuitBreaker.execute(async () => {
            return await this.client.delete(collection, {
                points: ids
            });
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error(`Delete failed for ${collection} ids=${ids.length}`);
        }

        return { status: 'ok' };
    }

    /**
     * Update payload for a document across standard collections
     * @param {number|string} docId 
     * @param {Object} metadata 
     * @returns {Promise<Object>}
     */
    async updatePayload(docId, metadata) {
        const collections = ['visual_pages', 'visual_overlays'];
        const errors = [];
        const results = {};

        // Fail fast if circuit is open
        if (this.circuitBreaker.isOpen()) {
            throw new Error('Circuit breaker is OPEN, skipping payload update');
        }

        for (const collection of collections) {
            try {
                // 1. Find points for this doc_id
                const points = await this._getPointsByDocId(collection, docId);
                
                if (points.length === 0) {
                    results[collection] = { status: 'skipped', reason: 'no_points_found' };
                    continue;
                }

                const pointIds = points.map(p => p.id);

                // 2. Update payload
                const result = await this.circuitBreaker.execute(async () => {
                    await this.client.setPayload(collection, {
                        points: pointIds,
                        payload: metadata
                    });
                });

                if (result.fallback || !result.success) {
                    throw result.error || new Error(`Payload update failed for ${collection}`);
                }

                results[collection] = { status: 'updated', count: pointIds.length };

            } catch (err) {
                logger.error(`[QdrantAdapter] Failed to update payload for ${collection} docId=${docId}: ${err.message}`);
                errors.push({ collection, error: err.message });
                results[collection] = { status: 'failed', error: err.message };
            }
        }

        if (errors.length > 0) {
            const errorMsg = `Partial sync failure: ${errors.map(e => `${e.collection} (${e.error})`).join(', ')}`;
            const error = new Error(errorMsg);
            error.results = results;
            throw error;
        }

        return results;
    }

    /**
     * Get all collections
     * @returns {Promise<Object>}
     */
    async getCollections() {
        const result = await this.circuitBreaker.execute(async () => {
            return await this.client.getCollections();
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error('Failed to list collections');
        }
        return result.data;
    }

    /**
     * Get specific collection info
     * @param {string} name 
     * @returns {Promise<Object>}
     */
    async getCollection(name) {
        const result = await this.circuitBreaker.execute(async () => {
            return await this.client.getCollection(name);
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error(`Failed to get collection info for ${name}`);
        }
        return result.data;
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    async _collectionExists(name) {
        try {
            const result = await this.client.getCollections();
            return result.collections.some(c => c.name === name);
        } catch (error) {
            logger.error(`[QdrantAdapter] Failed to list collections: ${error.message}`);
            throw error;
        }
    }

    async _getPointsByDocId(collection, docId) {
        const result = await this.circuitBreaker.execute(async () => {
            let allPoints = [];
            let offset = null;
            
            do {
                const response = await this.client.scroll(collection, {
                    filter: {
                        must: [{ key: 'doc_id', match: { value: docId } }]
                    },
                    limit: 100,
                    offset: offset,
                    with_payload: false,
                    with_vector: false
                });
                
                allPoints = allPoints.concat(response.points);
                offset = response.next_page_offset;
                
            } while (offset);
            
            return allPoints;
        });

        if (result.fallback || !result.success) {
            throw result.error || new Error(`Failed to scroll points for ${collection}`);
        }
        return result.data;
    }

    _validateDistanceMetric(name, info, expectedConfig) {
        const actualVectors = info.config.params.vectors;
        
        // Helper to check distance match
        const checkDistance = (actual, expected) => {
            if (actual && expected && actual.toLowerCase() !== expected.toLowerCase()) {
                throw new Error(`Distance Metric Lock violation: Collection '${name}' has distance '${actual}' but expected '${expected}'. This is a critical error - MaxSim scoring requires correct distance metric.`);
            }
        };

        // Case 1: Expected is simple configuration (has distance property directly)
        if (expectedConfig.distance) {
            // If actual is named vectors (map) but we expect simple, it's a mismatch
            if (actualVectors && !actualVectors.distance && Object.keys(actualVectors).length > 0) {
                throw new Error(`Distance Metric Lock violation: Collection '${name}' has named vectors but expected simple configuration.`);
            }

            // Ensure actual has a distance property when expecting a simple config
            if (!actualVectors || !actualVectors.distance) {
                throw new Error(`Distance Metric Lock violation: Collection '${name}' does not expose a simple vector distance property.`);
            }

            checkDistance(actualVectors.distance, expectedConfig.distance);
            return;
        }

        // Case 2: Expected is named vectors (object with keys)
        const expectedKeys = Object.keys(expectedConfig);
        for (const key of expectedKeys) {
            const actualKey = actualVectors ? actualVectors[key] : null;
            if (!actualKey) {
                throw new Error(`Distance Metric Lock violation: Collection '${name}' missing expected vector '${key}'.`);
            }
            if (!actualKey.distance) {
                throw new Error(`Distance Metric Lock violation: Collection '${name}' vector '${key}' missing distance property.`);
            }
            checkDistance(actualKey.distance, expectedConfig[key].distance);
        }
    }

    // =========================================================================
    // Legacy / Helper Methods (Restored for Compatibility)
    // =========================================================================

    async initialize() {
        await this.ensureCollection(COLLECTIONS.document_embeddings.name, {
            size: COLLECTIONS.document_embeddings.vectorSize,
            distance: COLLECTIONS.document_embeddings.distance
        });
        await this.ensureCollection(COLLECTIONS.visual_overlays.name, {
            size: COLLECTIONS.visual_overlays.vectorSize,
            distance: COLLECTIONS.visual_overlays.distance
        });
        await this.ensureCollection(COLLECTIONS.visual_pages.name, {
            page_embedding: {
                size: COLLECTIONS.visual_pages.vectorSize,
                distance: COLLECTIONS.visual_pages.distance
            }
        });
    }

    async healthCheck() {
        try {
            const collections = await this.getCollections();
            const collectionNames = (collections && collections.collections) ? collections.collections.map(c => c.name) : [];
            
            const details = {};
            for (const col of Object.values(COLLECTIONS)) {
                if (collectionNames.includes(col.name)) {
                    // Presence in getCollections is sufficient to mark 'exists'
                    details[col.name] = { exists: true };
                    // Try to fetch extra details if available, but tolerate failures
                    try {
                        if (typeof this.getCollection === 'function') {
                            const info = await this.getCollection(col.name);
                            const vectors = info?.config?.params?.vectors || {};
                            const size = vectors.size || (vectors.page_embedding ? vectors.page_embedding.size : 'unknown');
                            const distance = vectors.distance || (vectors.page_embedding ? vectors.page_embedding.distance : 'unknown');

                            details[col.name] = {
                                exists: true,
                                pointCount: info.points_count,
                                vectorSize: size,
                                distance: distance
                            };
                        }
                    } catch (innerErr) {
                        // Keep exists=true and move on
                        logger.warn(`[QdrantAdapter] Could not fetch collection details for ${col.name}: ${innerErr.message}`);
                    }
                } else {
                    details[col.name] = { exists: false };
                }
            }

            return { healthy: true, collections: details };
        } catch (error) {
            return { healthy: false, error: error.message };
        }
    }

    // Visual Overlays Helpers
    async upsertVisualOverlays(points) {
        const normalizedPoints = (points || []).map(point => {
            if (point.vector) {
                return point;
            }
            if (!point.embedding) {
                return point;
            }
            const { embedding, ...rest } = point;
            return {
                ...rest,
                vector: embedding
            };
        });
        return this.upsert(COLLECTIONS.visual_overlays.name, normalizedPoints);
    }

    async searchVisualOverlays(vector, options = {}) {
        return this.search(COLLECTIONS.visual_overlays.name, {
            vector,
            limit: options.limit || 10,
            with_payload: true,
            score_threshold: options.scoreThreshold
        });
    }

    async deleteVisualOverlaysByDocId(docId) {
        return this.deleteByDocId(COLLECTIONS.visual_overlays.name, docId);
    }

    // Visual Pages Helpers
    async upsertVisualPages(points) {
        const normalizedPoints = (points || []).map(point => {
            if (point.vector) {
                return point;
            }
            if (!point.embedding) {
                return point;
            }
            const { embedding, ...rest } = point;
            return {
                ...rest,
                vector: {
                    page_embedding: embedding
                }
            };
        });
        return this.upsert(COLLECTIONS.visual_pages.name, normalizedPoints);
    }

    async searchVisualPages(vector, options = {}) {
        const candidates = [
            {
                vector: {
                    page_embedding: vector
                }
            },
            {
                vector,
                vector_name: 'page_embedding'
            },
            {
                vector: {
                    name: 'page_embedding',
                    vector
                }
            }
        ];

        for (const payload of candidates) {
            try {
                return await this.search(COLLECTIONS.visual_pages.name, {
                    ...payload,
                    limit: options.limit || 10,
                    with_payload: true
                });
            } catch (error) {
                if (!error.message || !error.message.includes('Bad Request')) {
                    throw error;
                }
            }
        }

        throw new Error('Bad Request');
    }

    async deleteVisualPagesByDocId(docId) {
        return this.deleteByDocId(COLLECTIONS.visual_pages.name, docId);
    }

    // Document Embeddings Helpers
    async upsertDocumentEmbeddings(points) {
        const normalizedPoints = (points || []).map(point => {
            if (point.vector) {
                return point;
            }
            if (!point.embedding) {
                return point;
            }
            const { embedding, ...rest } = point;
            return {
                ...rest,
                vector: embedding
            };
        });
        return this.upsert(COLLECTIONS.document_embeddings.name, normalizedPoints);
    }

    async searchDocumentEmbeddings(vector, options = {}) {
        return this.search(COLLECTIONS.document_embeddings.name, {
            vector,
            limit: options.limit || 10,
            with_payload: true
        });
    }

    async deleteDocumentEmbeddings(docId) {
        if (Array.isArray(docId)) {
            return this.deleteByIds(COLLECTIONS.document_embeddings.name, docId);
        }
        return this.deleteByDocId(COLLECTIONS.document_embeddings.name, docId);
    }

    // Specific payload update wrapper
    async updatePayloadForDoc(collection, docId, payload) {
        // This wraps the generic updatePayload but targets a specific collection if needed,
        // or we can just use the generic one if the caller passes the collection name.
        // The generic updatePayload iterates all collections, which might be overkill if we know the target.
        // Implementing specific single-collection update:
        try {
            const points = await this._getPointsByDocId(collection, docId);
            if (points.length === 0) return { status: 'skipped', reason: 'no_points' };
            
            const pointIds = points.map(p => p.id);
            const result = await this.circuitBreaker.execute(async () => {
                await this.client.setPayload(collection, {
                    points: pointIds,
                    payload
                });
            });

            if (result.fallback || !result.success) {
                throw result.error || new Error(`Payload update failed for ${collection}`);
            }
            return { status: 'ok', count: pointIds.length };
        } catch (e) {
            logger.error(`[QdrantAdapter] updatePayloadForDoc failed: ${e.message}`);
            throw e;
        }
    }

    // Legacy alias for getPoint (used in tests)
    async getPoint(collection, id) {
        const result = await this.circuitBreaker.execute(async () => {
            // Support both client.getPoint (legacy stub/tests) and client.retrieve (qdrant client's newer name)
            if (typeof this.client.getPoint === 'function') {
                return await this.client.getPoint(collection, id);
            }
            if (typeof this.client.retrieve === 'function') {
                return await this.client.retrieve(collection, {
                    ids: [id],
                    with_payload: true,
                    with_vector: true
                });
            }
            throw new Error('Qdrant client does not support getPoint or retrieve');
        });
        
        if (result.fallback || !result.success) {
            throw result.error || new Error(`getPoint failed for ${collection} id=${id}`);
        }

        // If the underlying client returned an array (retrieve), return first element
        const data = result.data;
        if (Array.isArray(data)) return data[0];
        return data;
    }
}

// Export class, singleton instance, and constants
const qdrantAdapter = new QdrantAdapter();

module.exports = {
    QdrantAdapter,
    qdrantAdapter,
    COLLECTIONS
};
