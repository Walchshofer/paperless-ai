/**
 * Documents API Routes
 *
 * Handles document operations including reprocessing through Expert Pipeline.
 *
 * Endpoints:
 * - POST /api/documents/:id/reprocess - Reprocess document through Expert Pipeline
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { authenticateApi } = require('../../middleware/auth');
const AIServiceFactory = require('../../services/aiServiceFactory');
const paperlessService = require('../../services/paperlessService');
const DocumentProcessor = require('../../services/integration/DocumentProcessor');
const logger = require('../../services/logger');
const documentModel = require('../../services/documentModel');
const {
  reprocessProgressBroker
} = require('../../services/reprocess/ReprocessProgressBroker');

// All routes require authentication
router.use(authenticateApi);

function toDisplayLabel(rawKey) {
  return String(rawKey || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapCustomFieldsToExtractedFields(customFields, confidence = 0.5) {
  if (!customFields || typeof customFields !== 'object') {
    return [];
  }

  return Object.entries(customFields).map(([key, value], index) => ({
    id: `custom-field-${index}-${key}`,
    fieldId: key,
    label: toDisplayLabel(key),
    value: value == null ? '' : String(value),
    paperlessField: `custom_field:${key}`,
    paperlessMapping: `custom_field:${key}`,
    confidence,
    isAiGenerated: true
  }));
}

function mapSuggestedTagsToObjects(tagValues, availableTags = []) {
  if (!Array.isArray(tagValues) || tagValues.length === 0) return [];

  const byName = new Map(
    availableTags
      .filter((tag) => tag && tag.name)
      .map((tag) => [String(tag.name).toLowerCase(), tag])
  );

  return tagValues.map((tag, index) => {
    if (tag && typeof tag === 'object' && tag.id != null && tag.name) {
      return tag;
    }
    const normalized = String(tag || '').trim().toLowerCase();
    const matched = normalized ? byName.get(normalized) : null;
    if (matched) return matched;
    return {
      id: -1 * (index + 1),
      name: String(tag || `tag-${index + 1}`)
    };
  });
}

function resolveClassification(resultPayload) {
  const raw = resultPayload?.classification || null;
  const detail = raw && typeof raw === 'object'
    ? (raw.classification && typeof raw.classification === 'object'
      ? raw.classification
      : raw)
    : null;
  const label = detail?.primary_domain || detail?.domain || 'General';
  return { label, detail };
}

function buildPreparedDocument(document, documentId, ocrText = '') {
  const archiveFileName = document.archive_file_name ||
    document.archive_filename ||
    null;
  const originalFileName = document.original_file_name ||
    `doc-${documentId}.pdf`;
  const relativePdfPath = archiveFileName
    ? path.posix.join('documents', 'archive', archiveFileName)
    : path.posix.join('documents', 'originals', originalFileName);
  const mediaRoot = process.env.PAPERLESS_MEDIA_ROOT ||
    '/usr/src/paperless/media';
  const absolutePdfPath = path.posix.join(mediaRoot, relativePdfPath);

  return {
    id: documentId,
    title: document.title || '',
    filename: originalFileName,
    content: ocrText || document.content || '',
    ocr_text: ocrText || document.content || '',
    pdf_path: relativePdfPath,
    pdf_path_abs: absolutePdfPath,
    tags: Array.isArray(document.tags) ? document.tags : [],
    correspondent: document.correspondent || null,
    document_type: document.document_type || null,
    created: document.created || document.added || null,
    mime_type: document.mime_type || null,
    archive_file_name: archiveFileName
  };
}

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
  reprocessProgressBroker.publish(documentId, {
    stage: 'queued',
    details: { source: 'workspace-reprocess', requestedBy: username }
  });

  try {
    reprocessProgressBroker.publish(documentId, {
      stage: 'classifying',
      details: { message: 'Preparing document and expert context' }
    });

    const [
      sourceDocument,
      ocrText,
      existingTags,
      existingCorrespondentList,
      existingDocumentTypesList
    ] = await Promise.all([
      paperlessService.getDocument(documentId),
      paperlessService.getDocumentContent(documentId).catch(() => ''),
      paperlessService.getTags().catch(() => []),
      paperlessService.listCorrespondentsNames().catch(() => []),
      paperlessService.listDocumentTypesNames().catch(() => [])
    ]);

    if (!sourceDocument) {
      const notFoundError = new Error('Document not found');
      notFoundError.code = 'DOCUMENT_NOT_FOUND';
      throw notFoundError;
    }

    const ollamaService = AIServiceFactory.getService();
    const processor = new DocumentProcessor(ollamaService, {
      mode: 'hybrid',
      enableVisualRAG: true
    });
    const preparedDocument = buildPreparedDocument(
      sourceDocument,
      documentId,
      ocrText
    );

    reprocessProgressBroker.publish(documentId, {
      stage: 'extracting',
      details: { message: 'Running expert pipeline stages' }
    });

    const processingResult = await processor.process(preparedDocument, {
      mode: 'expert_pipeline',
      triggerVisualIngestion: true,
      forceReprocess: true,
      existingTags: Array.isArray(existingTags)
        ? existingTags.map((tag) => tag.name).filter(Boolean)
        : [],
      existingCorrespondentList: Array.isArray(existingCorrespondentList)
        ? existingCorrespondentList
        : [],
      existingDocumentTypesList: Array.isArray(existingDocumentTypesList)
        ? existingDocumentTypesList
        : [],
      documentCreated: sourceDocument.created || sourceDocument.added || null,
      context: {
        source: 'workspace-reprocess',
        initiatedBy: username
      }
    });

    if (!processingResult?.success) {
      throw new Error(
        processingResult?.error || 'Pipeline execution failed'
      );
    }

    reprocessProgressBroker.publish(documentId, {
      stage: 'persisting',
      details: { message: 'Finalizing metadata and history' }
    });

    const classificationInfo = resolveClassification(processingResult.result);
    const confidence = Number(
      processingResult?.metadata?.confidence ??
      processingResult?.result?.confidence ??
      0.5
    );
    const extractedFields = mapCustomFieldsToExtractedFields(
      processingResult?.paperless?.custom_fields || {},
      confidence
    );
    const smartTags = mapSuggestedTagsToObjects(
      processingResult?.paperless?.tags || [],
      existingTags
    );

    const processingTime = Date.now() - startTime;

    // Save reprocessing history to database
    try {
      // Use addToHistory method (existing method in documentModel)
      // The history table stores: document_id, tags, title, correspondent, username
      const tagIds = smartTags
        .map((tag) => Number(tag?.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      await documentModel.addToHistory(
        documentId,
        tagIds,
        `[Reprocessed] ${classificationInfo.label}`,
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
      classification: classificationInfo.label,
      fieldCount: extractedFields.length,
      tagCount: smartTags.length,
      confidence,
      processingTime
    });

    reprocessProgressBroker.publish(documentId, {
      stage: 'completed',
      details: {
        fieldCount: extractedFields.length,
        tagCount: smartTags.length,
        processingTime
      }
    });

    res.json({
      success: true,
      documentId,
      classification: classificationInfo.label,
      classificationDetails: classificationInfo.detail || {
        primary_domain: classificationInfo.label
      },
      extractedFields,
      smartTags,
      confidence,
      stats: {
        totalTime: processingTime,
        ...(processingResult?.metadata || {})
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;

    // Determine reason code based on error type
    let reasonCode = 'pipeline_execution_failed';
    if (error.message?.includes('not found') || error.message?.includes('404')) {
      reasonCode = 'document_not_found';
    } else if (error.code === 'DOCUMENT_NOT_FOUND') {
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

    reprocessProgressBroker.publish(documentId, {
      stage: 'failed',
      details: {
        reasonCode,
        error: error.message || 'Pipeline execution failed',
        processingTime
      }
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
