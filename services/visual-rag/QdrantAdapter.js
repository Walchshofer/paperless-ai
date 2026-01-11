/**
 * QdrantAdapter.js
 *
 * Adapter for Qdrant vector database operations.
 * Replaces pgVector for vector storage in Visual RAG and text embeddings.
 *
 * Collections:
 * - document_embeddings: Text RAG (384 dimensions, cosine)
 * - visual_overlays: Visual overlay embeddings (320 dimensions, cosine)
 * - visual_pages: Visual RAG sidecar page embeddings (320 dimensions, dot)
 *
 * @module services/visual-rag/QdrantAdapter
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const logger = require('../logger');

// Collection configurations
const COLLECTIONS = {
    document_embeddings: {
        name: 'document_embeddings',
        vectorSize: 384,
        distance: 'Cosine',
        description: 'Text RAG embeddings (paraphrase-multilingual-MiniLM-L12-v2)'
    },
    visual_overlays: {
        name: 'visual_overlays',
        vectorSize: 320,
        distance: 'Cosine',
        description: 'Visual overlay embeddings (ColQwen3)'
    },
    visual_pages: {
        name: 'visual_pages',
        vectorSize: 320,
        distance: 'Dot',
        description: 'Visual RAG sidecar page embeddings (ColQwen3)'
    }
};

class QdrantAdapter {
    /**
     * Create a QdrantAdapter instance
     * @param {Object} options - Configuration options
     * @param {string} options.host - Qdrant host (default: from env or 'localhost')
     * @param {number} options.port - Qdrant port (default: from env or 6333)
     * @param {string} options.apiKey - Optional API key for cloud deployments
     */
    constructor(options = {}) {
        this.host = options.host || process.env.QDRANT_HOST || 'localhost';
        this.port = options.port || parseInt(process.env.QDRANT_PORT, 10) || 6333;
        this.apiKey = options.apiKey || process.env.QDRANT_API_KEY;

        const clientOptions = {
            url: `http://${this.host}:${this.port}`
        };

        if (this.apiKey) {
            clientOptions.apiKey = this.apiKey;
        }

        this.client = new QdrantClient(clientOptions);
        this._initialized = false;

        logger.info(`[QdrantAdapter] Configured for ${this.host}:${this.port}`);
    }

    // =========================================================================
    // Initialization & Health
    // =========================================================================

    /**
     * Initialize all collections
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (this._initialized) {
            return true;
        }

        try {
            logger.info('[QdrantAdapter] Initializing collections...');

            for (const [key, config] of Object.entries(COLLECTIONS)) {
                await this._ensureCollection(config);
            }

            this._initialized = true;
            logger.info('[QdrantAdapter] All collections initialized');
            return true;
        } catch (error) {
            logger.error('[QdrantAdapter] Initialization failed:', error.message);
            throw error;
        }
    }

    /**
     * Check if Qdrant is healthy and accessible
     * @returns {Promise<Object>} Health status
     */
    async healthCheck() {
        try {
            const collections = await this.client.getCollections();
            const collectionNames = collections.collections.map(c => c.name);

            const status = {
                healthy: true,
                host: this.host,
                port: this.port,
                collections: {},
                timestamp: new Date().toISOString()
            };

            for (const [key, config] of Object.entries(COLLECTIONS)) {
                const exists = collectionNames.includes(config.name);
                status.collections[config.name] = {
                    exists,
                    vectorSize: config.vectorSize,
                    distance: config.distance
                };

                if (exists) {
                    const info = await this.client.getCollection(config.name);
                    status.collections[config.name].pointCount = info.points_count;
                }
            }

            return status;
        } catch (error) {
            logger.error('[QdrantAdapter] Health check failed:', error.message);
            return {
                healthy: false,
                error: error.message,
                host: this.host,
                port: this.port,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Ensure a collection exists with correct configuration
     * @private
     */
    async _ensureCollection(config) {
        try {
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(c => c.name === config.name);

            if (exists) {
                logger.debug(`[QdrantAdapter] Collection ${config.name} already exists`);
                return;
            }

            await this.client.createCollection(config.name, {
                vectors: {
                    size: config.vectorSize,
                    distance: config.distance
                }
            });

            logger.info(`[QdrantAdapter] Created collection: ${config.name} (${config.vectorSize}D, ${config.distance})`);
        } catch (error) {
            // Collection might already exist (race condition)
            if (!error.message?.includes('already exists')) {
                throw error;
            }
        }
    }

    // =========================================================================
    // Document Embeddings (Text RAG - 384D)
    // =========================================================================

    /**
     * Upsert document embeddings for text RAG
     * @param {Array} documents - Array of {id, embedding, payload}
     * @returns {Promise<Object>} Operation result
     */
    async upsertDocumentEmbeddings(documents) {
        return this._upsert(COLLECTIONS.document_embeddings.name, documents);
    }

    /**
     * Search document embeddings
     * @param {Array<number>} queryVector - Query embedding (384D)
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results
     */
    async searchDocumentEmbeddings(queryVector, options = {}) {
        return this._search(COLLECTIONS.document_embeddings.name, queryVector, options);
    }

    /**
     * Delete document embeddings by ID
     * @param {Array<string|number>} ids - Point IDs to delete
     * @returns {Promise<Object>} Operation result
     */
    async deleteDocumentEmbeddings(ids) {
        return this._delete(COLLECTIONS.document_embeddings.name, ids);
    }

    // =========================================================================
    // Visual Overlays (320D)
    // =========================================================================

    /**
     * Upsert visual overlay embeddings
     * @param {Array} overlays - Array of {id, embedding, payload}
     * @returns {Promise<Object>} Operation result
     */
    async upsertVisualOverlays(overlays) {
        return this._upsert(COLLECTIONS.visual_overlays.name, overlays);
    }

    /**
     * Search visual overlays by embedding
     * @param {Array<number>} queryVector - Query embedding (320D)
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results
     */
    async searchVisualOverlays(queryVector, options = {}) {
        return this._search(COLLECTIONS.visual_overlays.name, queryVector, options);
    }

    /**
     * Delete visual overlays by document ID
     * @param {number} docId - Document ID
     * @returns {Promise<Object>} Operation result
     */
    async deleteVisualOverlaysByDocId(docId) {
        return this._deleteByFilter(COLLECTIONS.visual_overlays.name, {
            must: [{ key: 'doc_id', match: { value: docId } }]
        });
    }

    // =========================================================================
    // Visual Pages (Sidecar - 320D)
    // =========================================================================

    /**
     * Upsert visual page embeddings from sidecar
     * @param {Array} pages - Array of {id, embedding, payload}
     * @returns {Promise<Object>} Operation result
     */
    async upsertVisualPages(pages) {
        return this._upsert(COLLECTIONS.visual_pages.name, pages);
    }

    /**
     * Search visual pages by embedding
     * @param {Array<number>} queryVector - Query embedding (320D)
     * @param {Object} options - Search options
     * @returns {Promise<Array>} Search results
     */
    async searchVisualPages(queryVector, options = {}) {
        return this._search(COLLECTIONS.visual_pages.name, queryVector, options);
    }

    /**
     * Delete visual pages by document ID
     * @param {number} docId - Document ID
     * @returns {Promise<Object>} Operation result
     */
    async deleteVisualPagesByDocId(docId) {
        return this._deleteByFilter(COLLECTIONS.visual_pages.name, {
            must: [{ key: 'doc_id', match: { value: docId } }]
        });
    }

    // =========================================================================
    // Generic Operations
    // =========================================================================

    /**
     * Generic upsert operation
     * @private
     */
    async _upsert(collectionName, points) {
        if (!points || points.length === 0) {
            return { status: 'ok', count: 0 };
        }

        try {
            const formattedPoints = points.map(p => ({
                id: typeof p.id === 'string' ? p.id : String(p.id),
                vector: p.embedding || p.vector,
                payload: p.payload || {}
            }));

            await this.client.upsert(collectionName, {
                wait: true,
                points: formattedPoints
            });

            logger.debug(`[QdrantAdapter] Upserted ${points.length} points to ${collectionName}`);
            return { status: 'ok', count: points.length };
        } catch (error) {
            logger.error(`[QdrantAdapter] Upsert failed for ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Generic search operation
     * @private
     */
    async _search(collectionName, queryVector, options = {}) {
        const {
            limit = 10,
            scoreThreshold = 0,
            filter = null,
            withPayload = true
        } = options;

        try {
            const searchParams = {
                vector: queryVector,
                limit,
                with_payload: withPayload
            };

            if (scoreThreshold > 0) {
                searchParams.score_threshold = scoreThreshold;
            }

            if (filter) {
                searchParams.filter = filter;
            }

            const results = await this.client.search(collectionName, searchParams);

            return results.map(r => ({
                id: r.id,
                score: r.score,
                payload: r.payload
            }));
        } catch (error) {
            logger.error(`[QdrantAdapter] Search failed for ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Generic delete by IDs
     * @private
     */
    async _delete(collectionName, ids) {
        if (!ids || ids.length === 0) {
            return { status: 'ok', count: 0 };
        }

        try {
            await this.client.delete(collectionName, {
                wait: true,
                points: ids.map(id => typeof id === 'string' ? id : String(id))
            });

            logger.debug(`[QdrantAdapter] Deleted ${ids.length} points from ${collectionName}`);
            return { status: 'ok', count: ids.length };
        } catch (error) {
            logger.error(`[QdrantAdapter] Delete failed for ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Generic delete by filter
     * @private
     */
    async _deleteByFilter(collectionName, filter) {
        try {
            await this.client.delete(collectionName, {
                wait: true,
                filter
            });

            logger.debug(`[QdrantAdapter] Deleted points by filter from ${collectionName}`);
            return { status: 'ok' };
        } catch (error) {
            logger.error(`[QdrantAdapter] Delete by filter failed for ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Get collection info
     * @param {string} collectionName - Collection name
     * @returns {Promise<Object>} Collection info
     */
    async getCollectionInfo(collectionName) {
        try {
            return await this.client.getCollection(collectionName);
        } catch (error) {
            logger.error(`[QdrantAdapter] Get collection info failed for ${collectionName}:`, error.message);
            throw error;
        }
    }

    /**
     * Get point by ID
     * @param {string} collectionName - Collection name
     * @param {string|number} id - Point ID
     * @returns {Promise<Object|null>} Point data or null
     */
    async getPoint(collectionName, id) {
        try {
            const result = await this.client.retrieve(collectionName, {
                ids: [typeof id === 'string' ? id : String(id)],
                with_payload: true,
                with_vector: true
            });
            return result[0] || null;
        } catch (error) {
            logger.error(`[QdrantAdapter] Get point failed:`, error.message);
            return null;
        }
    }
}

// Export singleton and class
const qdrantAdapter = new QdrantAdapter();

module.exports = {
    QdrantAdapter,
    qdrantAdapter,
    COLLECTIONS
};
