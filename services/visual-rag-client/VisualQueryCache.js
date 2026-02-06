/**
 * VisualQueryCache.js
 *
 * Content-addressed cache for Visual RAG queries using Redis.
 *
 * Architecture Reference: Epic 0c097db0, P3-T1 (Query Caching)
 *
 * Features:
 * - Content-addressed storage using SHA256(query + documentId + domain)
 * - 24-hour TTL with LRU eviction
 * - Cache hit rate tracking
 * - Latency reduction metrics
 *
 * Usage:
 * - get(query, documentId, domain): Retrieve cached result
 * - set(query, documentId, domain, result): Store result with 24h TTL
 * - getStats(): Get cache statistics (hits, misses, hitRate)
 * - clear(): Clear all cached queries
 */

const crypto = require('crypto');
const logger = require('../logger');

/**
 * VisualQueryCache handles Redis-based caching for Visual RAG queries.
 */
class VisualQueryCache {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.ttlSeconds = options.ttlSeconds || 24 * 60 * 60; // 24 hours
        this.redisClient = options.redisClient || null;
        this.keyPrefix = options.keyPrefix || 'visual-query:';

        // Cache statistics
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            errors: 0
        };

        // Only initialize Redis if enabled
        if (this.enabled && !this.redisClient) {
            this._initializeRedis(options);
        }
    }

    /**
     * Initialize Redis client
     * @private
     */
    _initializeRedis(options = {}) {
        try {
            const redis = require('redis');

            const redisUrl = options.redisUrl ||
                process.env.REDIS_URL ||
                'redis://localhost:6379';

            this.redisClient = redis.createClient({
                url: redisUrl,
                socket: {
                    reconnectStrategy: (retries) => {
                        // Exponential backoff with max 3 seconds
                        if (retries > 10) {
                            logger.error('[VisualQueryCache] Max Redis reconnection attempts reached');
                            return new Error('Max reconnection attempts reached');
                        }
                        const delay = Math.min(retries * 100, 3000);
                        logger.debug(`[VisualQueryCache] Reconnecting to Redis in ${delay}ms (attempt ${retries})`);
                        return delay;
                    }
                }
            });

            this.redisClient.on('error', (err) => {
                logger.error('[VisualQueryCache] Redis error:', err.message);
                this.stats.errors++;
            });

            this.redisClient.on('connect', () => {
                logger.info('[VisualQueryCache] Connected to Redis');
            });

            this.redisClient.on('ready', () => {
                logger.info('[VisualQueryCache] Redis client ready');
            });

            this.redisClient.on('reconnecting', () => {
                logger.warn('[VisualQueryCache] Reconnecting to Redis');
            });

            // Connect to Redis
            this.redisClient.connect().catch(err => {
                logger.error('[VisualQueryCache] Failed to connect to Redis:', err.message);
                this.enabled = false;
            });

        } catch (error) {
            logger.error('[VisualQueryCache] Failed to initialize Redis:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Generate content-addressed cache key
     * @param {string} query - Query string or image descriptor
     * @param {number|string} documentId - Document ID (optional)
     * @param {string} domain - Query domain (optional)
     * @returns {string} SHA256 hash key
     */
    generateKey(query, documentId = '', domain = '') {
        const normalizedQuery = String(query || '').trim();
        const normalizedDocId = String(documentId || '');
        const normalizedDomain = String(domain || '').toLowerCase();

        const content = `${normalizedQuery}|${normalizedDocId}|${normalizedDomain}`;
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        return `${this.keyPrefix}${hash}`;
    }

    /**
     * Get cached query result
     * @param {string} query - Query string
     * @param {number|string} documentId - Document ID (optional)
     * @param {string} domain - Query domain (optional)
     * @returns {Promise<Object|null>} Cached result or null
     */
    async get(query, documentId = '', domain = '') {
        if (!this.enabled || !this.redisClient) {
            return null;
        }

        try {
            const key = this.generateKey(query, documentId, domain);
            const cached = await this.redisClient.get(key);

            if (cached) {
                this.stats.hits++;
                logger.debug(`[VisualQueryCache] Cache HIT: ${key.substring(0, 32)}...`);
                return JSON.parse(cached);
            }

            this.stats.misses++;
            logger.debug(`[VisualQueryCache] Cache MISS: ${key.substring(0, 32)}...`);
            return null;

        } catch (error) {
            logger.error('[VisualQueryCache] Cache get error:', error.message);
            this.stats.errors++;
            return null;
        }
    }

    /**
     * Store query result in cache
     * @param {string} query - Query string
     * @param {number|string} documentId - Document ID (optional)
     * @param {string} domain - Query domain (optional)
     * @param {Object} result - Query result to cache
     * @returns {Promise<boolean>} Success status
     */
    async set(query, documentId = '', domain = '', result) {
        if (!this.enabled || !this.redisClient || !result) {
            return false;
        }

        try {
            const key = this.generateKey(query, documentId, domain);
            const serialized = JSON.stringify(result);

            // Set with TTL (EX = seconds)
            await this.redisClient.set(key, serialized, {
                EX: this.ttlSeconds
            });

            this.stats.sets++;
            logger.debug(`[VisualQueryCache] Cache SET: ${key.substring(0, 32)}... (TTL: ${this.ttlSeconds}s)`);
            return true;

        } catch (error) {
            logger.error('[VisualQueryCache] Cache set error:', error.message);
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache stats with hit rate
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0
            ? (this.stats.hits / totalRequests) * 100
            : 0;

        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            errors: this.stats.errors,
            totalRequests,
            hitRate: Number(hitRate.toFixed(2)),
            enabled: this.enabled,
            connected: this.redisClient?.isOpen || false
        };
    }

    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            errors: 0
        };
    }

    /**
     * Clear all cached queries
     * @returns {Promise<number>} Number of keys deleted
     */
    async clear() {
        if (!this.enabled || !this.redisClient) {
            return 0;
        }

        try {
            // Use SCAN to find all keys with our prefix
            const keys = [];
            let cursor = 0;

            do {
                const result = await this.redisClient.scan(cursor, {
                    MATCH: `${this.keyPrefix}*`,
                    COUNT: 100
                });

                cursor = result.cursor;
                keys.push(...result.keys);
            } while (cursor !== 0);

            if (keys.length === 0) {
                logger.info('[VisualQueryCache] No keys to delete');
                return 0;
            }

            // Delete keys in batches
            const deleted = await this.redisClient.del(keys);
            logger.info(`[VisualQueryCache] Cleared ${deleted} cached queries`);
            return deleted;

        } catch (error) {
            logger.error('[VisualQueryCache] Cache clear error:', error.message);
            this.stats.errors++;
            return 0;
        }
    }

    /**
     * Close Redis connection
     * @returns {Promise<void>}
     */
    async close() {
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
                logger.info('[VisualQueryCache] Redis connection closed');
            } catch (error) {
                logger.error('[VisualQueryCache] Error closing Redis:', error.message);
            }
        }
    }

    /**
     * Check if cache is available
     * @returns {boolean} True if Redis is connected
     */
    isAvailable() {
        return this.enabled && this.redisClient?.isOpen === true;
    }
}

// Export singleton instance
const visualQueryCache = new VisualQueryCache();

module.exports = {
    VisualQueryCache,
    visualQueryCache
};
