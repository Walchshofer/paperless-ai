/**
 * Visual RAG API Routes
 *
 * Provides hybrid search endpoint combining visual (ColQwen2) and text (RAG) search
 * with Reciprocal Rank Fusion (RRF) for improved document retrieval.
 *
 * Endpoints:
 * - POST /api/visual-rag/search - Hybrid document search
 * - GET /api/visual-rag/health - Health check for visual RAG components
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { ingestionManager, BatchIngestionJob, visualOverlayRepository, pdfRenderer } = require('../../services/visual-rag');
const { getLegendForDomain, DOMAIN_FIELD_SPECS } = require('../../services/visual-rag/overlayConfig');
const logger = require('../../services/logger');
const paperlessService = require('../../services/paperlessService');
const config = require('../../config/config');

const resolveRelativePdfPath = (doc, docId) => {
  const archiveFileName = doc.archive_file_name || doc.archive_filename || null;
  const originalFileName = doc.original_file_name || `doc_${docId}.pdf`;
  if (archiveFileName) {
    return path.posix.join('documents', 'archive', archiveFileName);
  }
  return path.posix.join('documents', 'originals', originalFileName);
};

// Simple base64 validator - allows padded base64 strings and ignores whitespace
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
function isValidBase64(s) {
  if (!s || typeof s !== 'string') return false;
  const stripped = s.replace(/\s+/g, '');
  // Reject obviously too-short strings (not a real image) — allow small test fixtures
  if (stripped.length < 8) return false;
  // First try simple regex check
  if (!BASE64_RE.test(stripped)) return false;
  // Then try a lightweight decode/encode roundtrip to be more robust
  try {
    const decoded = Buffer.from(stripped, 'base64');
    if (!decoded || decoded.length === 0) return false;
    const reencoded = decoded.toString('base64').replace(/=+$/, '');
    const originalNoPad = stripped.replace(/=+$/, '');
    return reencoded === originalNoPad || reencoded === originalNoPad.replace(/\s+/g, '');
  } catch (err) {
    return false;
  }
}

// Store active batch jobs (in production, consider using Redis or database)
const activeJobs = new Map();

/**
 * @swagger
 * /api/visual-rag/search:
 *   post:
 *     summary: Hybrid document search
 *     description: |
 *       Search documents using hybrid visual and text embeddings with RRF fusion.
 *       Supports three search modes: hybrid, visual-only, and text-only.
 *     tags: [Visual RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *                 example: "invoice with signature"
 *               k:
 *                 type: integer
 *                 description: Number of results to return
 *                 default: 5
 *               mode:
 *                 type: string
 *                 enum: [hybrid, visual, text]
 *                 description: Search mode
 *                 default: hybrid
 *               includeOverlays:
 *                 type: boolean
 *                 description: Include bounding box overlays in results
 *                 default: true
 *               alpha:
 *                 type: number
 *                 description: Visual weight for hybrid mode (0-1, 0.5 = equal)
 *                 default: 0.5
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 query:
 *                   type: string
 *                 mode:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 totalResults:
 *                   type: integer
 *       400:
 *         description: Missing required query parameter
 *       500:
 *         description: Search failed
 */
router.post('/search', async (req, res) => {
    try {
        const {
            query,
            k = 5,
            mode = 'hybrid',
            includeOverlays = true,
            alpha
        } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        logger.info(`[Visual-RAG API] Search: "${query}" (mode=${mode}, k=${k})`);

        const results = await ingestionManager.hybridSearch(query, {
            k,
            mode,
            includeOverlays,
            alpha
        });

        res.json({
            success: true,
            query,
            mode,
            ...results
        });
    } catch (error) {
        logger.error('[Visual-RAG API] Search failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/visual-rag/search/visual:
 *   post:
 *     summary: Visual-based document search (Find Similar)
 *     description: |
 *       Search for documents using an image region (base64) as the query.
 *       Proxies to the Visual RAG Sidecar.
 *     tags: [Visual RAG]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 description: Base64 encoded image
 *               k:
 *                 type: integer
 *                 default: 5
 *               includeOverlays:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Search results
 *       503:
 *         description: Sidecar unavailable (Circuit Breaker)
 */
router.post('/search/visual', async (req, res) => {
    const { visualSearchClient } = require('../../services/visual-rag/VisualSearchClient');
    const { metricsCollector } = require('../../services/metrics/PrometheusMetrics');
    
    try {
        const { image, k = 5, includeOverlays = true } = req.body;
        const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

        // Validate presence
        if (!image) {
            return res.status(400).json({ success: false, error: 'Image (base64) is required' });
        }

        // Validate simple base64 shape to provide early feedback for malformed requests
        if (!isValidBase64(image)) {
            logger.warn('[Visual-RAG API] Invalid base64 image payload', { request_id: requestId });
            return res.status(400).json({ success: false, error: 'Invalid image (not valid base64)' });
        }

        // Circuit Breaker Check
        const isAvailable = await visualSearchClient.isAvailable();
        if (!isAvailable) {
            logger.warn('[Visual-RAG API] Sidecar unavailable (Circuit Breaker Open)', { request_id: requestId });
            
            // Emit circuit breaker open metric (labels API)
            try {
                if (metricsCollector?.circuitBreakerOpenTotal && typeof metricsCollector.circuitBreakerOpenTotal.labels === 'function') {
                    metricsCollector.circuitBreakerOpenTotal.labels('visual-rag').inc();
                } else if (metricsCollector?.recordCircuitBreakerStateTransition) {
                    // Best-effort (may record only transitions when available)
                    metricsCollector.recordCircuitBreakerStateTransition('visual-rag', 'CLOSED', 'OPEN');
                }
            } catch (mErr) {
                logger.debug('[Visual-RAG API] Metrics emit failed for circuit breaker open', { error: mErr.message });
            }

            // Record sidecar availability explicitly
            try {
                if (metricsCollector?.recordSidecarAvailability) metricsCollector.recordSidecarAvailability('visual-rag', false);
            } catch (mErr) {
                logger.debug('[Visual-RAG API] Metrics emit failed for sidecar availability', { error: mErr.message });
            }

            return res.status(503).json({
                success: false,
                error: 'Visual search service is temporarily unavailable',
                circuit_breaker: 'open'
            });
        }

        logger.info(`[Visual-RAG API] Visual Search (k=${k})`, { request_id: requestId });

        // Execute Search (measure at route-level for visual_query_execution_time_ms)
        const start = Date.now();
        const results = await visualSearchClient.searchImage(image, { k, requestId });
        const durationMs = Date.now() - start;

        // Metrics: visual query execution and query counters
        try {
            if (metricsCollector?.observeVisualQueryExecutionTime) {
                metricsCollector.observeVisualQueryExecutionTime('unknown', durationMs);
            }
        } catch (mErr) {
            logger.debug('[Visual-RAG API] Metrics emit failed for visual query execution time', { error: mErr.message });
        }

        try {
            if (metricsCollector?.incrementVisualQueriesExecuted) {
                metricsCollector.incrementVisualQueriesExecuted('unknown', 'image');
            } else if (metricsCollector?.visualQueriesExecutedTotal && typeof metricsCollector.visualQueriesExecutedTotal.labels === 'function') {
                metricsCollector.visualQueriesExecutedTotal.labels('unknown', 'image').inc();
            }
        } catch (mErr) {
            logger.debug('[Visual-RAG API] Metrics emit failed for visual queries executed', { error: mErr.message });
        }

        res.json({
            success: true,
            query: '[IMAGE]',
            results: results.results,
            totalResults: results.totalResults
        });

    } catch (error) {
        logger.error('[Visual-RAG API] Visual search failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/visual-rag/health:
 *   get:
 *     summary: Visual RAG health check
 *     description: Check the health status of visual RAG components
 *     tags: [Visual RAG]
 *     responses:
 *       200:
 *         description: Health status of components
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 visualSearchClient:
 *                   type: boolean
 *                 overlayRepository:
 *                   type: boolean
 *                 overlayExtractor:
 *                   type: boolean
 */
router.get('/health', async (req, res) => {
    try {
        const health = await ingestionManager.healthCheck();
        res.json(health);
    } catch (error) {
        logger.error('[Visual-RAG API] Health check failed:', error.message);
        res.status(500).json({
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/visual-rag/stats:
 *   get:
 *     summary: Ingestion statistics
 *     description: Get statistics about document ingestion
 *     tags: [Visual RAG]
 *     responses:
 *       200:
 *         description: Ingestion statistics
 */
router.get('/stats', (req, res) => {
    const stats = ingestionManager.getStats();
    res.json(stats);
});

// ============================================================================
// Batch Ingestion API
// ============================================================================

/**
 * @swagger
 * /api/visual-rag/batch/start:
 *   post:
 *     summary: Start batch ingestion job
 *     description: |
 *       Start a background job to ingest multiple documents from paperless-ngx.
 *       Returns immediately with a jobId for monitoring progress.
 *     tags: [Visual RAG, Batch]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filters:
 *                 type: object
 *                 properties:
 *                   createdAfter:
 *                     type: string
 *                     format: date
 *                   createdBefore:
 *                     type: string
 *                     format: date
 *                   documentType:
 *                     type: integer
 *                   tagId:
 *                     type: integer
 *                   pdfOnly:
 *                     type: boolean
 *                     default: true
 *               options:
 *                 type: object
 *                 properties:
 *                   concurrency:
 *                     type: integer
 *                     default: 2
 *                   skipIngested:
 *                     type: boolean
 *                     default: true
 *                   maxRetries:
 *                     type: integer
 *                     default: 3
 *                   dpi:
 *                     type: integer
 *                     default: 300
 *                   batchLimit:
 *                     type: integer
 *                     description: Limit number of documents to process
 *     responses:
 *       200:
 *         description: Job started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 jobId:
 *                   type: string
 *                 message:
 *                   type: string
 */
router.post('/batch/start', async (req, res) => {
    try {
        const { filters = {}, options = {} } = req.body;

        const job = new BatchIngestionJob({
            concurrency: options.concurrency || 2,
            skipIngested: options.skipIngested ?? true,
            forceReingest: options.forceReingest ?? false,
            maxRetries: options.maxRetries || 3,
            dpi: options.dpi || 300,
            batchLimit: options.batchLimit || null
        });

        // Generate jobId before starting
        job.jobId = `batch-${Date.now()}`;

        // Store job for monitoring
        activeJobs.set(job.jobId, job);

        logger.info(`[Visual-RAG API] Starting batch job ${job.jobId}`, { filters, options });

        // Start job in background (don't await)
        job.start(filters)
            .then(result => {
                logger.info(`[Visual-RAG API] Batch job ${job.jobId} completed:`, result.stats);
            })
            .catch(error => {
                logger.error(`[Visual-RAG API] Batch job ${job.jobId} failed:`, error.message);
            })
            .finally(() => {
                // Keep completed jobs for 1 hour for status queries
                setTimeout(() => {
                    activeJobs.delete(job.jobId);
                    logger.debug(`[Visual-RAG API] Removed job ${job.jobId} from memory`);
                }, 3600000);
            });

        res.json({
            success: true,
            jobId: job.jobId,
            message: 'Batch ingestion started'
        });
    } catch (error) {
        logger.error('[Visual-RAG API] Batch start failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/visual-rag/batch/{jobId}/status:
 *   get:
 *     summary: Get batch job status
 *     description: Get current progress and status of a batch ingestion job
 *     tags: [Visual RAG, Batch]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job progress
 *       404:
 *         description: Job not found
 */
router.get('/batch/:jobId/status', (req, res) => {
    const job = activeJobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json(job.getStatus());
});

/**
 * @swagger
 * /api/visual-rag/batch/{jobId}/pause:
 *   post:
 *     summary: Pause batch job
 *     tags: [Visual RAG, Batch]
 */
router.post('/batch/:jobId/pause', (req, res) => {
    const job = activeJobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    job.pause();
    res.json({ success: true, status: job.status });
});

/**
 * @swagger
 * /api/visual-rag/batch/{jobId}/resume:
 *   post:
 *     summary: Resume paused batch job
 *     tags: [Visual RAG, Batch]
 */
router.post('/batch/:jobId/resume', (req, res) => {
    const job = activeJobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    job.resume();
    res.json({ success: true, status: job.status });
});

/**
 * @swagger
 * /api/visual-rag/batch/{jobId}/cancel:
 *   post:
 *     summary: Cancel batch job
 *     tags: [Visual RAG, Batch]
 */
router.post('/batch/:jobId/cancel', (req, res) => {
    const job = activeJobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    job.cancel();
    res.json({ success: true, status: job.status });
});

/**
 * @swagger
 * /api/visual-rag/batch/list:
 *   get:
 *     summary: List all batch jobs
 *     description: List all active and recently completed batch jobs
 *     tags: [Visual RAG, Batch]
 *     responses:
 *       200:
 *         description: List of jobs
 */
router.get('/batch/list', (req, res) => {
    const jobs = Array.from(activeJobs.values()).map(job => ({
        jobId: job.jobId,
        status: job.status,
        stats: job.stats,
        errors: job.errors.length
    }));
    res.json({ jobs, count: jobs.length });
});

// ============================================================================
// Overlay API (for UI visualization)
// ============================================================================

/**
 * @swagger
 * /api/visual-rag/overlays/{docId}:
 *   get:
 *     summary: Get overlays for a document
 *     description: Retrieve all bounding box overlays for a document, formatted for UI display
 *     tags: [Visual RAG, Overlays]
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Filter by page number (optional)
 *     responses:
 *       200:
 *         description: Document overlays
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 docId:
 *                   type: integer
 *                 overlays:
 *                   type: array
 *                 count:
 *                   type: integer
 */
router.get('/overlays/:docId', async (req, res) => {
    try {
        const docId = parseInt(req.params.docId, 10);
        const { page } = req.query;

        if (isNaN(docId)) {
            return res.status(400).json({ error: 'Invalid document ID' });
        }

        let overlays;
        if (page) {
            overlays = await visualOverlayRepository.getByDocIdAndPage(docId, parseInt(page, 10));
        } else {
            overlays = await visualOverlayRepository.getByDocId(docId);
        }

        // Transform to UI format
        const formatted = overlays.map(o => {
            const data = o.overlayData || {};

            // Prefer new format fields, fall back to legacy
            return {
                id: data.id || o.id,
                label: data.label || o.semanticLabel || 'Unknown',
                value: data.value || data.text || null,
                domain: data.domain || 'GENERAL',
                color: data.color || '#6B7280',
                boundingBox: data.boundingBox || {
                    x: data.box?.[1] || data.x_min || 0,
                    y: data.box?.[0] || data.y_min || 0,
                    width: (data.box?.[3] - data.box?.[1]) || (data.x_max - data.x_min) || 0,
                    height: (data.box?.[2] - data.box?.[0]) || (data.y_max - data.y_min) || 0
                },
                paperlessMapping: data.paperlessMapping || null,
                isMandatory: data.isMandatory || false,
                confidence: data.confidence || o.confidence || 0.5,
                pageNumber: o.pageNumber || data.pageNumber || 1
            };
        });

        res.json({
            docId,
            overlays: formatted,
            count: formatted.length
        });
    } catch (error) {
        logger.error('[Visual-RAG API] Get overlays failed:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * @swagger
 * /api/visual-rag/legend/{domain}:
 *   get:
 *     summary: Get legend for a domain
 *     description: Get field legend data for a specific document domain
 *     tags: [Visual RAG, Overlays]
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema:
 *           type: string
 *           enum: [financial, medical, legal, general]
 *     responses:
 *       200:
 *         description: Legend fields
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   key:
 *                     type: string
 *                   label:
 *                     type: string
 *                   color:
 *                     type: string
 *                   mapping:
 *                     type: string
 *                   isMandatory:
 *                     type: boolean
 *       404:
 *         description: Domain not found
 */
router.get('/legend/:domain', (req, res) => {
    const domain = req.params.domain.toLowerCase();
    const legend = getLegendForDomain(domain);

    if (!legend || legend.length === 0) {
        return res.status(404).json({ error: 'Domain not found' });
    }

    res.json(legend);
});

/**
 * @swagger
 * /api/visual-rag/domains:
 *   get:
 *     summary: Get available domains
 *     description: List all available document domains with field counts
 *     tags: [Visual RAG, Overlays]
 *     responses:
 *       200:
 *         description: List of domains
 */
router.get('/domains', (req, res) => {
    const domains = Object.keys(DOMAIN_FIELD_SPECS).map(key => ({
        key,
        name: DOMAIN_FIELD_SPECS[key].name,
        fieldCount: Object.keys(DOMAIN_FIELD_SPECS[key].fields).length,
        mandatoryCount: DOMAIN_FIELD_SPECS[key].mandatory.length
    }));

    res.json({ domains });
});

/**
 * @swagger
 * /api/visual-rag/ingest/{docId}:
 *   post:
 *     summary: Ingest/reingest single document
 *     description: Process a single document through the Visual RAG pipeline
 *     tags: [Visual RAG, Ingestion]
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: Force re-ingestion even if already processed
 *     responses:
 *       200:
 *         description: Ingestion result
 *       500:
 *         description: Ingestion failed
 */
router.post('/ingest/:docId', async (req, res) => {
    const docId = parseInt(req.params.docId, 10);
    const { force = false } = req.body || {};

    if (isNaN(docId)) {
        return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }

    try {
        logger.info(`[Visual-RAG API] Ingesting document ${docId} (force=${force})`);

        // Check if already ingested and not forcing
        if (!force) {
            const hasOverlays = await visualOverlayRepository.hasOverlays(docId);
            if (hasOverlays) {
                return res.json({
                    success: true,
                    message: 'Document already ingested',
                    overlayCount: (await visualOverlayRepository.getByDocId(docId)).length,
                    skipped: true
                });
            }
        }

        // Fetch document metadata from paperless
        const doc = await paperlessService.getDocumentMetadata(docId);
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }

        // Download PDF
        const pdfBuffer = await paperlessService.downloadDocument(docId);
        if (!pdfBuffer) {
            return res.status(404).json({ success: false, error: 'Failed to download document' });
        }

        // Render PDF to images
        const images = await pdfRenderer.renderBuffer(pdfBuffer, { dpi: config.visualRag.visionRenderDpi, docId });

        // Delete existing overlays if re-ingesting
        if (force) {
            await visualOverlayRepository.deleteByDocId(docId);
        }

        // Ingest through pipeline
        const pdfPath = resolveRelativePdfPath(doc, docId);
        const result = await ingestionManager.ingestDocument(docId, pdfPath, {
            base64Images: images.map(i => i.base64),
            metadata: {
                title: doc.title,
                tags: doc.tags?.map(t => t.name || t) || []
            }
        });

        logger.info(`[Visual-RAG API] Document ${docId} ingested: ${result.overlayExtraction?.overlayCount || 0} overlays`);

        res.json({
            success: true,
            docId,
            overlayCount: result.overlayExtraction?.overlayCount || 0,
            domain: result.overlayExtraction?.domain || 'general',
            pagesProcessed: images.length
        });
    } catch (error) {
        logger.error(`[Visual-RAG API] Ingest failed for ${docId}:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

const feedbackService = require('../../services/feedback/FeedbackService');

/**
 * @swagger
 * /api/visual-rag/feedback:
 *   post:
 *     summary: Record user feedback
 *     description: Submit granular feedback (corrections, annotations) for a document
 *     tags: [Visual RAG, Feedback]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - events
 *             properties:
 *               documentId:
 *                 type: integer
 *               events:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [correction, annotation, verification]
 *                     field:
 *                       type: string
 *                     original:
 *                       type: string
 *                     corrected:
 *                       type: string
 *     responses:
 *       200:
 *         description: Feedback recorded
 *       500:
 *         description: Failed to record feedback
 */
router.post('/feedback', async (req, res) => {
    try {
        const { documentId, events } = req.body;
        const requestId = req.headers['x-request-id'] || `req-${Date.now()}`;

        if (!documentId || !Array.isArray(events)) {
            return res.status(400).json({ error: 'Invalid payload: documentId and events array required' });
        }

        const result = await feedbackService.recordGranularFeedback(documentId, events, { requestId });

        // If there are deferred ingests, signal accepted (202) and provide details
        const hasDeferred = Array.isArray(result.errors) && result.errors.some(e => e.type && e.type.startsWith('deferred'));
        if (hasDeferred) {
            logger.info('[Visual-RAG API] Feedback accepted with deferred ingestion', { request_id: requestId, documentId, hardware_target: 'RTX 3090 Ti' });
            return res.status(202).json({ success: true, deferred: true, details: result.errors, ...result });
        }

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        logger.error('[Visual-RAG API] Feedback recording failed:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
