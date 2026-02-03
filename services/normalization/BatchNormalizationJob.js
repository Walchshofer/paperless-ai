/**
 * BatchNormalizationJob.js
 *
 * Orchestrates batch normalization of documents from paperless-ngx library.
 * Processes documents that haven't been normalized yet (ai_normalization_status != 'completed').
 *
 * Architecture Reference: docs/AUTOMATIC_NORMALIZATION_PLAN.md §Task 2.2
 *
 * Job Lifecycle:
 * ┌────────────────────────────────────────────────────────────────┐
 * │                  BATCH NORMALIZATION JOB                       │
 * │                                                                │
 * │  idle → start() → running → completed/failed                   │
 * │                     ↓ ↑                                        │
 * │              pause() ↓ ↑ resume()                              │
 * │                   paused                                       │
 * │                     ↓                                          │
 * │                 cancel() → cancelled                           │
 * │                                                                │
 * │  Events: started, progress, document:*, completed, failed      │
 * └────────────────────────────────────────────────────────────────┘
 */

const EventEmitter = require('events');
const logger = require('../logger');
const paperlessService = require('../paperlessService');
const { PreVisionNormalizer } = require('../experts/normalization/PreVisionNormalizer');
const { NormalizationStore } = require('./NormalizationStore');
const {
  normalizationTotal,
  normalizationPending
} = require('../metrics/normalizationMetrics');

class BatchNormalizationJob extends EventEmitter {
    constructor(options = {}) {
        super();
        this.paperlessService = options.paperlessService || paperlessService;
        this.normalizer = options.normalizer || new PreVisionNormalizer();
        this.store = options.store || new NormalizationStore();

        // Job configuration
        this.concurrency = options.concurrency || 2;
        this.batchLimit = options.batchLimit || 50;
        this.skipCompleted = options.skipCompleted ?? true;

        // Retry configuration
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000; // 1 second
        this.maxDelay = options.maxDelay || 30000; // 30 seconds

        // Job state
        this.jobId = null;
        this.status = 'idle'; // idle, running, paused, completed, failed, cancelled
        this.stats = this._initStats();
        this.errors = [];
    }

    /**
     * Initialize job statistics
     * @private
     */
    _initStats() {
        return {
            total: 0,
            processed: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            retriesTotal: 0,
            startTime: null,
            endTime: null
        };
    }

    /**
     * Retry wrapper with exponential backoff
     * @private
     */
    async _withRetry(fn, context = {}) {
        let lastError;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (attempt < this.maxRetries) {
                    const delay = Math.min(
                        this.baseDelay * Math.pow(2, attempt),
                        this.maxDelay
                    );

                    this.stats.retriesTotal++;

                    this.emit('retry', {
                        ...context,
                        attempt: attempt + 1,
                        maxRetries: this.maxRetries,
                        delay,
                        error: error.message
                    });

                    logger.debug(`[BatchNormalizationJob] Retry ${attempt + 1}/${this.maxRetries} for doc ${context.docId} in ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    }

    /**
     * Start batch normalization job
     * @param {Object} options - Job options
     * @param {number} options.limit - Maximum documents to process (default: from constructor)
     * @param {boolean} options.dryRun - If true, only report what would be done
     * @param {boolean} options.force - Force re-normalization of completed documents
     * @returns {Promise<Object>} Job result with stats
     */
    async run(options = {}) {
        if (this.status === 'running') {
            throw new Error('Job already running');
        }

        const limit = options.limit || this.batchLimit;
        const dryRun = options.dryRun || false;
        const force = options.force || false;

        this.jobId = `batch-norm-${Date.now()}`;
        this.status = 'running';
        this.stats = this._initStats();
        this.stats.startTime = new Date();
        this.errors = [];

        logger.info(`[BatchNormalizationJob] Starting job ${this.jobId}`, { limit, dryRun, force });
        this.emit('started', { jobId: this.jobId, limit, dryRun, force });

        try {
            // Find pending documents
            const documents = await this.findPendingDocuments(limit, force);
            this.stats.total = documents.length;

            // Update pending gauge
            normalizationPending.set(documents.length);

            logger.info(`[BatchNormalizationJob] Found ${documents.length} documents to process`);
            this.emit('progress', this._getProgress());

            // Process documents
            if (!dryRun) {
                await this._processBatch(documents);
            } else {
                logger.info(`[BatchNormalizationJob] Dry-run mode: skipping actual normalization`);
                this.stats.skipped = documents.length;
            }

            this.status = this.status === 'cancelled' ? 'cancelled' : 'completed';
            this.stats.endTime = new Date();

            // Update pending gauge after completion
            normalizationPending.set(0);

            const result = this._getResult();
            logger.info(`[BatchNormalizationJob] Job ${this.jobId} ${this.status}`, result.stats);
            this.emit(this.status, result);
            return result;

        } catch (error) {
            this.status = 'failed';
            this.stats.endTime = new Date();

            // Update pending gauge on failure
            normalizationPending.set(0);

            logger.error(`[BatchNormalizationJob] Job ${this.jobId} failed: ${error.message}`);
            this.emit('failed', { error: error.message, stats: this.stats });
            throw error;
        }
    }

    /**
     * Find documents that need normalization
     * @param {number} limit - Maximum documents to return
     * @param {boolean} force - Include completed documents
     * @returns {Promise<Array>} Array of document objects
     */
    async findPendingDocuments(limit, force = false) {
        const allDocs = await this.paperlessService.getAllDocuments();
        
        let pending = [];
        for (const doc of allDocs) {
            const customFields = doc.custom_fields || {};
            const status = customFields.ai_normalization_status;

            // Skip documents that are already processing (concurrency guard)
            if (status === 'processing') {
                logger.debug(`[BatchNormalizationJob] Skipping doc ${doc.id} - already processing`);
                continue;
            }

            // Skip completed documents unless force is enabled
            if (!force && status === 'completed') {
                continue;
            }

            // Include pending, failed, or null status
            if (!status || status === 'pending' || status === 'failed' || force) {
                pending.push(doc);
            }

            // Stop at limit
            if (pending.length >= limit) {
                break;
            }
        }

        return pending;
    }

    /**
     * Normalize a single document
     * @param {number} docId - Document ID
     * @returns {Promise<Object>} Normalization result
     */
    async normalizeDocument(docId) {
        logger.info(`[BatchNormalizationJob] Normalizing document ${docId}`);
        
        // Check current status (concurrency guard)
        const currentStatus = await this.store.getStatus(docId);
        if (currentStatus.status === 'processing') {
            logger.warn(`[BatchNormalizationJob] Skipping doc ${docId} - already being processed`);
            throw new Error('Document is already being processed');
        }

        // Update status to processing
        await this.store.updatePaperlessMetadata(docId, 'processing', null);

        try {
            // Run normalization
            const result = await this.normalizer.analyzeAndNormalize(docId);

            // Store normalized images if changes detected
            if (result.changesDetected && result.normalizedPages) {
                await this.store.store(docId, result.normalizedPages);
                logger.info(`[BatchNormalizationJob] Stored ${result.normalizedPages.length} normalized pages for doc ${docId}`);
            } else {
                // No changes - update status to skipped
                await this.store.updatePaperlessMetadata(docId, 'skipped', null);
                logger.info(`[BatchNormalizationJob] No changes detected for doc ${docId}`);
            }

            return result;

        } catch (error) {
            // Update status to failed
            await this.store.updatePaperlessMetadata(docId, 'failed', error.message);
            logger.error(`[BatchNormalizationJob] Failed to normalize doc ${docId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process documents in batches with concurrency control
     * @private
     */
    async _processBatch(documents) {
        logger.info(`[BatchNormalizationJob] Processing ${documents.length} documents with concurrency ${this.concurrency}`);

        // Process with concurrency control
        for (let i = 0; i < documents.length; i += this.concurrency) {
            // Check for cancel
            if (this.status === 'cancelled') {
                logger.info('[BatchNormalizationJob] Job cancelled, stopping batch processing');
                break;
            }

            // Wait while paused
            while (this.status === 'paused') {
                await new Promise(r => setTimeout(r, 1000));
            }

            // Check again after pause
            if (this.status === 'cancelled') break;

            const chunk = documents.slice(i, i + this.concurrency);
            await Promise.all(chunk.map(doc => this._processDocument(doc)));
        }
    }

    /**
     * Process a single document with retry and error handling
     * @private
     */
    async _processDocument(doc) {
        const docId = doc.id;
        this.emit('document:start', { docId, title: doc.title });

        try {
            // Normalize with retry
            const result = await this._withRetry(
                () => this.normalizeDocument(docId),
                { docId }
            );

            this.stats.processed++;
            this.stats.succeeded++;

            // Record batch success metric
            normalizationTotal.labels({
                status: 'success',
                trigger: 'batch'
            }).inc();

            this.emit('document:success', {
                docId,
                title: doc.title,
                changesDetected: result.changesDetected,
                actions: result.actions
            });

            logger.info(`[BatchNormalizationJob] Successfully normalized doc ${docId}`);

        } catch (error) {
            this.stats.processed++;
            this.stats.failed++;

            // Record batch failure metric
            normalizationTotal.labels({
                status: 'failed',
                trigger: 'batch'
            }).inc();

            const errorRecord = {
                docId,
                title: doc.title,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.errors.push(errorRecord);

            this.emit('document:failed', errorRecord);

            logger.error(`[BatchNormalizationJob] Failed to normalize doc ${docId}: ${error.message}`);
            // Continue with next document (non-fatal)
        }

        this.emit('progress', this._getProgress());
    }

    /**
     * Pause the job
     */
    pause() {
        if (this.status === 'running') {
            this.status = 'paused';
            logger.info(`[BatchNormalizationJob] Job ${this.jobId} paused`);
            this.emit('paused', { jobId: this.jobId });
        }
    }

    /**
     * Resume the job
     */
    resume() {
        if (this.status === 'paused') {
            this.status = 'running';
            logger.info(`[BatchNormalizationJob] Job ${this.jobId} resumed`);
            this.emit('resumed', { jobId: this.jobId });
        }
    }

    /**
     * Cancel the job
     */
    cancel() {
        if (this.status === 'running' || this.status === 'paused') {
            this.status = 'cancelled';
            logger.info(`[BatchNormalizationJob] Job ${this.jobId} cancelled`);
            this.emit('cancelled', { jobId: this.jobId });
        }
    }

    /**
     * Get current progress
     * @private
     */
    _getProgress() {
        return {
            jobId: this.jobId,
            status: this.status,
            total: this.stats.total,
            processed: this.stats.processed,
            succeeded: this.stats.succeeded,
            failed: this.stats.failed,
            skipped: this.stats.skipped,
            percentage: this.stats.total > 0 
                ? Math.round((this.stats.processed / this.stats.total) * 100) 
                : 0
        };
    }

    /**
     * Get final job result
     * @private
     */
    _getResult() {
        const duration = this.stats.endTime 
            ? this.stats.endTime - this.stats.startTime 
            : null;

        return {
            jobId: this.jobId,
            status: this.status,
            stats: {
                ...this.stats,
                duration
            },
            errors: this.errors
        };
    }

    /**
     * Get current job status
     */
    getStatus() {
        return {
            jobId: this.jobId,
            status: this.status,
            ...this._getProgress()
        };
    }
}

module.exports = { BatchNormalizationJob };
