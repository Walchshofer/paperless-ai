/**
 * routes/api/normalization.js
 *
 * Management APIs for document normalization:
 * - Manual trigger for single documents
 * - Batch processing job trigger
 * - Status queries
 *
 * Reference: docs/AUTOMATIC_NORMALIZATION_PLAN.md §Task 2.3
 */

const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const logger = require('../../services/logger');
const { PreVisionNormalizer } = require('../../services/experts/normalization/PreVisionNormalizer');
const { NormalizationStore } = require('../../services/normalization/NormalizationStore');
const { BatchNormalizationJob } = require('../../services/normalization/BatchNormalizationJob');

// Initialize services
const normalizer = new PreVisionNormalizer();
const store = new NormalizationStore();

// All routes require authentication
router.use(authenticateApi);

/**
 * @swagger
 * /api/normalization/trigger:
 *   post:
 *     summary: Manually trigger normalization for a single document
 *     description: |
 *       Analyzes and normalizes a document's page geometry (rotation, cropping, scaling).
 *       Can force re-normalization of already-normalized documents.
 *     tags:
 *       - Documents
 *       - API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *             properties:
 *               documentId:
 *                 type: integer
 *                 description: Paperless document ID
 *                 example: 123
 *               force:
 *                 type: boolean
 *                 description: Force re-normalization even if already completed
 *                 default: false
 *               options:
 *                 type: object
 *                 description: Normalization options (rotation, cropping, scaling thresholds)
 *     responses:
 *       200:
 *         description: Normalization completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 documentId:
 *                   type: integer
 *                 changesDetected:
 *                   type: boolean
 *                 actions:
 *                   type: array
 *                   items:
 *                     type: object
 *                 normalizedPages:
 *                   type: array
 *       400:
 *         description: Bad request - missing or invalid documentId
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Normalization failed
 */
router.post('/trigger', async (req, res) => {
    try {
        const { documentId, force = false, options = {} } = req.body;

        if (!documentId || typeof documentId !== 'number') {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'documentId must be a number'
            });
        }

        logger.info(`[API] Normalization trigger requested for doc ${documentId}`, { force });

        // Check if already normalized (unless force is enabled)
        if (!force) {
            const isNormalized = await store.isNormalized(documentId);
            if (isNormalized) {
                logger.info(`[API] Doc ${documentId} already normalized, skipping`);
                return res.json({
                    success: true,
                    documentId,
                    changesDetected: false,
                    skipped: true,
                    reason: 'already_normalized'
                });
            }
        }

        // Update status to processing
        await store.updatePaperlessMetadata(documentId, 'processing', null);

        // Run normalization
        const result = await normalizer.analyzeAndNormalize(documentId, options);

        // Store normalized images if changes detected
        if (result.changesDetected && result.normalizedPages) {
            await store.store(documentId, result.normalizedPages);
            logger.info(`[API] Stored ${result.normalizedPages.length} normalized pages for doc ${documentId}`);
        } else {
            // No changes - update status to skipped
            await store.updatePaperlessMetadata(documentId, 'skipped', null);
            logger.info(`[API] No changes detected for doc ${documentId}`);
        }

        res.json({
            success: true,
            documentId,
            changesDetected: result.changesDetected,
            actions: result.actions,
            normalizedPages: result.normalizedPages?.length || 0
        });

    } catch (error) {
        logger.error(`[API] Normalization trigger failed: ${error.message}`, { error });

        // Update status to failed if we have a documentId
        if (req.body.documentId) {
            try {
                await store.updatePaperlessMetadata(req.body.documentId, 'failed', error.message);
            } catch (updateError) {
                logger.error(`[API] Failed to update status: ${updateError.message}`);
            }
        }

        res.status(500).json({
            error: 'Normalization failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/normalization/batch:
 *   post:
 *     summary: Trigger batch normalization job
 *     description: |
 *       Processes multiple documents that haven't been normalized yet.
 *       Documents with status 'processing' or 'completed' are skipped unless force is enabled.
 *       Supports dry-run mode to preview what would be done.
 *     tags:
 *       - Documents
 *       - API
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               limit:
 *                 type: integer
 *                 description: Maximum documents to process
 *                 default: 50
 *                 example: 10
 *               dryRun:
 *                 type: boolean
 *                 description: If true, only report what would be done without actually normalizing
 *                 default: false
 *               force:
 *                 type: boolean
 *                 description: Force re-normalization of completed documents
 *                 default: false
 *               concurrency:
 *                 type: integer
 *                 description: Number of documents to process in parallel
 *                 default: 2
 *     responses:
 *       200:
 *         description: Batch job completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [completed, failed, cancelled]
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     processed:
 *                       type: integer
 *                     succeeded:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     duration:
 *                       type: integer
 *                 errors:
 *                   type: array
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Batch job failed
 */
router.post('/batch', async (req, res) => {
    try {
        const { limit = 50, dryRun = false, force = false, concurrency = 2 } = req.body;

        logger.info(`[API] Batch normalization requested`, { limit, dryRun, force, concurrency });

        // Create and run batch job
        const job = new BatchNormalizationJob({ concurrency });
        const result = await job.run({ limit, dryRun, force });

        logger.info(`[API] Batch normalization completed`, result.stats);

        res.json(result);

    } catch (error) {
        logger.error(`[API] Batch normalization failed: ${error.message}`, { error });

        res.status(500).json({
            error: 'Batch normalization failed',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/normalization/status/{docId}:
 *   get:
 *     summary: Get normalization status for a document
 *     description: |
 *       Returns the current normalization status and metadata for a document.
 *       Status can be: pending, processing, completed, skipped, or failed.
 *     tags:
 *       - Documents
 *       - API
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 documentId:
 *                   type: integer
 *                 status:
 *                   type: string
 *                   enum: [pending, processing, completed, skipped, failed]
 *                 isNormalized:
 *                   type: boolean
 *                 url:
 *                   type: string
 *                   nullable: true
 *                 metadata:
 *                   type: object
 *                   nullable: true
 *                 error:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Failed to retrieve status
 */
router.get('/status/:docId', async (req, res) => {
    try {
        const docId = parseInt(req.params.docId, 10);

        if (isNaN(docId)) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'docId must be a valid integer'
            });
        }

        logger.debug(`[API] Status query for doc ${docId}`);

        const status = await store.getStatus(docId);

        res.json({
            documentId: docId,
            ...status
        });

    } catch (error) {
        logger.error(`[API] Failed to get status: ${error.message}`, { error });

        res.status(500).json({
            error: 'Failed to retrieve status',
            message: error.message
        });
    }
});

/**
 * @swagger
 * /api/normalization/health:
 *   get:
 *     summary: Health check for normalization system
 *     description: |
 *       Returns health status and statistics for the normalization system.
 *       Includes counts of normalized, pending, processing, and failed documents,
 *       as well as disk usage metrics.
 *     tags:
 *       - Documents
 *       - API
 *     responses:
 *       200:
 *         description: Health check successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalDocuments:
 *                       type: integer
 *                       description: Total normalized documents
 *                     diskUsageBytes:
 *                       type: number
 *                       description: Disk usage in bytes
 *                     diskUsageMb:
 *                       type: number
 *                       description: Disk usage in MB
 *                     stored:
 *                       type: integer
 *                       description: Total stored operations
 *                     updated:
 *                       type: integer
 *                       description: Total metadata updates
 *                     errors:
 *                       type: integer
 *                       description: Total error count
 *                     lastOperation:
 *                       type: string
 *                       description: Timestamp of last operation
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Health check failed
 */
router.get('/health', async (req, res) => {
    try {
        // Get stats from NormalizationStore
        const stats = await store.getStats();

        res.json({
            status: 'ok',
            stats: {
                totalDocuments: stats.totalDocuments,
                diskUsageBytes: stats.diskUsageBytes,
                diskUsageMb: (stats.diskUsageBytes / (1024 * 1024)).toFixed(2),
                stored: stats.stored,
                updated: stats.updated,
                errors: stats.errors,
                lastOperation: stats.lastOperation
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error('[API] Normalization health check failed', { error: error.message });
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
