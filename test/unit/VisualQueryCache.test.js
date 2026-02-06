/**
 * Unit tests for VisualQueryCache
 * Tests content-addressed caching with SHA256 keys
 */

const assert = require('assert');
const { VisualQueryCache } = require('../../services/visual-rag-client/VisualQueryCache');

describe('VisualQueryCache', () => {
    let cache;
    let mockRedisClient;

    beforeEach(() => {
        // Create mock Redis client
        mockRedisClient = {
            isOpen: true,
            data: new Map(),

            async get(key) {
                return this.data.get(key) || null;
            },

            async set(key, value, options) {
                this.data.set(key, value);
                return 'OK';
            },

            async del(keys) {
                let deleted = 0;
                for (const key of keys) {
                    if (this.data.delete(key)) {
                        deleted++;
                    }
                }
                return deleted;
            },

            async scan(cursor, options) {
                const keys = Array.from(this.data.keys());
                const pattern = options.MATCH.replace('*', '');
                const matchedKeys = keys.filter(k => k.startsWith(pattern));
                return { cursor: 0, keys: matchedKeys };
            },

            async connect() {
                return Promise.resolve();
            },

            async quit() {
                this.data.clear();
                return Promise.resolve();
            },

            on() {}
        };

        cache = new VisualQueryCache({
            enabled: true,
            redisClient: mockRedisClient,
            ttlSeconds: 3600
        });
    });

    afterEach(() => {
        cache.resetStats();
    });

    describe('generateKey', () => {
        it('should generate consistent SHA256 keys', () => {
            const key1 = cache.generateKey('test query', 123, 'invoice');
            const key2 = cache.generateKey('test query', 123, 'invoice');

            assert.strictEqual(key1, key2);
            assert.ok(key1.startsWith('visual-query:'));
            assert.strictEqual(key1.length, 77); // prefix (13) + sha256 (64)
        });

        it('should generate different keys for different queries', () => {
            const key1 = cache.generateKey('query1', 123, 'invoice');
            const key2 = cache.generateKey('query2', 123, 'invoice');

            assert.notStrictEqual(key1, key2);
        });

        it('should generate different keys for different document IDs', () => {
            const key1 = cache.generateKey('test query', 123, 'invoice');
            const key2 = cache.generateKey('test query', 456, 'invoice');

            assert.notStrictEqual(key1, key2);
        });

        it('should generate different keys for different domains', () => {
            const key1 = cache.generateKey('test query', 123, 'invoice');
            const key2 = cache.generateKey('test query', 123, 'receipt');

            assert.notStrictEqual(key1, key2);
        });

        it('should normalize domain to lowercase', () => {
            const key1 = cache.generateKey('test', 123, 'INVOICE');
            const key2 = cache.generateKey('test', 123, 'invoice');

            assert.strictEqual(key1, key2);
        });

        it('should handle missing parameters', () => {
            const key1 = cache.generateKey('test');
            const key2 = cache.generateKey('test', '', '');

            assert.strictEqual(key1, key2);
        });
    });

    describe('get and set', () => {
        it('should store and retrieve cached results', async () => {
            const query = 'test query';
            const result = { results: [{ docId: 1, score: 0.9 }] };

            await cache.set(query, 123, 'invoice', result);
            const cached = await cache.get(query, 123, 'invoice');

            assert.deepStrictEqual(cached, result);
        });

        it('should return null for cache miss', async () => {
            const cached = await cache.get('nonexistent query', 123, 'invoice');
            assert.strictEqual(cached, null);
        });

        it('should track cache hits and misses', async () => {
            const query = 'test query';
            const result = { results: [] };

            // Miss
            await cache.get(query, 123, 'invoice');
            assert.strictEqual(cache.stats.misses, 1);
            assert.strictEqual(cache.stats.hits, 0);

            // Set
            await cache.set(query, 123, 'invoice', result);
            assert.strictEqual(cache.stats.sets, 1);

            // Hit
            await cache.get(query, 123, 'invoice');
            assert.strictEqual(cache.stats.hits, 1);
            assert.strictEqual(cache.stats.misses, 1);
        });

        it('should serialize complex objects', async () => {
            const query = 'complex query';
            const result = {
                query: 'test',
                results: [
                    { docId: 1, pageNum: 2, score: 0.95, metadata: { domain: 'invoice' } },
                    { docId: 2, pageNum: 1, score: 0.87, metadata: { domain: 'receipt' } }
                ],
                totalResults: 2
            };

            await cache.set(query, 123, 'invoice', result);
            const cached = await cache.get(query, 123, 'invoice');

            assert.deepStrictEqual(cached, result);
        });

        it('should not cache if result is null', async () => {
            const success = await cache.set('test', 123, 'invoice', null);
            assert.strictEqual(success, false);
            assert.strictEqual(cache.stats.sets, 0);
        });
    });

    describe('getStats', () => {
        it('should calculate hit rate correctly', async () => {
            const result = { results: [] };

            // 3 misses
            await cache.get('q1', 1, 'invoice');
            await cache.get('q2', 2, 'receipt');
            await cache.get('q3', 3, 'general');

            // Store results
            await cache.set('q1', 1, 'invoice', result);
            await cache.set('q2', 2, 'receipt', result);
            await cache.set('q3', 3, 'general', result);

            // 3 hits
            await cache.get('q1', 1, 'invoice');
            await cache.get('q2', 2, 'receipt');
            await cache.get('q3', 3, 'general');

            const stats = cache.getStats();
            assert.strictEqual(stats.hits, 3);
            assert.strictEqual(stats.misses, 3);
            assert.strictEqual(stats.totalRequests, 6);
            assert.strictEqual(stats.hitRate, 50);
            assert.strictEqual(stats.enabled, true);
        });

        it('should handle zero requests', () => {
            const stats = cache.getStats();
            assert.strictEqual(stats.hitRate, 0);
            assert.strictEqual(stats.totalRequests, 0);
        });

        it('should report connection status', () => {
            const stats = cache.getStats();
            assert.strictEqual(stats.connected, true);
        });
    });

    describe('clear', () => {
        it('should delete all cached queries', async () => {
            const result = { results: [] };

            // Add multiple cache entries
            await cache.set('q1', 1, 'invoice', result);
            await cache.set('q2', 2, 'receipt', result);
            await cache.set('q3', 3, 'general', result);

            // Clear cache
            const deleted = await cache.clear();
            assert.strictEqual(deleted, 3);

            // Verify all entries are gone
            const cached1 = await cache.get('q1', 1, 'invoice');
            const cached2 = await cache.get('q2', 2, 'receipt');
            const cached3 = await cache.get('q3', 3, 'general');

            assert.strictEqual(cached1, null);
            assert.strictEqual(cached2, null);
            assert.strictEqual(cached3, null);
        });

        it('should return 0 if no keys to delete', async () => {
            const deleted = await cache.clear();
            assert.strictEqual(deleted, 0);
        });
    });

    describe('resetStats', () => {
        it('should reset all statistics', async () => {
            const result = { results: [] };

            await cache.get('q1', 1, 'invoice');
            await cache.set('q1', 1, 'invoice', result);
            await cache.get('q1', 1, 'invoice');

            assert.strictEqual(cache.stats.hits, 1);
            assert.strictEqual(cache.stats.misses, 1);
            assert.strictEqual(cache.stats.sets, 1);

            cache.resetStats();

            assert.strictEqual(cache.stats.hits, 0);
            assert.strictEqual(cache.stats.misses, 0);
            assert.strictEqual(cache.stats.sets, 0);
        });
    });

    describe('isAvailable', () => {
        it('should return true when enabled and connected', () => {
            assert.strictEqual(cache.isAvailable(), true);
        });

        it('should return false when disabled', () => {
            cache.enabled = false;
            assert.strictEqual(cache.isAvailable(), false);
        });

        it('should return false when not connected', () => {
            mockRedisClient.isOpen = false;
            assert.strictEqual(cache.isAvailable(), false);
        });
    });

    describe('disabled cache', () => {
        beforeEach(() => {
            cache = new VisualQueryCache({
                enabled: false
            });
        });

        it('should return null for get when disabled', async () => {
            const cached = await cache.get('test', 123, 'invoice');
            assert.strictEqual(cached, null);
        });

        it('should return false for set when disabled', async () => {
            const success = await cache.set('test', 123, 'invoice', { results: [] });
            assert.strictEqual(success, false);
        });

        it('should report disabled in stats', () => {
            const stats = cache.getStats();
            assert.strictEqual(stats.enabled, false);
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            mockRedisClient.get = async () => {
                throw new Error('Redis connection failed');
            };
            mockRedisClient.set = async () => {
                throw new Error('Redis connection failed');
            };
        });

        it('should handle get errors gracefully', async () => {
            const cached = await cache.get('test', 123, 'invoice');
            assert.strictEqual(cached, null);
            assert.strictEqual(cache.stats.errors, 1);
        });

        it('should handle set errors gracefully', async () => {
            const success = await cache.set('test', 123, 'invoice', { results: [] });
            assert.strictEqual(success, false);
            assert.strictEqual(cache.stats.errors, 1);
        });
    });
});
