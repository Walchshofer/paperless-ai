/**
 * VisualIndexingQueue.js
 *
 * Background job queue for visual embedding pre-computation using Bull.
 *
 * Architecture Reference: Epic 0c097db0, P3-T2 (Embedding Pre-Computation)
 *
 * Features:
 * - Bull queue with Redis backend
 * - 5 concurrent workers
 * - Retry on failure (3 attempts)
 * - Job telemetry and statistics
 * - Throughput: 100 docs/hour target
 *
 * Job Flow:
 * Document Uploaded → Add to Queue → Worker Picks Job → Embed Pages →
 * Upsert to Qdrant → Mark Complete → Update Document Status
 */

const Queue = require('bull');
const logger = require('../logger');

/**
 * VisualIndexingQueue handles background processing of visual embeddings.
 */
class VisualIndexingQueue {
    constructor(options = {}) {
        this.queueName = options.queueName || 'visual-indexing-queue';
        this.redisUrl = options.redisUrl ||
            process.env.REDIS_URL ||
            'redis://localhost:6379';

        // Parse Redis URL for Bull configuration
        this.redisConfig = this._parseRedisUrl(this.redisUrl);

        // Create Bull queue
        this.queue = new Queue(this.queueName, {
            redis: this.redisConfig,
            defaultJobOptions: {
                attempts: 3, // Retry failed jobs 3 times
                backoff: {
                    type: 'exponential',
                    delay: 2000 // Start with 2 second delay, doubles each retry
                },
                removeOnComplete: {
                    age: 24 * 3600, // Keep completed jobs for 24 hours
                    count: 1000 // Keep max 1000 completed jobs
                },
                removeOnFail: {
                    age: 7 * 24 * 3600 // Keep failed jobs for 7 days
                }
            }
        });

        // Queue event handlers
        this._setupEventHandlers();

        // Statistics
        this.stats = {
            jobsAdded: 0,
            jobsCompleted: 0,
            jobsFailed: 0,
            jobsRetried: 0,
            totalProcessingTime: 0,
            averageProcessingTime: 0
        };
    }

    /**
     * Parse Redis URL into Bull-compatible config
     * @private
     */
    _parseRedisUrl(redisUrl) {
        try {
            const url = new URL(redisUrl);
            return {
                host: url.hostname || 'localhost',
                port: parseInt(url.port) || 6379,
                password: url.password || undefined,
                db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0
            };
        } catch (error) {
            logger.warn(`[VisualIndexingQueue] Failed to parse Redis URL, using defaults: ${error.message}`);
            return {
                host: 'localhost',
                port: 6379
            };
        }
    }

    /**
     * Setup Bull queue event handlers
     * @private
     */
    _setupEventHandlers() {
        this.queue.on('error', (error) => {
            logger.error('[VisualIndexingQueue] Queue error:', error.message);
        });

        this.queue.on('waiting', (jobId) => {
            logger.debug(`[VisualIndexingQueue] Job ${jobId} waiting`);
        });

        this.queue.on('active', (job) => {
            logger.info({
                event: 'visual_indexing_job_active',
                jobId: job.id,
                documentId: job.data.documentId,
                attempt: job.attemptsMade + 1
            });
        });

        this.queue.on('completed', (job, result) => {
            this.stats.jobsCompleted++;
            const processingTime = result.duration || 0;
            this.stats.totalProcessingTime += processingTime;
            this.stats.averageProcessingTime = this.stats.jobsCompleted > 0
                ? Math.round(this.stats.totalProcessingTime / this.stats.jobsCompleted)
                : 0;

            logger.info({
                event: 'visual_indexing_job_completed',
                jobId: job.id,
                documentId: job.data.documentId,
                pagesIndexed: result.pagesIndexed,
                duration: processingTime,
                attempt: job.attemptsMade + 1
            });
        });

        this.queue.on('failed', (job, err) => {
            this.stats.jobsFailed++;
            logger.error({
                event: 'visual_indexing_job_failed',
                jobId: job.id,
                documentId: job.data.documentId,
                error: err.message,
                attempt: job.attemptsMade + 1,
                maxAttempts: job.opts.attempts
            });
        });

        this.queue.on('retrying', (job, err) => {
            this.stats.jobsRetried++;
            logger.warn({
                event: 'visual_indexing_job_retrying',
                jobId: job.id,
                documentId: job.data.documentId,
                error: err.message,
                attempt: job.attemptsMade + 1,
                maxAttempts: job.opts.attempts
            });
        });

        this.queue.on('stalled', (job) => {
            logger.warn({
                event: 'visual_indexing_job_stalled',
                jobId: job.id,
                documentId: job.data.documentId
            });
        });
    }

    /**
     * Add a visual indexing job to the queue
     * @param {Object} document - Paperless document object
     * @param {Object} options - Job options
     * @returns {Promise<Object>} Bull job
     */
    async addJob(document, options = {}) {
        if (!document || !document.id) {
            throw new Error('Document object with id is required');
        }

        const jobData = {
            documentId: document.id,
            document: {
                id: document.id,
                title: document.title,
                page_count: document.page_count || document.pageCount,
                correspondent: document.correspondent,
                tags: document.tags,
                created: document.created,
                added: document.added
            },
            timestamp: Date.now(),
            ...options
        };

        const job = await this.queue.add(jobData, {
            jobId: `doc-${document.id}-${Date.now()}`, // Unique job ID
            priority: options.priority || 10, // Lower number = higher priority
            ...options
        });

        this.stats.jobsAdded++;

        logger.info({
            event: 'visual_indexing_job_added',
            jobId: job.id,
            documentId: document.id,
            queuePosition: await this.queue.count()
        });

        return job;
    }

    /**
     * Get job by ID
     * @param {string} jobId - Bull job ID
     * @returns {Promise<Object|null>} Bull job or null
     */
    async getJob(jobId) {
        return this.queue.getJob(jobId);
    }

    /**
     * Get queue statistics
     * @returns {Promise<Object>} Queue stats
     */
    async getQueueStats() {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.queue.getWaitingCount(),
            this.queue.getActiveCount(),
            this.queue.getCompletedCount(),
            this.queue.getFailedCount(),
            this.queue.getDelayedCount()
        ]);

        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
            total: waiting + active + completed + failed + delayed,
            ...this.stats
        };
    }

    /**
     * Get processing statistics
     * @returns {Object} Processing stats
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Clear all jobs from the queue
     * @returns {Promise<void>}
     */
    async clearQueue() {
        await this.queue.empty();
        logger.info('[VisualIndexingQueue] Queue cleared');
    }

    /**
     * Pause queue processing
     * @returns {Promise<void>}
     */
    async pause() {
        await this.queue.pause();
        logger.info('[VisualIndexingQueue] Queue paused');
    }

    /**
     * Resume queue processing
     * @returns {Promise<void>}
     */
    async resume() {
        await this.queue.resume();
        logger.info('[VisualIndexingQueue] Queue resumed');
    }

    /**
     * Close queue connection
     * @returns {Promise<void>}
     */
    async close() {
        await this.queue.close();
        logger.info('[VisualIndexingQueue] Queue closed');
    }

    /**
     * Health check
     * @returns {Promise<Object>} Health status
     */
    async health() {
        try {
            const stats = await this.getQueueStats();
            return {
                healthy: true,
                redis: this.redisConfig.host + ':' + this.redisConfig.port,
                queueName: this.queueName,
                ...stats
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
}

// Export singleton and class
const visualIndexingQueue = new VisualIndexingQueue();

module.exports = {
    VisualIndexingQueue,
    visualIndexingQueue
};
