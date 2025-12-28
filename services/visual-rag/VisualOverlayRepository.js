/**
 * VisualOverlayRepository.js
 *
 * Repository for storing and retrieving visual overlays from PostgreSQL.
 * Manages bounding boxes and semantic labels extracted by Qwen3-VL.
 *
 * Architecture Reference: PROMPT-001 (PostgreSQL Schema)
 * Table: visual_overlays
 *
 * Required: npm install pg
 *
 * Overlay Data Format:
 * {
 *   label: "signature",
 *   box: [ymin, xmin, ymax, xmax],  // Coordinates 0-1000
 *   confidence: 0.95
 * }
 */

const logger = require('../logger');

// Lazy-load pg to allow graceful degradation if not installed
let Pool = null;
let pool = null;

/**
 * Determine the appropriate PostgreSQL host based on environment
 * Priority: POSTGRES_HOST > PAPERLESS_DBHOST > localhost (for host access)
 * Note: 'db' only works inside Docker network, so we default to 'localhost'
 */
function getPostgresHost() {
    if (process.env.POSTGRES_HOST) return process.env.POSTGRES_HOST;
    if (process.env.PAPERLESS_DBHOST) return process.env.PAPERLESS_DBHOST;
    // Default to localhost for Windows host access (Docker exposes 5432)
    return 'localhost';
}

/**
 * Initialize the PostgreSQL connection pool with retry logic
 * @param {number} maxRetries - Maximum connection attempts (default: 3)
 * @param {number} retryDelayMs - Delay between retries in ms (default: 1000)
 */
async function initPoolWithRetry(maxRetries = 3, retryDelayMs = 1000) {
    if (pool) return pool;

    let pg;
    try {
        pg = require('pg');
        Pool = pg.Pool;
    } catch (error) {
        logger.warn('[VisualOverlayRepository] pg module not installed. Run: npm install pg');
        return null;
    }

    const host = getPostgresHost();
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    const database = process.env.POSTGRES_DB || 'paperless';
    const user = process.env.POSTGRES_USER || 'paperless';
    const password = process.env.POSTGRES_PASSWORD || '';

    const config = {
        host,
        port,
        database,
        user,
        password,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
    };

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const testPool = new Pool(config);

            // Test the connection
            const client = await testPool.connect();
            await client.query('SELECT 1');
            client.release();

            // Connection successful
            testPool.on('error', (err) => {
                logger.error('[VisualOverlayRepository] Pool error:', err.message);
            });

            pool = testPool;
            logger.info(`[VisualOverlayRepository] PostgreSQL pool initialized (${host}:${port}/${database}) on attempt ${attempt}`);
            return pool;
        } catch (error) {
            logger.warn(`[VisualOverlayRepository] Connection attempt ${attempt}/${maxRetries} failed to ${host}:${port}: ${error.message}`);

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            }
        }
    }

    logger.error(`[VisualOverlayRepository] Failed to connect to PostgreSQL at ${host}:${port} after ${maxRetries} attempts`);
    return null;
}

/**
 * Initialize the PostgreSQL connection pool (synchronous wrapper)
 * For lazy initialization - actual connection tested on first use
 */
function initPool() {
    if (pool) return pool;

    let pg;
    try {
        pg = require('pg');
        Pool = pg.Pool;
    } catch (error) {
        logger.warn('[VisualOverlayRepository] pg module not installed. Run: npm install pg');
        return null;
    }

    const host = getPostgresHost();
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    const database = process.env.POSTGRES_DB || 'paperless';
    const user = process.env.POSTGRES_USER || 'paperless';
    const password = process.env.POSTGRES_PASSWORD || '';

    const config = {
        host,
        port,
        database,
        user,
        password,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
    };

    pool = new Pool(config);

    pool.on('error', (err) => {
        logger.error('[VisualOverlayRepository] Pool error:', err.message);
    });

    logger.info(`[VisualOverlayRepository] PostgreSQL pool initialized (${host}:${port}/${database})`);

    return pool;
}

class VisualOverlayRepository {
    constructor() {
        this._pool = null;
        this._available = null;
    }

    /**
     * Get the connection pool (lazy initialization)
     */
    get pool() {
        if (!this._pool) {
            this._pool = initPool();
        }
        return this._pool;
    }

    /**
     * Check if repository is available (with retry)
     * @param {boolean} useRetry - Whether to use retry logic (default: true)
     * @returns {Promise<boolean>}
     */
    async isAvailable(useRetry = true) {
        if (this._available !== null) {
            return this._available;
        }

        // Try with retry logic first for initial connection
        if (useRetry && !this._pool) {
            this._pool = await initPoolWithRetry(3, 1000);
        } else if (!this._pool) {
            this._pool = initPool();
        }

        if (!this._pool) {
            this._available = false;
            return false;
        }

        try {
            const client = await this._pool.connect();
            await client.query('SELECT 1');
            client.release();
            this._available = true;
            return true;
        } catch (error) {
            logger.warn('[VisualOverlayRepository] Database not available:', error.message);
            this._available = false;
            return false;
        }
    }

    // =========================================================================
    // Write Operations
    // =========================================================================

    /**
     * Save a single overlay for a document page
     * @param {number} docId - Paperless document ID
     * @param {number} pageNumber - Page number (1-indexed)
     * @param {Object} overlayData - Overlay data with label, box, confidence
     * @param {string} semanticLabel - Optional semantic label for quick filtering
     * @returns {Promise<Object>} Created overlay record
     */
    async saveOverlay(docId, pageNumber, overlayData, semanticLabel = null) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const query = `
            INSERT INTO visual_overlays (doc_id, page_number, overlay_data, semantic_label)
            VALUES ($1, $2, $3, $4)
            RETURNING id, doc_id, page_number, overlay_data, semantic_label, created_at
        `;

        const label = semanticLabel || overlayData.label || null;

        try {
            const result = await this.pool.query(query, [
                docId,
                pageNumber,
                JSON.stringify(overlayData),
                label
            ]);

            logger.debug(`[VisualOverlayRepository] Saved overlay for doc ${docId} page ${pageNumber}: ${label}`);

            return this._mapRow(result.rows[0]);
        } catch (error) {
            throw this._wrapError('Failed to save overlay', error);
        }
    }

    /**
     * Save multiple overlays for a document (batch insert)
     * @param {number} docId - Paperless document ID
     * @param {Array<Object>} overlays - Array of {pageNumber, overlayData, semanticLabel}
     * @returns {Promise<Array<Object>>} Created overlay records
     */
    async saveOverlays(docId, overlays) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        if (!overlays || overlays.length === 0) {
            return [];
        }

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            const results = [];

            for (const overlay of overlays) {
                const { pageNumber, overlayData, semanticLabel } = overlay;
                const label = semanticLabel || overlayData.label || null;

                const query = `
                    INSERT INTO visual_overlays (doc_id, page_number, overlay_data, semantic_label)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id, doc_id, page_number, overlay_data, semantic_label, created_at
                `;

                const result = await client.query(query, [
                    docId,
                    pageNumber,
                    JSON.stringify(overlayData),
                    label
                ]);

                results.push(this._mapRow(result.rows[0]));
            }

            await client.query('COMMIT');

            logger.info(`[VisualOverlayRepository] Saved ${results.length} overlays for doc ${docId}`);

            return results;
        } catch (error) {
            await client.query('ROLLBACK');
            throw this._wrapError('Failed to save overlays batch', error);
        } finally {
            client.release();
        }
    }

    /**
     * Delete all overlays for a document
     * @param {number} docId - Paperless document ID
     * @returns {Promise<number>} Number of deleted rows
     */
    async deleteByDocId(docId) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const query = 'DELETE FROM visual_overlays WHERE doc_id = $1';

        try {
            const result = await this.pool.query(query, [docId]);

            logger.debug(`[VisualOverlayRepository] Deleted ${result.rowCount} overlays for doc ${docId}`);

            return result.rowCount;
        } catch (error) {
            throw this._wrapError('Failed to delete overlays', error);
        }
    }

    // =========================================================================
    // Read Operations
    // =========================================================================

    /**
     * Get all overlays for a document
     * @param {number} docId - Paperless document ID
     * @returns {Promise<Array<Object>>} Overlay records
     */
    async getByDocId(docId) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const query = `
            SELECT id, doc_id, page_number, overlay_data, semantic_label, created_at
            FROM visual_overlays
            WHERE doc_id = $1
            ORDER BY page_number, id
        `;

        try {
            const result = await this.pool.query(query, [docId]);
            return result.rows.map(row => this._mapRow(row));
        } catch (error) {
            throw this._wrapError('Failed to get overlays by doc_id', error);
        }
    }

    /**
     * Get overlays for a specific page
     * @param {number} docId - Paperless document ID
     * @param {number} pageNumber - Page number (1-indexed)
     * @returns {Promise<Array<Object>>} Overlay records
     */
    async getByDocIdAndPage(docId, pageNumber) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const query = `
            SELECT id, doc_id, page_number, overlay_data, semantic_label, created_at
            FROM visual_overlays
            WHERE doc_id = $1 AND page_number = $2
            ORDER BY id
        `;

        try {
            const result = await this.pool.query(query, [docId, pageNumber]);
            return result.rows.map(row => this._mapRow(row));
        } catch (error) {
            throw this._wrapError('Failed to get overlays by doc_id and page', error);
        }
    }

    /**
     * Get overlays by semantic label
     * @param {string} label - Semantic label to filter by
     * @param {number} limit - Max results (default: 100)
     * @returns {Promise<Array<Object>>} Overlay records
     */
    async getBySemanticLabel(label, limit = 100) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const query = `
            SELECT id, doc_id, page_number, overlay_data, semantic_label, created_at
            FROM visual_overlays
            WHERE semantic_label = $1
            ORDER BY created_at DESC
            LIMIT $2
        `;

        try {
            const result = await this.pool.query(query, [label, limit]);
            return result.rows.map(row => this._mapRow(row));
        } catch (error) {
            throw this._wrapError('Failed to get overlays by label', error);
        }
    }

    /**
     * Search overlays by JSONB content
     * @param {Object} criteria - JSONB containment criteria
     * @returns {Promise<Array<Object>>} Matching overlay records
     */
    async searchByOverlayData(criteria, limit = 100) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const query = `
            SELECT id, doc_id, page_number, overlay_data, semantic_label, created_at
            FROM visual_overlays
            WHERE overlay_data @> $1
            ORDER BY created_at DESC
            LIMIT $2
        `;

        try {
            const result = await this.pool.query(query, [JSON.stringify(criteria), limit]);
            return result.rows.map(row => this._mapRow(row));
        } catch (error) {
            throw this._wrapError('Failed to search overlays', error);
        }
    }

    /**
     * Check if a document has overlays
     * @param {number} docId - Paperless document ID
     * @returns {Promise<boolean>}
     */
    async hasOverlays(docId) {
        if (!this.pool) {
            return false;
        }

        const query = 'SELECT 1 FROM visual_overlays WHERE doc_id = $1 LIMIT 1';

        try {
            const result = await this.pool.query(query, [docId]);
            return result.rowCount > 0;
        } catch (error) {
            logger.warn('[VisualOverlayRepository] Failed to check overlays:', error.message);
            return false;
        }
    }

    // =========================================================================
    // Expert Knowledge Storage (MoE Integration)
    // =========================================================================

    /**
     * Ensure the enhanced schema columns exist for expert metadata
     * Adds columns: enhanced_ocr_text, expert_metadata, domain_view, domain_signals, retrieval_quality_score
     * @returns {Promise<boolean>} True if schema is ready
     */
    async ensureEnhancedSchema() {
        if (!this.pool) {
            return false;
        }

        const columns = [
            { name: 'enhanced_ocr_text', type: 'TEXT' },
            { name: 'expert_metadata', type: 'JSONB DEFAULT \'{}\'' },
            { name: 'domain_view', type: 'JSONB DEFAULT \'{}\'' },
            { name: 'domain_signals', type: 'JSONB DEFAULT \'[]\'' },
            { name: 'retrieval_quality_score', type: 'FLOAT DEFAULT 0.0' },
            { name: 'expert_routing_weights', type: 'JSONB DEFAULT \'{}\'' }
        ];

        try {
            for (const col of columns) {
                await this.pool.query(`
                    ALTER TABLE visual_overlays
                    ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
                `);
            }

            // Create index on domain_signals for MoE filtering
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_visual_overlays_domain_signals
                ON visual_overlays USING GIN (domain_signals)
            `);

            // Create index on quality score for filtering low-quality chunks
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_visual_overlays_quality
                ON visual_overlays (retrieval_quality_score)
                WHERE retrieval_quality_score >= 0.7
            `);

            logger.info('[VisualOverlayRepository] Enhanced schema columns verified');
            return true;
        } catch (error) {
            logger.warn('[VisualOverlayRepository] Failed to ensure enhanced schema:', error.message);
            return false;
        }
    }

    /**
     * Save expert knowledge for a document
     * @param {number} docId - Paperless document ID
     * @param {Object} expertKnowledge - Expert knowledge data
     * @param {string} expertKnowledge.enhancedOcrText - Full extracted text
     * @param {Object} expertKnowledge.expertMetadata - Structured expert analysis
     * @param {Object} expertKnowledge.domainView - Task-oriented domain view
     * @returns {Promise<boolean>} Success status
     */
    async saveExpertKnowledge(docId, expertKnowledge) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const {
            enhancedOcrText,
            expertMetadata = {},
            domainView = {},
            domainSignals = [],
            qualityScore = 0.0,
            routingWeights = {}
        } = expertKnowledge;

        // Use upsert pattern - update if exists, insert if not
        const query = `
            INSERT INTO visual_overlays (doc_id, page_number, overlay_data, semantic_label,
                enhanced_ocr_text, expert_metadata, domain_view, domain_signals,
                retrieval_quality_score, expert_routing_weights)
            VALUES ($1, 0, '{}', 'expert_knowledge', $2, $3, $4, $5, $6, $7)
            ON CONFLICT (doc_id, page_number) WHERE page_number = 0 AND semantic_label = 'expert_knowledge'
            DO UPDATE SET
                enhanced_ocr_text = EXCLUDED.enhanced_ocr_text,
                expert_metadata = EXCLUDED.expert_metadata,
                domain_view = EXCLUDED.domain_view,
                domain_signals = EXCLUDED.domain_signals,
                retrieval_quality_score = EXCLUDED.retrieval_quality_score,
                expert_routing_weights = EXCLUDED.expert_routing_weights
            RETURNING id
        `;

        try {
            await this.pool.query(query, [
                docId,
                enhancedOcrText || '',
                JSON.stringify(expertMetadata),
                JSON.stringify(domainView),
                JSON.stringify(domainSignals),
                qualityScore,
                JSON.stringify(routingWeights)
            ]);

            logger.debug(`[VisualOverlayRepository] Saved expert knowledge for doc ${docId}`);
            return true;
        } catch (error) {
            // If conflict detection fails, try simple insert
            if (error.code === '23505') {
                logger.debug('[VisualOverlayRepository] Conflict on insert, trying update');
                return this._updateExpertKnowledge(docId, expertKnowledge);
            }
            throw this._wrapError('Failed to save expert knowledge', error);
        }
    }

    /**
     * Update expert knowledge (fallback for upsert)
     * @private
     */
    async _updateExpertKnowledge(docId, expertKnowledge) {
        const {
            enhancedOcrText,
            expertMetadata = {},
            domainView = {},
            domainSignals = [],
            qualityScore = 0.0,
            routingWeights = {}
        } = expertKnowledge;

        const query = `
            UPDATE visual_overlays SET
                enhanced_ocr_text = $2,
                expert_metadata = $3,
                domain_view = $4,
                domain_signals = $5,
                retrieval_quality_score = $6,
                expert_routing_weights = $7
            WHERE doc_id = $1 AND page_number = 0 AND semantic_label = 'expert_knowledge'
        `;

        try {
            await this.pool.query(query, [
                docId,
                enhancedOcrText || '',
                JSON.stringify(expertMetadata),
                JSON.stringify(domainView),
                JSON.stringify(domainSignals),
                qualityScore,
                JSON.stringify(routingWeights)
            ]);
            return true;
        } catch (error) {
            throw this._wrapError('Failed to update expert knowledge', error);
        }
    }

    /**
     * Get expert knowledge for a document
     * @param {number} docId - Paperless document ID
     * @returns {Promise<Object|null>} Expert knowledge or null
     */
    async getExpertKnowledge(docId) {
        if (!this.pool) {
            return null;
        }

        const query = `
            SELECT enhanced_ocr_text, expert_metadata, domain_view,
                   domain_signals, retrieval_quality_score, expert_routing_weights
            FROM visual_overlays
            WHERE doc_id = $1 AND page_number = 0 AND semantic_label = 'expert_knowledge'
        `;

        try {
            const result = await this.pool.query(query, [docId]);
            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                enhancedOcrText: row.enhanced_ocr_text,
                expertMetadata: row.expert_metadata || {},
                domainView: row.domain_view || {},
                domainSignals: row.domain_signals || [],
                qualityScore: row.retrieval_quality_score || 0,
                routingWeights: row.expert_routing_weights || {}
            };
        } catch (error) {
            logger.warn('[VisualOverlayRepository] Failed to get expert knowledge:', error.message);
            return null;
        }
    }

    /**
     * Find documents by domain signals (MoE filtering)
     * @param {Array<string>} signals - Domain signals to match
     * @param {Object} options - Query options
     * @returns {Promise<Array<Object>>} Matching documents with expert knowledge
     */
    async findByDomainSignals(signals, options = {}) {
        if (!this.pool || !signals || signals.length === 0) {
            return [];
        }

        const { limit = 50, minQuality = 0.7 } = options;

        const query = `
            SELECT doc_id, enhanced_ocr_text, expert_metadata, domain_view,
                   domain_signals, retrieval_quality_score, expert_routing_weights
            FROM visual_overlays
            WHERE semantic_label = 'expert_knowledge'
              AND domain_signals ?| $1
              AND retrieval_quality_score >= $2
            ORDER BY retrieval_quality_score DESC
            LIMIT $3
        `;

        try {
            const result = await this.pool.query(query, [signals, minQuality, limit]);
            return result.rows.map(row => ({
                docId: row.doc_id,
                enhancedOcrText: row.enhanced_ocr_text,
                expertMetadata: row.expert_metadata || {},
                domainView: row.domain_view || {},
                domainSignals: row.domain_signals || [],
                qualityScore: row.retrieval_quality_score || 0,
                routingWeights: row.expert_routing_weights || {}
            }));
        } catch (error) {
            logger.warn('[VisualOverlayRepository] Failed to find by domain signals:', error.message);
            return [];
        }
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Map database row to overlay object
     * @private
     */
    _mapRow(row) {
        if (!row) return null;

        // PostgreSQL returns BIGINT as string, convert to number
        // Safe for document IDs up to 2^53-1 (9 quadrillion)
        return {
            id: parseInt(row.id, 10),
            docId: parseInt(row.doc_id, 10),
            pageNumber: row.page_number,
            overlayData: row.overlay_data,
            semanticLabel: row.semantic_label,
            createdAt: row.created_at,
            // Convenience accessors
            label: row.overlay_data?.label,
            box: row.overlay_data?.box,
            confidence: row.overlay_data?.confidence
        };
    }

    /**
     * Wrap database errors with context
     * @private
     */
    _wrapError(message, error) {
        const code = error.code || 'UNKNOWN';
        return new Error(`${message}: [${code}] ${error.message}`);
    }

    /**
     * Close the connection pool
     */
    async close() {
        if (this._pool) {
            await this._pool.end();
            this._pool = null;
            this._available = null;
            logger.info('[VisualOverlayRepository] Connection pool closed');
        }
    }
}

// Export singleton instance and class
const visualOverlayRepository = new VisualOverlayRepository();

module.exports = {
    VisualOverlayRepository,
    visualOverlayRepository
};
