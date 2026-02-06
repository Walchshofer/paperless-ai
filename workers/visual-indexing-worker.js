/**
 * visual-indexing-worker.js
 *
 * Background worker for visual embedding pre-computation.
 *
 * Architecture Reference: Epic 0c097db0, P3-T2 (Embedding Pre-Computation)
 *
 * Worker Configuration:
 * - Concurrency: 5 workers
 * - Retry: 3 attempts with exponential backoff
 * - Throughput: 100 docs/hour target (~36 seconds per doc)
 *
 * Processing Flow:
 * 1. Receive job from queue
 * 2. Download PDF from Paperless-ngx
 * 3. Render PDF pages to images
 * 4. Call IngestionManager to embed and index
 * 5. Update job status and telemetry
 */

const logger = require('../services/logger');
const config = require('../config/config');
const { visualIndexingQueue } = require('../services/queues/VisualIndexingQueue');
const { ingestionManager } = require('../services/visual-rag-client/IngestionManager');
const paperlessService = require('../services/paperlessService');
const { pdfRenderer } = require('../services/visual-rag-client/PDFRenderer');
const path = require('path');

// Telemetry
let telemetryCollector = null;
try {
    const TelemetryCollector = require('../services/TelemetryCollector');
    telemetryCollector = TelemetryCollector;
} catch (error) {
    logger.debug('[VisualIndexingWorker] TelemetryCollector not available');
}

/**
 * Resolve relative PDF path for IngestionManager
 * @param {Object} document - Paperless document
 * @param {number} documentId - Document ID
 * @returns {string} Relative PDF path
 */
function resolveRelativePdfPath(document, documentId) {
    if (document?.original_file_name) {
        return document.original_file_name;
    }
    if (document?.archive_serial_number) {
        return path.join('archive', `${String(document.archive_serial_number).padStart(7, '0')}.pdf`);
    }
    return path.join('documents', `${documentId}.pdf`);
}

/**
 * Process a visual indexing job
 * @param {Object} job - Bull job object
 * @returns {Promise<Object>} Job result
 */
async function processVisualIndexingJob(job) {
    const startTime = Date.now();
    const { documentId, document } = job.data;

    logger.info({
        event: 'visual_indexing_job_started',
        jobId: job.id,
        documentId,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts
    });

    // Update job progress
    await job.progress(10);

    // Check if visual RAG sidecar is enabled
    if (config.visualRagSidecar?.enabled !== 'yes') {
        logger.warn({
            event: 'visual_indexing_job_skipped',
            jobId: job.id,
            documentId,
            reason: 'Visual RAG sidecar not enabled'
        });
        return {
            success: false,
            skipped: true,
            reason: 'Visual RAG sidecar not enabled',
            duration: Date.now() - startTime
        };
    }

    try {
        // Step 1: Download PDF from Paperless-ngx
        await job.progress(20);
        logger.debug(`[VisualIndexingWorker] Downloading PDF for doc ${documentId}`);

        const pdfBuffer = await paperlessService.downloadOriginalDocument(documentId) ||
            await paperlessService.downloadDocument(documentId);

        if (!pdfBuffer) {
            throw new Error(`PDF not found for document ${documentId}`);
        }

        // Step 2: Check PDF renderer availability
        await job.progress(30);
        if (!(await pdfRenderer.isAvailableAsync())) {
            throw new Error('PDF renderer not available');
        }

        // Step 3: Render PDF pages to images
        await job.progress(40);
        logger.debug(`[VisualIndexingWorker] Rendering pages for doc ${documentId}`);

        const pageCount = Number.parseInt(
            String(document.page_count || document.pageCount || ''),
            10
        );

        const renderOptions = {
            dpi: config.visualRag?.visionRenderDpi,
            docId: `worker-${documentId}`
        };

        if (Number.isInteger(pageCount) && pageCount > 0) {
            renderOptions.maxPages = pageCount;
        }

        const images = await pdfRenderer.renderBuffer(pdfBuffer, renderOptions);
        const base64Images = images
            .map(image => image.base64)
            .filter(value => typeof value === 'string' && value.length > 0);

        if (base64Images.length === 0) {
            throw new Error(`No pages rendered for document ${documentId}`);
        }

        // Step 4: Ingest document (embed and index)
        await job.progress(60);
        logger.debug(`[VisualIndexingWorker] Ingesting ${base64Images.length} pages for doc ${documentId}`);

        const pdfPath = resolveRelativePdfPath(document, documentId);
        const ingestionResult = await ingestionManager.ingestDocument(
            documentId,
            pdfPath,
            {
                base64Images,
                fetchOcrText: false, // Skip OCR fetch in background job to save time
                metadata: {
                    title: document.title,
                    domain: 'general',
                    page_count: pageCount,
                    correspondent_id: document.correspondent,
                    tag_ids: Array.isArray(document.tags) ? document.tags : []
                }
            }
        );

        // Step 5: Mark complete
        await job.progress(100);

        const duration = Date.now() - startTime;
        const result = {
            success: true,
            documentId,
            pagesIndexed: base64Images.length,
            duration,
            ingestionResult
        };

        logger.info({
            event: 'visual_indexing_job_success',
            jobId: job.id,
            documentId,
            pagesIndexed: base64Images.length,
            duration,
            attempt: job.attemptsMade + 1
        });

        // Log to telemetry if available
        if (telemetryCollector?.setJobStats) {
            telemetryCollector.setJobStats({
                jobId: job.id,
                documentId,
                status: 'completed',
                pagesIndexed: base64Images.length,
                duration,
                attempt: job.attemptsMade + 1
            });
        }

        return result;

    } catch (error) {
        const duration = Date.now() - startTime;

        logger.error({
            event: 'visual_indexing_job_error',
            jobId: job.id,
            documentId,
            error: error.message,
            stack: error.stack,
            duration,
            attempt: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts
        });

        // Log to telemetry if available
        if (telemetryCollector?.setJobStats) {
            telemetryCollector.setJobStats({
                jobId: job.id,
                documentId,
                status: 'failed',
                error: error.message,
                duration,
                attempt: job.attemptsMade + 1
            });
        }

        // Determine if job should be retried
        const willRetry = job.attemptsMade < (job.opts.attempts - 1);

        if (willRetry) {
            logger.warn({
                event: 'visual_indexing_job_will_retry',
                jobId: job.id,
                documentId,
                nextAttempt: job.attemptsMade + 2,
                maxAttempts: job.opts.attempts
            });
        } else {
            logger.error({
                event: 'visual_indexing_job_exhausted',
                jobId: job.id,
                documentId,
                totalAttempts: job.attemptsMade + 1
            });
        }

        // Re-throw error to trigger Bull retry mechanism
        throw error;
    }
}

/**
 * Start the worker
 */
async function startWorker() {
    const CONCURRENCY = 5;

    logger.info({
        event: 'visual_indexing_worker_starting',
        concurrency: CONCURRENCY,
        queueName: visualIndexingQueue.queueName,
        redis: visualIndexingQueue.redisConfig.host + ':' + visualIndexingQueue.redisConfig.port
    });

    // Process jobs with concurrency of 5
    visualIndexingQueue.queue.process(CONCURRENCY, processVisualIndexingJob);

    logger.info({
        event: 'visual_indexing_worker_started',
        concurrency: CONCURRENCY,
        status: 'ready'
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        logger.info('[VisualIndexingWorker] SIGTERM received, shutting down gracefully...');
        await visualIndexingQueue.queue.close();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        logger.info('[VisualIndexingWorker] SIGINT received, shutting down gracefully...');
        await visualIndexingQueue.queue.close();
        process.exit(0);
    });
}

// Start worker if run directly
if (require.main === module) {
    startWorker().catch((error) => {
        logger.error('[VisualIndexingWorker] Failed to start worker:', error);
        process.exit(1);
    });
}

module.exports = {
    processVisualIndexingJob,
    startWorker
};
