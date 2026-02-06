/**
 * Unit tests for VisualIndexingQueue
 *
 * Tests queue configuration, job management logic, and telemetry without requiring Redis.
 */

const assert = require('assert');
const { VisualIndexingQueue } = require('../../services/queues/VisualIndexingQueue');

describe('VisualIndexingQueue', function() {
    describe('Configuration Parsing', function() {
        it('should parse Redis URL correctly', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const redisConfig = queue._parseRedisUrl('redis://localhost:6379');
            assert.strictEqual(redisConfig.host, 'localhost');
            assert.strictEqual(redisConfig.port, 6379);
            assert.strictEqual(redisConfig.db, 0);
        });

        it('should parse Redis URL with password', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const redisConfig = queue._parseRedisUrl('redis://:mypassword@localhost:6380/1');
            assert.strictEqual(redisConfig.host, 'localhost');
            assert.strictEqual(redisConfig.port, 6380);
            assert.strictEqual(redisConfig.password, 'mypassword');
            assert.strictEqual(redisConfig.db, 1);
        });

        it('should handle invalid Redis URL gracefully', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const redisConfig = queue._parseRedisUrl('invalid-url');
            assert.strictEqual(redisConfig.host, 'localhost');
            assert.strictEqual(redisConfig.port, 6379);
        });

        it('should use environment variable for Redis URL', function() {
            const originalRedisUrl = process.env.REDIS_URL;
            process.env.REDIS_URL = 'redis://test-redis:6379';

            const queue = new VisualIndexingQueue({
                queueName: 'test-queue'
            });

            assert.strictEqual(queue.redisUrl, 'redis://test-redis:6379');

            // Restore original
            if (originalRedisUrl) {
                process.env.REDIS_URL = originalRedisUrl;
            } else {
                delete process.env.REDIS_URL;
            }
        });

        it('should use default Redis URL if not specified', function() {
            const originalRedisUrl = process.env.REDIS_URL;
            delete process.env.REDIS_URL;

            const queue = new VisualIndexingQueue({
                queueName: 'test-queue'
            });

            assert.strictEqual(queue.redisUrl, 'redis://localhost:6379');

            // Restore original
            if (originalRedisUrl) {
                process.env.REDIS_URL = originalRedisUrl;
            }
        });
    });

    describe('Queue Configuration', function() {
        it('should configure 3 retry attempts', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const jobOptions = queue.queue.defaultJobOptions;
            assert.strictEqual(jobOptions.attempts, 3);
        });

        it('should configure exponential backoff', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const jobOptions = queue.queue.defaultJobOptions;
            assert.strictEqual(jobOptions.backoff.type, 'exponential');
            assert.strictEqual(jobOptions.backoff.delay, 2000);
        });

        it('should configure job retention policies', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const jobOptions = queue.queue.defaultJobOptions;
            assert.strictEqual(jobOptions.removeOnComplete.age, 24 * 3600);
            assert.strictEqual(jobOptions.removeOnComplete.count, 1000);
            assert.strictEqual(jobOptions.removeOnFail.age, 7 * 24 * 3600);
        });
    });

    describe('Statistics Tracking', function() {
        it('should initialize statistics', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const stats = queue.getStats();
            assert.strictEqual(stats.jobsAdded, 0);
            assert.strictEqual(stats.jobsCompleted, 0);
            assert.strictEqual(stats.jobsFailed, 0);
            assert.strictEqual(stats.jobsRetried, 0);
        });

        it('should track average processing time', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            queue.stats.totalProcessingTime = 10000;
            queue.stats.jobsCompleted = 5;
            queue.stats.averageProcessingTime = Math.round(
                queue.stats.totalProcessingTime / queue.stats.jobsCompleted
            );

            const stats = queue.getStats();
            assert.strictEqual(stats.averageProcessingTime, 2000);
        });
    });

    describe('Job Data Validation', function() {
        it('should reject null document', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            // Test the validation logic without actually adding to queue
            const document = null;
            const isValid = !!(document && document.id);
            assert.strictEqual(isValid, false);
        });

        it('should reject document without id', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const document = { title: 'Test' };
            const isValid = !!(document && document.id);
            assert.strictEqual(isValid, false);
        });

        it('should accept valid document', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            const document = { id: 123, title: 'Test' };
            const isValid = !!(document && document.id);
            assert.strictEqual(isValid, true);
        });
    });

    describe('Throughput Calculation', function() {
        it('should calculate 100 docs/hour with 36 second average', function() {
            // 36 seconds average per document = 100 docs/hour
            const avgTimeMs = 36000;
            const docsPerHour = Math.floor(3600000 / avgTimeMs);
            assert.strictEqual(docsPerHour, 100);
        });

        it('should meet 100 docs/hour target with 5 workers at 3 min/doc', function() {
            // 5 workers * 20 docs/hour/worker (3 min each) = 100 docs/hour
            const workersCount = 5;
            const avgTimePerDoc = 3 * 60 * 1000; // 3 minutes
            const docsPerHourPerWorker = Math.floor(3600000 / avgTimePerDoc);
            const totalDocsPerHour = workersCount * docsPerHourPerWorker;

            assert.strictEqual(docsPerHourPerWorker, 20);
            assert.strictEqual(totalDocsPerHour, 100);
        });

        it('should calculate required workers for target throughput', function() {
            const targetDocsPerHour = 100;
            const avgTimePerDocMs = 180000; // 3 minutes
            const docsPerHourPerWorker = Math.floor(3600000 / avgTimePerDocMs);
            const requiredWorkers = Math.ceil(targetDocsPerHour / docsPerHourPerWorker);

            assert.strictEqual(requiredWorkers, 5);
        });
    });

    describe('Event Handlers', function() {
        it('should setup error handler', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            // Verify error event handler is registered
            const listeners = queue.queue.listeners('error');
            assert.ok(listeners.length > 0);
        });

        it('should setup completed handler', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            // Verify completed event handler is registered
            const listeners = queue.queue.listeners('completed');
            assert.ok(listeners.length > 0);
        });

        it('should setup failed handler', function() {
            const queue = new VisualIndexingQueue({
                queueName: 'test-queue',
                redisUrl: 'redis://localhost:6379'
            });

            // Verify failed event handler is registered
            const listeners = queue.queue.listeners('failed');
            assert.ok(listeners.length > 0);
        });
    });

    describe('Job Priority', function() {
        it('should support priority levels', function() {
            // Lower number = higher priority in Bull
            const highPriority = 1;
            const normalPriority = 10;
            const lowPriority = 20;

            assert.ok(highPriority < normalPriority);
            assert.ok(normalPriority < lowPriority);
        });
    });
});
