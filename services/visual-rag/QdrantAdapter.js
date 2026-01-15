/**
 * QdrantAdapter.js
 * Native Protocol Alpha-9 Compliant Adapter
 * Handles visual_overlays collection (320D, Cosine)
 */

const { QdrantClient } = require('@qdrant/js-client-rest');
const { v4: uuidv4 } = require('uuid');

class QdrantAdapter {
    constructor() {
        this.client = null;
        this.host = process.env.QDRANT_HOST || 'qdrant';
        this.port = parseInt(process.env.QDRANT_PORT || '6333');
        this.collectionName = 'visual_overlays';
        this.vectorSize = 320; // ColQwen3 overlay dimension
    }

    /**
     * Initialize connection and ensure collection exists
     */
    async initialize() {
        if (this.client) return;

        console.log(`[Qdrant] Connecting to http://${this.host}:${this.port}...`);
        this.client = new QdrantClient({
            url: `http://${this.host}:${this.port}`,
            apiKey: process.env.QDRANT_API_KEY,
        });

        await this._ensureCollection();
    }

    async _ensureCollection() {
        try {
            const result = await this.client.getCollections();
            const exists = result.collections.some(c => c.name === this.collectionName);

            if (!exists) {
                console.log(`[Qdrant] Creating collection ${this.collectionName} (320D, Cosine)...`);
                await this.client.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine',
                    },
                });
                
                // Create payload indexes for Expert Filtering
                await this.client.createPayloadIndex(this.collectionName, {
                    field_name: 'doc_id',
                    field_schema: 'integer',
                });
                await this.client.createPayloadIndex(this.collectionName, {
                    field_name: 'correspondent_id',
                    field_schema: 'integer',
                });
                await this.client.createPayloadIndex(this.collectionName, {
                    field_name: 'tag_ids',
                    field_schema: 'integer', // Array of integers
                });
            }
        } catch (err) {
            console.error('[Qdrant] Initialization failed:', err.message);
            throw err;
        }
    }

    /**
     * Upsert a visual overlay vector with payload mirroring
     * @param {Object} params
     * @param {number} params.docId
     * @param {number[]} params.vector - 320D float array
     * @param {Object} params.metadata - Additional metadata
     * @returns {Promise<string>} vectorId (UUID)
     */
    async upsertOverlay({ docId, vector, metadata = {} }) {
        if (!this.client) await this.initialize();

        const vectorId = uuidv4();
        
        // Payload Mirroring: Ensure critical filtering fields are present
        const payload = {
            ...metadata,
            doc_id: docId,
            // correspondent_id and tag_ids should be passed in metadata
            timestamp: new Date().toISOString()
        };

        await this.client.upsert(this.collectionName, {
            points: [{
                id: vectorId,
                vector: vector,
                payload: payload
            }]
        });

        return vectorId;
    }

    /**
     * Search for similar overlays
     * @param {number[]} vector - Query vector
     * @param {Object} filter - Qdrant filter object
     * @param {number} limit
     */
    async search(vector, filter = null, limit = 5) {
        if (!this.client) await this.initialize();

        return await this.client.search(this.collectionName, {
            vector: vector,
            filter: filter,
            limit: limit,
            with_payload: true
        });
    }

    async healthCheck() {
        try {
            if (!this.client) await this.initialize();
            await this.client.getCollections();
            return true;
        } catch (e) {
            return false;
        }
    }
}

// Export singleton
exports.qdrantAdapter = new QdrantAdapter();