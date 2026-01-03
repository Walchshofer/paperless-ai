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
const fs = require('fs');
const path = require('path');

// Lazy-load pg to allow graceful degradation if not installed
let Pool = null;
let pool = null;

/**
 * Determine the appropriate PostgreSQL host based on environment
 * Priority: POSTGRES_HOST > PAPERLESS_DBHOST > localhost (for host access)
 * Note: 'db' only works inside Docker network, so we default to 'localhost'
 */
function getPostgresHost() {
    if (process.env.POSTGRES_HOST) {
        return process.env.POSTGRES_HOST;
    }
    if (process.env.PAPERLESS_DBHOST) {
        return process.env.PAPERLESS_DBHOST;
    }
    // Default to localhost for Windows host access (Docker exposes 5432)
    return 'localhost';
}

/**
 * Read an env var with fallback to the host data/.env file (helpful when dotenv wasn't applied)
 */
function readEnvFallback(key) {
    if (process.env[key] !== undefined && process.env[key] !== '') return process.env[key];

    try {
        const envPath = path.join(process.cwd(), 'data', '.env');
        if (!fs.existsSync(envPath)) return undefined;
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx === -1) continue;
            const k = trimmed.substring(0, idx);
            const v = trimmed.substring(idx + 1);
            if (k === key) return v;
        }
    } catch (e) {
        // ignore
    }

    return undefined;
}

/**
 * Read required environment variable with fallback keys
 * Throws error if not found
 */
function requireEnvFallback(key, fallbackKeys = []) {
    const value = readEnvFallback(key);
    if (value && value !== '') return value;
    
    for (const fallbackKey of fallbackKeys) {
        const fallbackValue = readEnvFallback(fallbackKey);
        if (fallbackValue && fallbackValue !== '') return fallbackValue;
    }
    
    const allKeys = [key, ...fallbackKeys].join(' or ');
    throw new Error(
        `[VisualOverlayRepository] Missing required database credential: ${allKeys}\n` +
        `Ensure POSTGRES_USER and POSTGRES_PASSWORD are set in docker-compose.env`
    );
}

/**
 * Initialize the PostgreSQL connection pool with retry logic
 * @param {number} maxRetries - Maximum connection attempts (default: 3)
 * @param {number} retryDelayMs - Delay between retries in ms (default: 1000)
 */
async function initPoolWithRetry(maxRetries = 3, retryDelayMs = 1000) {
    if (pool) {
        return pool;
    }

    let pg;
    try {
        pg = require('pg');
        Pool = pg.Pool;
    } catch (moduleError) {
        logger.warn({
            event: 'postgres_module_not_found',
            error: moduleError.message,
            suggestion: 'Run: npm install pg'
        });
        return null;
    }

    const host = getPostgresHost();
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    const database = process.env.POSTGRES_DB || 'paperless';
    // Prefer explicit Postgres env, fall back to Paperless-specific DB env vars or host data/.env
    const user = requireEnvFallback('POSTGRES_USER', ['PAPERLESS_DBUSER']);
    const password = requireEnvFallback('POSTGRES_PASSWORD', ['PAPERLESS_DBPASS']);

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

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
            const testPool = new Pool(config);

            // Test the connection
            const client = await testPool.connect();
            await client.query('SELECT 1');
            client.release();

            // Connection successful
            testPool.on('error', (poolError) => {
                logger.error({
                    event: 'postgres_pool_error',
                    error: poolError.message,
                    code: poolError.code
                });
            });

            pool = testPool;
            logger.info({
                event: 'postgres_pool_initialized',
                host,
                port,
                database,
                attempt
            });

            return pool;
        } catch (connectionError) {
            logger.warn({
                event: 'postgres_connection_failed',
                attempt,
                maxRetries,
                host,
                port,
                error: connectionError.message,
                code: connectionError.code
            });

            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            }
        }
    }

    logger.error({
        event: 'postgres_pool_init_failed',
        maxAttempts: maxRetries,
        host,
        port
    });
    return null;
}

/**
 * Initialize the PostgreSQL connection pool (synchronous wrapper)
 * For lazy initialization - actual connection tested on first use
 */
function initPool() {
    if (pool) {
        return pool;
    }

    let pg;
    try {
        pg = require('pg');
        Pool = pg.Pool;
    } catch (moduleError) {
        logger.warn({
            event: 'postgres_module_not_found',
            error: moduleError.message,
            suggestion: 'Run: npm install pg'
        });
        return null;
    }

    const host = getPostgresHost();
    const port = parseInt(process.env.POSTGRES_PORT || '5432', 10);
    const database = process.env.POSTGRES_DB || 'paperless';
    const user = requireEnvFallback('POSTGRES_USER', ['PAPERLESS_DBUSER']);
    const password = requireEnvFallback('POSTGRES_PASSWORD', ['PAPERLESS_DBPASS']);

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

    pool.on('error', (poolError) => {
        logger.error({
            event: 'postgres_pool_error',
            error: poolError.message,
            code: poolError.code
        });
    });

    logger.info({
        event: 'postgres_pool_initialized',
        host,
        port,
        database
    });

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
        } catch (availabilityError) {
            logger.warn({
                event: 'postgres_availability_check_failed',
                error: availabilityError.message,
                code: availabilityError.code
            });
            this._available = false;
            return false;
        }
    }

    /**
     * Check if pg_vector extension is available and properly installed
     * @returns {Promise<{available: boolean, version: string|null, error: string|null}>}
     */
    async checkPgVectorExtension() {
        if (!this.pool) {
            return {
                available: false,
                version: null,
                error: 'PostgreSQL connection pool not initialized'
            };
        }

        try {
            // Check if extension exists in available extensions
            const availableResult = await this.pool.query(
                "SELECT * FROM pg_available_extensions WHERE name = 'vector'"
            );

            if (availableResult.rows.length === 0) {
                return {
                    available: false,
                    version: null,
                    error: 'pgvector extension not available in PostgreSQL installation'
                };
            }

            // Check if extension is installed
            const installedResult = await this.pool.query(
                "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
            );

            if (installedResult.rows.length === 0) {
                return {
                    available: false,
                    version: availableResult.rows[0].default_version,
                    error: 'pgvector extension available but not installed (run CREATE EXTENSION vector)'
                };
            }

            return {
                available: true,
                version: installedResult.rows[0].extversion,
                error: null
            };
        } catch (checkError) {
            return {
                available: false,
                version: null,
                error: `Failed to check pgvector: ${checkError.message}`
            };
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
     * @param {Array<number>} embedding - Optional vector embedding
     * @returns {Promise<Object>} Created overlay record
     */
    async saveOverlay(docId, pageNumber, overlayData, semanticLabel = null, embedding = null) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const query = `
            INSERT INTO visual_overlays (doc_id, page_number, overlay_data, semantic_label, embedding)
            VALUES ($1, $2, $3, $4, $5::vector)
            RETURNING id, doc_id, page_number, overlay_data, semantic_label, created_at
        `;

        const label = semanticLabel || overlayData.label || null;
        const embeddingVal = Array.isArray(embedding) ? JSON.stringify(embedding) : (embedding || null);

        try {
            const result = await this.pool.query(query, [
                docId,
                pageNumber,
                JSON.stringify(overlayData),
                label,
                embeddingVal
            ]);

            logger.debug({
                event: 'overlay_saved',
                docId,
                pageNumber,
                label
            });

            return this._mapRow(result.rows[0]);
        } catch (saveError) {
            throw this._wrapError('Failed to save overlay', saveError);
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
                const { pageNumber, overlayData, semanticLabel, embedding } = overlay;
                const label = semanticLabel || overlayData.label || null;
                const embeddingVal = Array.isArray(embedding) ? JSON.stringify(embedding) : (embedding || null);

                const query = `
                    INSERT INTO visual_overlays (doc_id, page_number, overlay_data, semantic_label, embedding)
                    VALUES ($1, $2, $3, $4, $5::vector)
                    RETURNING id, doc_id, page_number, overlay_data, semantic_label, created_at
                `;

                const result = await client.query(query, [
                    docId,
                    pageNumber,
                    JSON.stringify(overlayData),
                    label,
                    embeddingVal
                ]);

                results.push(this._mapRow(result.rows[0]));
            }

            await client.query('COMMIT');

            logger.info({
                event: 'overlays_batch_saved',
                docId,
                count: results.length
            });

            return results;
        } catch (batchError) {
            await client.query('ROLLBACK');
            throw this._wrapError('Failed to save overlays batch', batchError);
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

            logger.debug({
                event: 'overlays_deleted',
                docId,
                deletedCount: result.rowCount
            });

            return result.rowCount;
        } catch (deleteError) {
            throw this._wrapError('Failed to delete overlays', deleteError);
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
        } catch (getError) {
            throw this._wrapError('Failed to get overlays by doc_id', getError);
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
        } catch (pageError) {
            throw this._wrapError('Failed to get overlays by doc_id and page', pageError);
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
        } catch (labelError) {
            throw this._wrapError('Failed to get overlays by label', labelError);
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
        } catch (searchError) {
            throw this._wrapError('Failed to search overlays', searchError);
        }
    }

    /**
     * Search overlays by vector embedding similarity
     * @param {Array<number>} embedding - Vector embedding
     * @param {number} limit - Max results
     * @param {number} threshold - Similarity threshold (0-1)
     * @returns {Promise<Array<Object>>} Matching overlay records with similarity score
     */
    async searchByEmbedding(embedding, limit = 10, threshold = 0.7) {
        if (!this.pool) {
            throw new Error('PostgreSQL not available');
        }

        const embeddingVal = Array.isArray(embedding) ? JSON.stringify(embedding) : embedding;

        const query = `
            SELECT id, doc_id, page_number, overlay_data, semantic_label, created_at,
                   1 - (embedding <=> $1::vector) as similarity
            FROM visual_overlays
            WHERE 1 - (embedding <=> $1::vector) > $2
            ORDER BY similarity DESC
            LIMIT $3
        `;

        try {
            const result = await this.pool.query(query, [embeddingVal, threshold, limit]);
            return result.rows.map(row => ({
                ...this._mapRow(row),
                similarity: row.similarity
            }));
        } catch (embeddingError) {
            throw this._wrapError('Failed to search by embedding', embeddingError);
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
        } catch (checkError) {
            logger.warn({
                event: 'overlay_existence_check_failed',
                docId,
                error: checkError.message,
                code: checkError.code
            });
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

        // Check pg_vector availability first
        const pgvectorCheck = await this.checkPgVectorExtension();
        if (!pgvectorCheck.available) {
            const errorDetails = {
                event: 'postgres_pgvector_not_available',
                error: pgvectorCheck.error,
                troubleshooting: [
                    'Verify docker-compose.yml uses pgvector/pgvector:pg16 image',
                    'Check container logs: docker logs paperless_db',
                    'Verify PostgreSQL version: docker exec paperless_db psql -U <user> -d <db> -c "SELECT version()"',
                    'Manually install extension: docker exec paperless_db psql -U <user> -d <db> -c "CREATE EXTENSION IF NOT EXISTS vector"'
                ]
            };
            logger.error(errorDetails);
            return false;
        }

        logger.info({
            event: 'postgres_pgvector_verified',
            version: pgvectorCheck.version
        });

        // Enable pgvector extension (should already be installed, but ensure it's enabled)
        try {
            await this.pool.query('CREATE EXTENSION IF NOT EXISTS vector');
            logger.info({
                event: 'postgres_vector_extension_enabled',
                version: pgvectorCheck.version
            });
        } catch (vectorError) {
            logger.error({
                event: 'postgres_vector_extension_failed',
                error: vectorError.message,
                code: vectorError.code,
                hint: vectorError.hint,
                detail: vectorError.detail,
                troubleshooting: [
                    'Check PostgreSQL logs: docker logs paperless_db',
                    'Verify database user has CREATE EXTENSION privilege',
                    'Ensure pgvector shared library is loaded: docker exec paperless_db psql -U <user> -d <db> -c "SHOW shared_preload_libraries"',
                    'Restart PostgreSQL container: docker restart paperless_db'
                ]
            });
            return false;
        }

        const columns = [
            { name: 'enhanced_ocr_text', type: 'TEXT' },
            { name: 'expert_metadata', type: 'JSONB DEFAULT \'{}\'' },
            { name: 'domain_view', type: 'JSONB DEFAULT \'{}\'' },
            { name: 'domain_signals', type: 'JSONB DEFAULT \'[]\'' },
            { name: 'retrieval_quality_score', type: 'FLOAT DEFAULT 0.0' },
            { name: 'expert_routing_weights', type: 'JSONB DEFAULT \'{}\'' },
            { name: 'embedding', type: 'vector(768)' }
        ];

        try {
            for (const col of columns) {
                // Perform sequential ALTERs to ensure schema changes are applied in order
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

            // Create HNSW index for vector search
            await this.pool.query(`
                CREATE INDEX IF NOT EXISTS idx_visual_overlays_embedding 
                ON visual_overlays USING hnsw (embedding vector_cosine_ops)
            `);

            logger.info({
                event: 'postgres_enhanced_schema_verified'
            });
            return true;
        } catch (schemaError) {
            const errorContext = {
                event: 'postgres_enhanced_schema_failed',
                error: schemaError.message,
                code: schemaError.code,
                hint: schemaError.hint,
                detail: schemaError.detail
            };

            // Provide specific troubleshooting based on error code
            if (schemaError.code === '42704') {
                errorContext.troubleshooting = [
                    'Type "vector" does not exist - pgvector extension not properly installed',
                    'Run: docker exec paperless_db psql -U <user> -d <db> -c "CREATE EXTENSION vector"',
                    'Verify image: docker inspect paperless_db | grep Image'
                ];
            } else if (schemaError.code === '42501') {
                errorContext.troubleshooting = [
                    'Permission denied - database user lacks required privileges',
                    'Grant privileges: GRANT CREATE ON DATABASE <db> TO <user>',
                    'Or use superuser credentials in docker-compose.env'
                ];
            } else if (schemaError.code === '42P07') {
                errorContext.troubleshooting = [
                    'Column already exists - schema partially created',
                    'This is usually safe to ignore',
                    'Check table structure: docker exec paperless_db psql -U <user> -d <db> -c "\\d visual_overlays"'
                ];
            } else {
                errorContext.troubleshooting = [
                    'Check PostgreSQL logs: docker logs paperless_db',
                    'Verify database connectivity: docker exec paperless_db pg_isready',
                    'Test manual connection: docker exec -it paperless_db psql -U <user> -d <db>'
                ];
            }

            logger.error(errorContext);
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

            logger.debug({
                event: 'expert_knowledge_saved',
                docId,
                qualityScore
            });
            return true;
        } catch (conflictError) {
            // If conflict detection fails, try simple insert
            if (conflictError.code === '23505') {
                logger.debug({
                    event: 'expert_knowledge_conflict_detected',
                    docId,
                    action: 'update'
                });
                return this._updateExpertKnowledge(docId, expertKnowledge);
            }
            throw this._wrapError('Failed to save expert knowledge', conflictError);
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
        } catch (updateError) {
            throw this._wrapError('Failed to update expert knowledge', updateError);
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
        } catch (retrievalError) {
            logger.warn({
                event: 'expert_knowledge_retrieval_failed',
                docId,
                error: retrievalError.message,
                code: retrievalError.code
            });
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
        } catch (filterError) {
            logger.warn({
                event: 'domain_signals_search_failed',
                signals,
                error: filterError.message,
                code: filterError.code
            });
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
        if (!row) {
            return null;
        }

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
     * Includes error code for debugging and retry logic
     * @private
     */
    _wrapError(message, databaseError) {
        const code = databaseError.code || 'UNKNOWN';
        const detail = databaseError.detail || databaseError.message;
        return new Error(`${message}: [${code}] ${detail}`);
    }

    /**
     * Close the connection pool
     */
    async close() {
        if (this._pool) {
            await this._pool.end();
            this._pool = null;
            this._available = null;
            logger.info({
                event: 'postgres_pool_closed'
            });
        }
    }
}

// Export singleton instance and class
const visualOverlayRepository = new VisualOverlayRepository();

module.exports = {
    VisualOverlayRepository,
    visualOverlayRepository
};
