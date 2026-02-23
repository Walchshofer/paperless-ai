/**
 * Visual Overlays API Routes
 *
 * Provides endpoints for managing visual overlay labeling and field mappings.
 *
 * Endpoints:
 * - GET /api/visual-overlays/missing-fields/:documentId - Get fields without overlay mappings
 * - GET /api/visual-overlays/document/:documentId - Get all overlays for a document
 * - POST /api/visual-overlays - Create a new overlay
 * - DELETE /api/visual-overlays/:overlayId - Delete an overlay
 *
 * @swagger
 * tags:
 *   - name: Visual Overlays
 *     description: Visual overlay labeling and field mapping endpoints
 */

const express = require('express');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const { normalizeOverlayBoundingBox } = require('../../services/visual-rag-client/overlayCoordinates');
const logger = require('../../services/logger');
const feedbackService = require('../../services/feedback/FeedbackService');
const config = require('../../config/config');
const paperlessService = require('../../services/paperlessService');

// Visual RAG client - lazy loaded
let visualOverlayRepository = null;
try {
  const visualRagClient = require('../../services/visual-rag-client');
  visualOverlayRepository = visualRagClient.visualOverlayRepository;
} catch (e) {
  logger.warn({
    event: 'visual_overlays_api_init',
    message: 'Visual RAG client not available',
    error: e.message
  });
}

// All routes require authentication
router.use(authenticateApi);

/**
 * @swagger
 * /api/visual-overlays/missing-fields/{documentId}:
 *   get:
 *     summary: Get fields without overlay mappings
 *     description: Returns a list of required fields and their mapping status
 *     tags: [Visual Overlays]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Paperless document ID
 *     responses:
 *       200:
 *         description: Fields with mapping status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 fields:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       label:
 *                         type: string
 *                       isMapped:
 *                         type: boolean
 *                       overlayId:
 *                         type: string
 *       400:
 *         description: Invalid document ID
 *       500:
 *         description: Server error
 */
router.get('/missing-fields/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId, 10);

    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    // Define required fields (can be made configurable via settings)
    const requiredFields = [
      { id: 'invoice_number', label: 'Invoice Number' },
      { id: 'total_amount', label: 'Total Amount' },
      { id: 'invoice_date', label: 'Invoice Date' },
      { id: 'vendor_name', label: 'Vendor Name' },
      { id: 'tax_id', label: 'Tax ID' },
      { id: 'due_date', label: 'Due Date' },
      { id: 'subtotal', label: 'Subtotal' },
      { id: 'tax_amount', label: 'Tax Amount' }
    ];

    // Get existing overlays to check mappings
    let overlays = [];
    if (visualOverlayRepository) {
      try {
        overlays = await visualOverlayRepository.getByDocId(documentId);
      } catch (err) {
        logger.warn({
          event: 'missing_fields_overlay_fetch_failed',
          documentId,
          error: err.message
        });
      }
    }

    // Build set of mapped field IDs from overlays
    const mappedFieldIds = new Set();
    const fieldToOverlay = new Map();

    overlays.forEach(o => {
      const data = o.overlayData || {};
      const mapping = data.paperlessMapping || data.fieldId || o.semanticLabel;
      if (mapping) {
        mappedFieldIds.add(mapping);
        fieldToOverlay.set(mapping, o.id);
      }
    });

    // Mark fields as mapped/unmapped
    const fields = requiredFields.map(field => ({
      ...field,
      isMapped: mappedFieldIds.has(field.id),
      overlayId: fieldToOverlay.get(field.id) || null
    }));

    logger.info({
      event: 'missing_fields_fetched',
      documentId,
      totalFields: fields.length,
      mappedCount: fields.filter(f => f.isMapped).length
    });

    res.json({ fields });
  } catch (error) {
    logger.error({
      event: 'missing_fields_error',
      documentId: req.params.documentId,
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/visual-overlays/document/{documentId}:
 *   get:
 *     summary: Get all overlays for a document
 *     description: Returns all visual overlays associated with a document
 *     tags: [Visual Overlays]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Paperless document ID
 *     responses:
 *       200:
 *         description: Document overlays
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overlays:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       label:
 *                         type: string
 *                       pageNumber:
 *                         type: integer
 *                       confidence:
 *                         type: number
 *                       bbox:
 *                         type: object
 *       400:
 *         description: Invalid document ID
 *       500:
 *         description: Server error
 */
router.get('/document/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId, 10);

    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    if (!visualOverlayRepository) {
      return res.json({ overlays: [] });
    }

    const overlays = await visualOverlayRepository.getByDocId(documentId);

    // Transform to UI format
    const formattedOverlays = overlays.map(o => {
      const data = o.overlayData || {};
      const bbox = normalizeOverlayBoundingBox(data) || {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      };

      return {
        id: String(o.id),
        overlayId: String(o.id),
        label: data.label || o.semanticLabel || 'Unknown',
        pageNumber: o.pageNumber || data.pageNumber || 1,
        confidence: data.confidence || o.confidence || 0.5,
        bbox,
        paperlessMapping: data.paperlessMapping || data.fieldId || null,
        paperlessField: data.paperlessField || data.paperlessMapping || data.fieldId || null
      };
    });

    logger.info({
      event: 'document_overlays_fetched',
      documentId,
      count: formattedOverlays.length
    });

    res.json({ overlays: formattedOverlays });
  } catch (error) {
    logger.error({
      event: 'document_overlays_error',
      documentId: req.params.documentId,
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/visual-overlays/expert-knowledge/:documentId
 * Updates the expert knowledge (OCR text) and records feedback.
 */
router.post('/expert-knowledge/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId, 10);
    const { enhancedOcrText, originalOcrText, feedback } = req.body;

    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    if (!visualOverlayRepository) {
      return res.status(503).json({ error: 'Visual RAG service not available' });
    }

    // 1. Fetch current expert knowledge to preserve other fields
    const currentKnowledge = await visualOverlayRepository.getExpertKnowledge(documentId) || {};
    
    // 2. Update knowledge
    const updatedKnowledge = {
      ...currentKnowledge,
      enhancedOcrText: enhancedOcrText
    };

    await visualOverlayRepository.saveExpertKnowledge(documentId, updatedKnowledge);

    // 2.5 Mirror to Paperless-ngx custom fields (ticket:009.1)
    if (enhancedOcrText && config.ocrCheckpoint?.enabled === 'yes') {
      try {
        const { ensureOcrCustomFields } = require('../../services/experts/utils');
        const checkpointResult = await ensureOcrCustomFields({ continueOnPartialSuccess: true });
        
        if (checkpointResult.success || (checkpointResult.fields?.length > 0)) {
          const { normalizeCustomFieldValue: normVal } = require('../../services/customFieldUtils');
          await paperlessService.updateDocument(documentId, { 
            custom_fields: {
              vis_ocr_text: normVal(enhancedOcrText)
            }
          });
          logger.info(`[Visual Overlays API] Mirrored edited OCR text to Paperless-ngx for doc ${documentId}`);
        }
      } catch (mirrorErr) {
        logger.warn(`[Visual Overlays API] Failed to mirror edited OCR text: ${mirrorErr.message}`);
      }
    }

    // 3. Record feedback if provided
    if (feedback || (enhancedOcrText !== originalOcrText)) {
      const event = {
        type: 'ocr_correction',
        field: 'enhanced_ocr_text',
        original: originalOcrText || currentKnowledge.enhancedOcrText,
        corrected: enhancedOcrText,
        context: {
          source: 'user_edit',
          ocr_mode: 'high-res',
          rating: feedback?.rating || null,
          comments: feedback?.comments || 'Manual user correction'
        },
        user_id: req.user?.id || null
      };

      await feedbackService.recordGranularFeedback(documentId, [event], { transactional: true });
    }

    logger.info({
      event: 'expert_knowledge_updated',
      documentId,
      user: req.user?.username
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({
      event: 'expert_knowledge_update_error',
      documentId: req.params.documentId,
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/visual-overlays/settings/:documentId
 * Updates visual settings (e.g. rotation) for a document.
 */
router.post('/settings/:documentId', async (req, res) => {
  try {
    const documentId = parseInt(req.params.documentId, 10);
    const { rotation } = req.body;

    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({ error: 'Invalid document ID' });
    }

    if (!visualOverlayRepository) {
      return res.status(503).json({ error: 'Visual RAG service not available' });
    }

    const settings = {};
    if (rotation !== undefined) {
      settings.rotation = parseInt(rotation, 10);
    }

    await visualOverlayRepository.saveVisualSettings(documentId, settings);

    logger.info({
      event: 'visual_settings_saved',
      documentId,
      settings: Object.keys(settings),
      user: req.user?.username
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({
      event: 'visual_settings_update_error',
      documentId: req.params.documentId,
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/visual-overlays:
 *   post:
 *     summary: Create a new overlay
 *     description: Creates a visual overlay for a field mapping
 *     tags: [Visual Overlays]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - fieldId
 *               - bbox
 *             properties:
 *               documentId:
 *                 type: integer
 *               fieldId:
 *                 type: string
 *               bbox:
 *                 type: object
 *                 properties:
 *                   x:
 *                     type: number
 *                   y:
 *                     type: number
 *                   width:
 *                     type: number
 *                   height:
 *                     type: number
 *               pageNumber:
 *                 type: integer
 *                 default: 1
 *     responses:
 *       200:
 *         description: Overlay created
 *       400:
 *         description: Invalid request body
 *       503:
 *         description: Visual RAG service not available
 */
router.post('/', async (req, res) => {
  try {
    const { documentId, fieldId, bbox, pageNumber = 1 } = req.body;

    // Validate required fields
    if (!documentId || !Number.isInteger(documentId) || documentId <= 0) {
      return res.status(400).json({ error: 'Invalid or missing documentId' });
    }

    if (!fieldId || typeof fieldId !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing fieldId' });
    }

    if (!bbox || typeof bbox !== 'object') {
      return res.status(400).json({ error: 'Invalid or missing bbox' });
    }

    if (!visualOverlayRepository) {
      return res.status(503).json({ error: 'Visual RAG service not available' });
    }

    // Normalize bbox to 0-1 scale if needed
    const normalizedBbox = {
      x: Math.max(0, Math.min(1, Number(bbox.x) || 0)),
      y: Math.max(0, Math.min(1, Number(bbox.y) || 0)),
      width: Math.max(0, Math.min(1, Number(bbox.width) || 0)),
      height: Math.max(0, Math.min(1, Number(bbox.height) || 0))
    };

    // Get user info for audit trail
    const username = req.user?.username || req.user?.name || 'unknown';

    // Create overlay using repository
    const overlay = await visualOverlayRepository.save({
      documentId,
      pageNumber: pageNumber || 1,
      semanticLabel: fieldId,
      overlayData: {
        label: fieldId,
        bbox: normalizedBbox,
        boundingBox: normalizedBbox,
        paperlessMapping: fieldId,
        userCreated: true,
        createdBy: username,
        createdAt: new Date().toISOString()
      }
    });

    logger.info({
      event: 'overlay_created',
      documentId,
      fieldId,
      overlayId: overlay?.id,
      createdBy: username
    });

    res.json({
      success: true,
      overlay: {
        id: String(overlay?.id),
        label: fieldId,
        pageNumber,
        confidence: 1.0,
        bbox: normalizedBbox
      }
    });
  } catch (error) {
    logger.error({
      event: 'overlay_create_error',
      documentId: req.body?.documentId,
      fieldId: req.body?.fieldId,
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/visual-overlays/{overlayId}:
 *   delete:
 *     summary: Delete an overlay
 *     description: Removes a visual overlay by ID
 *     tags: [Visual Overlays]
 *     parameters:
 *       - in: path
 *         name: overlayId
 *         required: true
 *         schema:
 *           type: string
 *         description: Overlay ID
 *     responses:
 *       200:
 *         description: Overlay deleted
 *       400:
 *         description: Invalid overlay ID
 *       503:
 *         description: Visual RAG service not available
 */
router.delete('/:overlayId', async (req, res) => {
  try {
    const { overlayId } = req.params;

    if (!overlayId) {
      return res.status(400).json({ error: 'Invalid overlay ID' });
    }

    if (!visualOverlayRepository) {
      return res.status(503).json({ error: 'Visual RAG service not available' });
    }

    // Delete the overlay
    await visualOverlayRepository.deleteById(parseInt(overlayId, 10));

    logger.info({
      event: 'overlay_deleted',
      overlayId,
      deletedBy: req.user?.username || 'unknown'
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({
      event: 'overlay_delete_error',
      overlayId: req.params.overlayId,
      error: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
