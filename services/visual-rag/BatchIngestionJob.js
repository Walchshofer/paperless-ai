/**
 * BatchIngestionJob.js
 *
 * Orchestrates batch ingestion of documents from paperless-ngx library.
 * Provides progress tracking, filtering, and job lifecycle management.
 *
 * Architecture Reference: PROMPT-007 (Batch Ingestion)
 *
 * Job Lifecycle:
 * ┌────────────────────────────────────────────────────────────────┐
 * │                      BATCH INGESTION JOB                       │
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
const axios = require('axios');
const logger = require('../logger');
const config = require('../../config/config');
const { ingestionManager } = require('./IngestionManager');
const { visualOverlayRepository } = require('./VisualOverlayRepository');
const { pdfRenderer } = require('./PDFRenderer');
const paperlessService = require('../paperlessService');

class BatchIngestionJob extends EventEmitter {
    constructor(options = {}) {
        super();
        this.ingestionManager = options.ingestionManager || ingestionManager;
        this.paperlessService = options.paperlessService || paperlessService;
        this.overlayRepository = options.overlayRepository || visualOverlayRepository;
        this.pdfRenderer = options.pdfRenderer || pdfRenderer;

        // Job configuration
        this.concurrency = options.concurrency || 2;
        this.skipIngested = options.skipIngested ?? true;
        this.forceReingest = options.forceReingest ?? false;
        this.dpi = options.dpi || 300;
        this.batchLimit = options.batchLimit || null; // null = no limit

        // Retry configuration
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000; // 1 second
        this.maxDelay = options.maxDelay || 30000; // 30 seconds

        // Job state
        this.jobId = null;
        this.status = 'idle'; // idle, running, paused, completed, failed, cancelled
        this.stats = this._initStats();
        this.errors = [];
        this.totalRetries = 0;
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

                    logger.debug(`[BatchIngestionJob] Retry ${attempt + 1}/${this.maxRetries} for doc ${context.docId} in ${delay}ms`);
                    await new Promise(r => setTimeout(r, delay));
                }
            }
        }
        throw lastError;
    }

    /**
     * Start batch ingestion job
     * @param {Object} filters - Document filters
     * @param {string} filters.createdAfter - ISO date string for minimum creation date
     * @param {string} filters.createdBefore - ISO date string for maximum creation date
     * @param {number} filters.documentType - Document type ID
     * @param {number} filters.tagId - Tag ID to filter by
     * @param {boolean} filters.pdfOnly - Only process PDF documents (default: true)
     * @returns {Promise<Object>} Job result
     */
    async start(filters = {}) {
        if (this.status === 'running') {
            throw new Error('Job already running');
        }

        this.jobId = `batch-${Date.now()}`;
        this.status = 'running';
        this.stats = this._initStats();
        this.stats.startTime = new Date();
        this.errors = [];

        logger.info(`[BatchIngestionJob] Starting job ${this.jobId}`, { filters });
        this.emit('started', { jobId: this.jobId, filters });

        try {
            // Fetch documents from paperless
            const documents = await this._fetchDocuments(filters);
            this.stats.total = documents.length;

            logger.info(`[BatchIngestionJob] Found ${documents.length} documents to process`);
            this.emit('progress', this._getProgress());

            // Process in batches
            await this._processBatch(documents);

            this.status = this.status === 'cancelled' ? 'cancelled' : 'completed';
            this.stats.endTime = new Date();

            const result = this._getResult();
            logger.info(`[BatchIngestionJob] Job ${this.jobId} ${this.status}`, result.stats);
            this.emit(this.status, result);
            return result;

        } catch (error) {
            this.status = 'failed';
            this.stats.endTime = new Date();
            logger.error(`[BatchIngestionJob] Job ${this.jobId} failed: ${error.message}`);
            this.emit('failed', { error: error.message, stats: this.stats });
            throw error;
        }
    }

    /**
     * Fetch documents from paperless with filters applied
     * @private
     */
    async _fetchDocuments(filters) {
        const allDocs = await this.paperlessService.getAllDocuments();
        let filtered = this._applyFilters(allDocs, filters);

        // Apply batch limit if set
        if (this.batchLimit && this.batchLimit > 0) {
            filtered = filtered.slice(0, this.batchLimit);
        }

        return filtered;
    }

    /**
     * Apply filters to document list
     * @private
     */
    _applyFilters(documents, filters) {
        let filtered = documents;

        // Filter by date range
        if (filters.createdAfter) {
            const after = new Date(filters.createdAfter);
            filtered = filtered.filter(d => new Date(d.created) >= after);
        }
        if (filters.createdBefore) {
            const before = new Date(filters.createdBefore);
            filtered = filtered.filter(d => new Date(d.created) <= before);
        }

        // Filter by document type
        if (filters.documentType) {
            filtered = filtered.filter(d => d.document_type === filters.documentType);
        }

        // Filter by tag
        if (filters.tagId) {
            filtered = filtered.filter(d => d.tags?.includes(filters.tagId));
        }

        // Filter PDF only (default: true)
        if (filters.pdfOnly !== false) {
            filtered = filtered.filter(d =>
                d.mime_type === 'application/pdf' ||
                d.original_file_name?.toLowerCase().endsWith('.pdf')
            );
        }

        return filtered;
    }

    /**
     * Filter out already-ingested documents
     * @private
     */
    async _filterAlreadyIngested(documents) {
        if (this.forceReingest || !this.skipIngested) {
            return documents;
        }

        const repoAvailable = await this.overlayRepository.isAvailable();
        if (!repoAvailable) {
            logger.warn('[BatchIngestionJob] Overlay repository unavailable, skipping filter');
            return documents;
        }

        const toProcess = [];
        for (const doc of documents) {
            const hasOverlays = await this.overlayRepository.hasOverlays(doc.id);
            if (hasOverlays) {
                this.stats.skipped++;
                this.emit('skipped', { docId: doc.id, reason: 'already_ingested' });
            } else {
                toProcess.push(doc);
            }
        }

        logger.info(`[BatchIngestionJob] Filtered ${this.stats.skipped} already-ingested documents`);
        return toProcess;
    }

    /**
     * Process documents in batches with concurrency control
     * @private
     */
    async _processBatch(documents) {
        // Filter already ingested
        const toProcess = await this._filterAlreadyIngested(documents);

        // Update total after filtering
        this.stats.total = toProcess.length + this.stats.skipped;

        logger.info(`[BatchIngestionJob] Processing ${toProcess.length} documents (${this.stats.skipped} skipped)`);

        // Process with concurrency control
        for (let i = 0; i < toProcess.length; i += this.concurrency) {
            // Check for cancel
            if (this.status === 'cancelled') {
                logger.info('[BatchIngestionJob] Job cancelled, stopping batch processing');
                break;
            }

            // Wait while paused
            while (this.status === 'paused') {
                await new Promise(r => setTimeout(r, 1000));
            }

            // Check again after pause
            if (this.status === 'cancelled') break;

            const chunk = toProcess.slice(i, i + this.concurrency);
            await Promise.all(chunk.map(doc => this._processDocument(doc)));
        }
    }

    /**
     * Process a single document through the ingestion pipeline with retry
     * @private
     */
    async _processDocument(doc) {
        const docId = doc.id;
        this.emit('document:start', { docId, title: doc.title });
        logger.debug(`[BatchIngestionJob] Processing document ${docId}: ${doc.title}`);

        try {
            const result = await this._withRetry(
                async () => {
                    // Download PDF
                    const pdfBuffer = await this._downloadPdf(docId);

                    // Render to images
                    const images = await this.pdfRenderer.renderBuffer(pdfBuffer, {
                        dpi: this.dpi,
                        docId
                    });
                    const base64Images = images.map(img => img.base64);

                    // Ingest through IngestionManager
                    return await this.ingestionManager.ingestDocument(
                        docId,
                        doc.original_file_name || `doc-${docId}.pdf`,
                        {
                            base64Images,
                            metadata: {
                                title: doc.title,
                                tags: doc.tags,
                                documentType: doc.document_type,
                                correspondent: doc.correspondent
                            }
                        }
                    );
                },
                { docId, title: doc.title }
            );

            this.stats.processed++;
            this.stats.succeeded++;
            this.emit('document:success', { docId, result });
            this.emit('progress', this._getProgress());

            logger.debug(`[BatchIngestionJob] Document ${docId} succeeded: ${result.overlayExtraction?.overlayCount || 0} overlays`);

        } catch (error) {
            // All retries exhausted
            this.stats.processed++;
            this.stats.failed++;
            this.errors.push({
                docId,
                title: doc.title,
                error: error.message,
                retriesExhausted: true,
                timestamp: new Date()
            });
            this.emit('document:error', { docId, error: error.message, final: true });
            this.emit('progress', this._getProgress());

            logger.warn(`[BatchIngestionJob] Document ${docId} failed after ${this.maxRetries} retries: ${error.message}`);
        }
    }

    /**
     * Download PDF from paperless-ngx
     * @private
     */
    async _downloadPdf(docId) {
        const apiUrl = config.paperless?.apiUrl || process.env.PAPERLESS_API_URL;
        const apiToken = config.paperless?.apiToken || process.env.PAPERLESS_API_TOKEN;

        const response = await axios.get(
            `${apiUrl}/documents/${docId}/download/`,
            {
                headers: { 'Authorization': `Token ${apiToken}` },
                responseType: 'arraybuffer',
                timeout: 60000 // 60 second timeout for large PDFs
            }
        );

        return Buffer.from(response.data);
    }

    /**
     * Get current progress information
     * @returns {Object} Progress with rate and ETA
     */
    _getProgress() {
        const elapsed = Date.now() - this.stats.startTime;
        const rate = this.stats.processed / (elapsed / 1000) || 0;
        const remaining = this.stats.total - this.stats.processed - this.stats.skipped;
        const eta = rate > 0 ? remaining / rate : null;

        return {
            jobId: this.jobId,
            status: this.status,
            ...this.stats,
            percentComplete: this.stats.total > 0
                ? Math.round((this.stats.processed + this.stats.skipped) / this.stats.total * 100)
                : 0,
            rate: Math.round(rate * 100) / 100, // docs/sec
            etaSeconds: eta ? Math.round(eta) : null,
            elapsedMs: elapsed
        };
    }

    /**
     * Get final job result
     * @returns {Object} Complete job result
     */
    _getResult() {
        return {
            jobId: this.jobId,
            status: this.status,
            stats: this.stats,
            errors: this.errors.slice(0, 50), // Limit error list
            duration: this.stats.endTime - this.stats.startTime
        };
    }

    /**
     * Get current status
     * @returns {Object} Current job status and progress
     */
    getStatus() {
        return {
            jobId: this.jobId,
            status: this.status,
            progress: this._getProgress(),
            errors: this.errors.length
        };
    }

    /**
     * Pause the running job
     */
    pause() {
        if (this.status === 'running') {
            this.status = 'paused';
            logger.info(`[BatchIngestionJob] Job ${this.jobId} paused`);
            this.emit('paused', this._getProgress());
        }
    }

    /**
     * Resume a paused job
     */
    resume() {
        if (this.status === 'paused') {
            this.status = 'running';
            logger.info(`[BatchIngestionJob] Job ${this.jobId} resumed`);
            this.emit('resumed', this._getProgress());
        }
    }

    /**
     * Cancel the job
     */
    cancel() {
        if (['running', 'paused'].includes(this.status)) {
            this.status = 'cancelled';
            logger.info(`[BatchIngestionJob] Job ${this.jobId} cancelled`);
            this.emit('cancelled', this._getProgress());
        }
    }
}

/**
 * Factory function for creating batch ingestion jobs
 * @param {Object} options - Job options
 * @returns {BatchIngestionJob} New job instance
 */
function createBatchJob(options = {}) {
    return new BatchIngestionJob(options);
}

module.exports = {
    BatchIngestionJob,
    createBatchJob
};
