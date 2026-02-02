/**
 * Documents API Routes
 *
 * Handles document operations including reprocessing through Expert Pipeline.
 *
 * Endpoints:
 * - POST /api/documents/:id/reprocess - Reprocess document through Expert Pipeline
 */

const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const logger = require('../../services/logger');
const documentModel = require('../../services/documentModel');

// All routes require authentication
router.use(authenticateApi);

/**
 * @swagger
 * /api/documents/{id}/reprocess:
 *   post:
 *     summary: Reprocess document through Expert Pipeline
 *     description: |
 *       Triggers full Expert Pipeline execution for a document.
 *       The pipeline classifies the document, extracts fields using OCR and Visual RAG,
 *       generates smart tags, and stores results in the database.
 *       
 *       This operation may take 30-120 seconds depending on document complexity
 *       and pipeline configuration.
 *     tags:
 *       - Documents
 *       - Expert Pipeline
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Paperless document ID
 *     responses:
 *       200:
 *         description: Reprocessing completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 documentId:
 *                   type: integer
 *                   example: 74
 *                 classification:
 *                   type: string
 *                   example: "Medical"
 *                 extractedFields:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       value:
 *                         type: string
 *                       confidence:
 *                         type: number
 *                 smartTags:
 *                   type: array
 *                   items:
 *                     type: string
 *                 confidence:
 *                   type: number
 *                   example: 0.85
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalTime:
 *                       type: number
 *                       description: Total processing time in milliseconds
 *       400:
 *         description: Invalid document ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid document ID"
 *       401:
 *         description: Unauthorized - authentication required
 *       404:
 *         description: Document not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Document not found"
 *       500:
 *         description: Pipeline execution failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 reasonCode:
 *                   type: string
 *                   description: Machine-readable error reason code
 */
router.post('/:id/reprocess', async (req, res) => {
  const startTime = Date.now();
  const documentId = parseInt(req.params.id, 10);

  // Validate document ID
  if (isNaN(documentId) || documentId <= 0) {
    logger.warn({
      event: 'reprocess_invalid_id',
      documentId: req.params.id,
      reasonCode: 'invalid_document_id'
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid document ID',
      reasonCode: 'invalid_document_id'
    });
  }

  // Get username from authenticated request
  const username = req.user?.username || req.user?.name || 'unknown';

  logger.info({
    event: 'reprocess_started',
    documentId,
    username,
    source: 'workspace-reprocess'
  });

  try {
    // Dynamically import ExpertPipelineExecutor to avoid circular dependencies
    const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');

    // Initialize Expert Pipeline Executor with appropriate options
    const executor = new ExpertPipelineExecutor({
      enableVisualRag: true,
      timeout: 120000, // 2 minutes
      maxRetries: 2
    });

    // Execute the pipeline
    const result = await executor.execute(documentId, {
      username,
      forceReprocess: true,
      source: 'workspace-reprocess'
    });

    // Extract results with safe defaults
    const classification = result.classification || result.primary_domain || 'General';
    const extractedFields = result.extractedFields || result.fields || [];
    const smartTags = result.smartTags || result.tags || [];
    const confidence = result.confidence || result.overall_confidence || 0.5;

    // Calculate processing time
    const processingTime = Date.now() - startTime;

    // Save reprocessing history to database
    try {
      // Use addToHistory method (existing method in documentModel)
      // The history table stores: document_id, tags, title, correspondent, username
      const tagIds = smartTags.map((t) => typeof t === 'object' ? t.id : t);
      await documentModel.addToHistory(
        documentId,
        tagIds,
        `[Reprocessed] ${classification}`, // Use classification as title indicator
        '', // correspondent not extracted by pipeline
        username
      );
    } catch (historyErr) {
      // Log but don't fail - history saving is non-critical
      logger.warn({
        event: 'reprocess_history_save_failed',
        documentId,
        error: historyErr.message
      });
    }

    logger.info({
      event: 'reprocess_completed',
      documentId,
      username,
      classification,
      fieldCount: extractedFields.length,
      tagCount: smartTags.length,
      confidence,
      processingTime
    });

    res.json({
      success: true,
      documentId,
      classification,
      extractedFields,
      smartTags,
      confidence,
      stats: {
        totalTime: processingTime,
        ...(result.stats || {})
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Determine reason code based on error type
    let reasonCode = 'pipeline_execution_failed';
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      reasonCode = 'document_not_found';
    } else if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      reasonCode = 'pipeline_timeout';
    } else if (error.message?.includes('Model not available')) {
      reasonCode = 'model_unavailable';
    } else if (error.message?.includes('Guidance')) {
      reasonCode = 'guidance_unavailable';
    }

    logger.error({
      event: 'reprocess_failed',
      documentId,
      username,
      error: error.message,
      reasonCode,
      processingTime,
      stack: error.stack
    });

    // Return appropriate status code
    const statusCode = reasonCode === 'document_not_found' ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message || 'Pipeline execution failed',
      reasonCode,
      processingTime
    });
  }
});

/**
 * @swagger
 * /api/documents/{id}/status:
 *   get:
 *     summary: Get document processing status
 *     description: |
 *       Returns the current processing status and last reprocessing result
 *       for a document.
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Paperless document ID
 *     responses:
 *       200:
 *         description: Status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 documentId:
 *                   type: integer
 *                 lastProcessed:
 *                   type: string
 *                   format: date-time
 *                 classification:
 *                   type: string
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Unauthorized
 */
router.get('/:id/status', async (req, res) => {
  const documentId = parseInt(req.params.id, 10);

  if (isNaN(documentId) || documentId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid document ID',
      reasonCode: 'invalid_document_id'
    });
  }

  try {
    // Get history entry for this document (returns single record or undefined)
    const history = await documentModel.getHistory(documentId);

    if (!history) {
      return res.json({
        success: true,
        documentId,
        status: 'never_processed',
        lastProcessed: null,
        classification: null
      });
    }

    res.json({
      success: true,
      documentId,
      status: 'processed',
      lastProcessed: history.created_at,
      title: history.title || null,
      tags: history.tags || null
    });

  } catch (error) {
    logger.error({
      event: 'document_status_failed',
      documentId,
      error: error.message
    });

    res.status(500).json({
      success: false,
      error: error.message,
      reasonCode: 'status_retrieval_failed'
    });
  }
});

module.exports = router;
