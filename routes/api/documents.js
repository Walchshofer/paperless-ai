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
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const config = require('../../config/config');
const AIServiceFactory = require('../../services/aiServiceFactory');
const paperlessService = require('../../services/paperlessService');
const { DocumentProcessor } = require('../../services/integration/DocumentProcessor');
const logger = require('../../services/logger');
const documentModel = require('../../services/documentModel');
const {
  pdfRenderer,
  isSupportedImageMimeType
} = require('../../services/visual-rag-client/PDFRenderer');
const {
  REPROCESS_ERROR_MESSAGES,
  REPROCESS_STAGE_DEFINITIONS,
  reprocessProgressBroker
} = require('../../services/reprocess/ReprocessProgressBroker');
const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');

// Single-flight guard to avoid overlapping heavy reprocess runs per document.
const inFlightReprocessJobs = new Map();
const REPROCESS_RECENT_RESULT_TTL_MS = Math.max(
  Number(process.env.REPROCESS_RECENT_RESULT_TTL_MS || 30000),
  0
);
const recentReprocessResults = new Map();

// All routes require authentication
router.use(authenticateApi);

/**
 * Convert a raw key (snake_case / kebab-case) to a Title Case display label.
 * @param {string} rawKey - Raw field key
 * @returns {string} Title-cased label
 */
function toDisplayLabel(rawKey) {
  return String(rawKey || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Map a custom_fields object to an array of extracted field objects for workspace UI.
 * @param {Object} customFields - Key-value pairs of custom field data
 * @param {number} [confidence=0.5] - Default confidence score for mapped fields
 * @returns {Array<Object>} Array of extracted field objects with fieldId, label, value
 */
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

/**
 * Resolve tag values (strings or objects) to full tag objects using the available tags list.
 * Unmatched names get synthetic negative IDs.
 * @param {Array<string|Object>} tagValues - Tag names or tag objects from AI extraction
 * @param {Array<Object>} [availableTags=[]] - Known Paperless tags with id and name
 * @returns {Array<Object>} Resolved tag objects with id and name
 */
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

/**
 * Extract classification label and detail from a nested pipeline result payload.
 * Handles both flat and double-nested classification shapes.
 * @param {Object} resultPayload - Pipeline execution result
 * @returns {{ label: string, detail: Object|null }} Classification label and detail object
 */
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

function cloneReprocessPayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return payload;
  }
}

function getRecentReprocessResult(documentId) {
  if (!REPROCESS_RECENT_RESULT_TTL_MS) return null;
  const cached = recentReprocessResults.get(documentId);
  if (!cached) return null;

  const ageMs = Date.now() - cached.completedAt;
  if (ageMs > REPROCESS_RECENT_RESULT_TTL_MS) {
    recentReprocessResults.delete(documentId);
    return null;
  }

  return {
    ...cached,
    ageMs,
    payload: cloneReprocessPayload(cached.payload)
  };
}

function setRecentReprocessResult(documentId, statusCode, payload) {
  if (!REPROCESS_RECENT_RESULT_TTL_MS) return;
  if (statusCode !== 200 || !payload || payload.success !== true) return;
  recentReprocessResults.set(documentId, {
    statusCode,
    payload: cloneReprocessPayload(payload),
    completedAt: Date.now()
  });
}

/**
 * Build a prepared document object with resolved PDF paths for pipeline processing.
 * Resolves archive vs original file paths using PAPERLESS_MEDIA_ROOT.
 * @param {Object} document - Raw Paperless document data
 * @param {number} documentId - Paperless document ID
 * @param {string} [ocrText=''] - Pre-fetched OCR text content
 * @returns {Object} Prepared document with id, content, pdf_path, pdf_path_abs, etc.
 */
function buildPreparedDocument(document, documentId, ocrText = '') {
  const archiveFileName = document.archive_file_name ||
    document.archive_filename ||
    null;
  
  // Detect if document is a PDF based on mime_type or extension
  const mimeType = document.mime_type || '';
  const isPdf = mimeType === 'application/pdf' || 
                (document.original_file_name && document.original_file_name.toLowerCase().endsWith('.pdf'));

  const originalFileName = document.original_file_name ||
    `doc-${documentId}${isPdf ? '.pdf' : ''}`;
  
  const relativePath = archiveFileName
    ? path.posix.join('documents', 'archive', archiveFileName)
    : path.posix.join('documents', 'originals', originalFileName);
  
  const mediaRoot = process.env.PAPERLESS_MEDIA_ROOT ||
    '/usr/src/paperless/media';
  const absolutePath = path.posix.join(mediaRoot, relativePath);

  const prepared = {
    id: documentId,
    title: document.title || '',
    filename: originalFileName,
    content: ocrText || document.content || '',
    ocr_text: ocrText || document.content || '',
    tags: Array.isArray(document.tags) ? document.tags : [],
    correspondent: document.correspondent || null,
    document_type: document.document_type || null,
    created: document.created || document.added || null,
    mime_type: document.mime_type || null,
    archive_file_name: archiveFileName
  };

  // Set appropriate paths based on file type
  if (isPdf) {
    prepared.pdf_path = relativePath;
    prepared.pdf_path_abs = absolutePath;
  } else if (mimeType.startsWith('image/')) {
    prepared.image_path = relativePath;
    prepared.image_path_abs = absolutePath;
  } else {
    // Default fallback: provide both for compatibility
    prepared.pdf_path = relativePath;
    prepared.pdf_path_abs = absolutePath;
    prepared.image_path = relativePath;
    prepared.image_path_abs = absolutePath;
  }

  return prepared;
}

const SUPPORTED_REPROCESS_MIME_PREFIXES = Object.freeze([
  'application/pdf',
  'image/'
]);

const REPROCESS_REASON_TO_ERROR_KEY = Object.freeze({
  invalid_document_format: 'invalid-document',
  visual_rag_unavailable: 'visual-rag-unavailable',
  model_unavailable: 'visual-rag-unavailable',
  guidance_unavailable: 'visual-rag-unavailable',
  pipeline_timeout: 'ollama-timeout',
  qdrant_connection_failed: 'qdrant-connection-failed',
  pipeline_execution_failed: 'pipeline-execution-failed'
});

/**
 * Check if a MIME type is supported for reprocessing (PDF or image/*).
 * Null/empty values are treated as supported (permissive default).
 * @param {string|null} mimeType - Document MIME type
 * @returns {boolean} True if supported or unknown
 */
function isSupportedReprocessMime(mimeType) {
  if (!mimeType) return true;
  const normalized = String(mimeType).trim().toLowerCase();
  if (!normalized) return true;

  return SUPPORTED_REPROCESS_MIME_PREFIXES.some((allowed) =>
    normalized.startsWith(allowed)
  );
}

/**
 * Normalize an error into a standard reprocess reason code string.
 * Inspects error.code and error.message to classify the failure.
 * @param {Error} error - The error from pipeline execution
 * @returns {string} Reason code (e.g. 'document_not_found', 'pipeline_timeout')
 */
function normalizeReprocessReasonCode(error) {
  const message = String(error?.message || '').toLowerCase();

  if (error?.code === 'DOCUMENT_NOT_FOUND') {
    return 'document_not_found';
  }

  if (error?.code === 'INVALID_DOCUMENT_FORMAT') {
    return 'invalid_document_format';
  }

  if (message.includes('not found') || message.includes('404')) {
    return 'document_not_found';
  }

  if (message.includes('timeout') || error?.code === 'ETIMEDOUT') {
    return 'pipeline_timeout';
  }

  if (
    message.includes('qdrant') ||
    message.includes('circuit breaker') ||
    message.includes('circuit_open')
  ) {
    return 'qdrant_connection_failed';
  }

  if (
    message.includes('visual sidecar') ||
    message.includes('sidecar unavailable') ||
    message.includes('503')
  ) {
    return 'visual_rag_unavailable';
  }

  if (message.includes('model not available')) {
    return 'model_unavailable';
  }

  if (message.includes('guidance')) {
    return 'guidance_unavailable';
  }

  return 'pipeline_execution_failed';
}

/**
 * Map a reason code to its corresponding error key for message lookup.
 * @param {string} reasonCode - Normalized reason code from normalizeReprocessReasonCode
 * @returns {string} Error key for REPROCESS_ERROR_MESSAGES
 */
function resolveReprocessErrorKey(reasonCode) {
  return (
    REPROCESS_REASON_TO_ERROR_KEY[reasonCode] ||
    'pipeline-execution-failed'
  );
}

/**
 * Resolve a user-facing error message from a reason code.
 * Falls back to the generic pipeline-execution-failed message.
 * @param {string} reasonCode - Normalized reason code
 * @param {string} [fallbackMessage] - Custom fallback if no match found
 * @returns {string} Human-readable error message
 */
function resolveReprocessUserMessage(reasonCode, fallbackMessage) {
  const errorKey = resolveReprocessErrorKey(reasonCode);
  return (
    REPROCESS_ERROR_MESSAGES[errorKey] ||
    fallbackMessage ||
    REPROCESS_ERROR_MESSAGES['pipeline-execution-failed']
  );
}

/**
 * Map a reason code to the appropriate HTTP status code.
 * @param {string} reasonCode - Normalized reason code
 * @returns {number} HTTP status code (404, 415, 503, or 500)
 */
function resolveReprocessStatusCode(reasonCode) {
  if (reasonCode === 'document_not_found') return 404;
  if (reasonCode === 'invalid_document_format') return 415;
  if (reasonCode === 'qdrant_connection_failed') return 503;
  return 500;
}

/**
 * Publish a reprocess progress update to the SSE progress broker.
 * Validates stage name against REPROCESS_STAGE_DEFINITIONS before publishing.
 * @param {number} documentId - Paperless document ID
 * @param {Object} [update={}] - Progress update with stage name and optional details
 * @returns {Object|null} Published event, or null if stage is invalid
 */
function publishReprocessProgress(documentId, update = {}) {
  const stageName = String(update.stage || '').toLowerCase();
  if (!stageName || !REPROCESS_STAGE_DEFINITIONS[stageName]) {
    return null;
  }

  return reprocessProgressBroker.publish(documentId, {
    ...update,
    stage: stageName
  });
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

  const cachedResult = getRecentReprocessResult(documentId);
  if (cachedResult) {
    logger.info({
      event: 'reprocess_recent_result_cache_hit',
      documentId,
      username,
      ageMs: cachedResult.ageMs
    });
    publishReprocessProgress(documentId, {
      stage: 'completed',
      details: {
        source: 'workspace-reprocess',
        cachedResult: true,
        cachedAgeMs: cachedResult.ageMs
      }
    });
    return res.status(cachedResult.statusCode).json(cachedResult.payload);
  }

  const activeJob = inFlightReprocessJobs.get(documentId);
  if (activeJob?.promise) {
    logger.info({
      event: 'reprocess_join_inflight',
      documentId,
      username,
      ownerUsername: activeJob.username,
      inFlightMs: Date.now() - activeJob.startedAt
    });
    publishReprocessProgress(documentId, {
      stage: 'queued',
      label: 'Re-analysis already in progress; joining active run',
      details: {
        source: 'workspace-reprocess',
        requestedBy: username,
        joined: true,
        owner: activeJob.username
      }
    });
    const joinedResult = await activeJob.promise;
    return res.status(joinedResult.statusCode).json(joinedResult.payload);
  }

  const runReprocessJob = async () => {
    logger.info({
      event: 'reprocess_started',
      documentId,
      username,
      source: 'workspace-reprocess'
    });
    publishReprocessProgress(documentId, {
      stage: 'queued',
      details: { source: 'workspace-reprocess', requestedBy: username }
    });

    try {
      publishReprocessProgress(documentId, {
        stage: 'visual_triage',
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

      if (!isSupportedReprocessMime(sourceDocument.mime_type)) {
        const invalidFormatError = new Error(
          `Unsupported document format: ${sourceDocument.mime_type || 'unknown'}`
        );
        invalidFormatError.code = 'INVALID_DOCUMENT_FORMAT';
        throw invalidFormatError;
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

      publishReprocessProgress(documentId, {
        stage: 'visual_extraction',
        details: { message: 'Running expert pipeline stages' }
      });

      const progressReporter = (update = {}) => {
        const stageName = String(update.stage || '').toLowerCase();
        if (!REPROCESS_STAGE_DEFINITIONS[stageName]) return;

        const details = {
          source: 'expert-pipeline',
          ...(update.details || {})
        };

        publishReprocessProgress(documentId, {
          ...update,
          stage: stageName,
          details
        });
      };

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
        progressReporter,
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

      const visualExecutionMetadata =
        processingResult?.result?._expert_result?.result?.outputs
          ?.visual_execution?.metadata ||
        null;
      const usedTextFallback =
        processingResult?.metadata?.processingMode === 'fallback_text' ||
        Boolean(visualExecutionMetadata?.fallback);

      if (usedTextFallback) {
        publishReprocessProgress(documentId, {
          stage: 'ocr_fallback',
          details: {
            source: 'workspace-reprocess',
            reason:
              visualExecutionMetadata?.fallback_reason ||
              processingResult?.metadata?.originalError ||
              'visual_text_fallback',
            userMessage: resolveReprocessUserMessage('visual_rag_unavailable')
          }
        });
      }

      publishReprocessProgress(documentId, {
        stage: 'hybrid_fusion',
        details: {
          source: 'workspace-reprocess',
          ocrFallbackUsed: Boolean(visualExecutionMetadata?.ocr_fallback_used),
          visualConfidence: visualExecutionMetadata?.visual_confidence ?? null
        }
      });

      publishReprocessProgress(documentId, {
        stage: 'storage',
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
        // The history table stores: document_id, tags, title, correspondent,
        // username
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

      publishReprocessProgress(documentId, {
        stage: 'completed',
        details: {
          fieldCount: extractedFields.length,
          tagCount: smartTags.length,
          processingTime
        }
      });

      return {
        statusCode: 200,
        payload: {
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
        }
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      const reasonCode = normalizeReprocessReasonCode(error);
      const errorKey = resolveReprocessErrorKey(reasonCode);
      const userMessage = resolveReprocessUserMessage(
        reasonCode,
        error.message || 'Pipeline execution failed'
      );

      logger.error({
        event: 'reprocess_failed',
        documentId,
        username,
        error: error.message,
        reasonCode,
        errorKey,
        userMessage,
        processingTime,
        stack: error.stack
      });

      publishReprocessProgress(documentId, {
        stage: 'failed',
        label: userMessage,
        details: {
          reasonCode,
          errorKey,
          userMessage,
          error: error.message || 'Pipeline execution failed',
          processingTime
        }
      });

      const statusCode = resolveReprocessStatusCode(reasonCode);
      return {
        statusCode,
        payload: {
          success: false,
          error: error.message || 'Pipeline execution failed',
          reasonCode,
          errorKey,
          userMessage,
          processingTime
        }
      };
    }
  };

  const jobPromise = runReprocessJob();
  inFlightReprocessJobs.set(documentId, {
    promise: jobPromise,
    startedAt: startTime,
    username
  });

  try {
    const result = await jobPromise;
    setRecentReprocessResult(documentId, result?.statusCode, result?.payload);
    return res.status(result.statusCode).json(result.payload);
  } finally {
    const current = inFlightReprocessJobs.get(documentId);
    if (current?.promise === jobPromise) {
      inFlightReprocessJobs.delete(documentId);
    }
  }
});

/**
 * @swagger
 * /api/documents/recent:
 *   get:
 *     summary: List recent documents for testing
 *     description: Returns a list of the 20 most recent documents for use in prompt testing.
 *     tags:
 *       - Documents
 *     responses:
 *       200:
 *         description: List of documents retrieved successfully
 */
router.get('/recent', requireAdmin, async (req, res) => {
  try {
    const response = await paperlessService.client.get('documents/', {
      params: { ordering: '-id', page_size: 20, fields: 'id,title,created,added,mime_type' }
    });
    const recent = (response.data?.results || []).map(doc => ({
      id: doc.id,
      title: doc.title,
      created: doc.created || doc.added,
      mime_type: doc.mime_type
    }));

    res.json({ success: true, documents: recent });
  } catch (error) {
    logger.error('[Documents API] Failed to list recent documents:', error);
    res.status(500).json({ success: false, error: 'Failed to list recent documents' });
  }
});

/**
 * GET /api/documents/:id/content
 * Get document OCR content and metadata for prompt testing
 */
router.get('/:id/content', requireAdmin, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }

    const [doc, content] = await Promise.all([
      paperlessService.getDocument(documentId),
      paperlessService.getDocumentContent(documentId).catch(() => '')
    ]);

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Render first page at 300 DPI for multimodal prompt testing
    let renderedPages = [];
    try {
      const pdfBuffer = await paperlessService.downloadDocument(documentId);
      if (pdfBuffer) {
        const images = await pdfRenderer.renderBuffer(pdfBuffer, {
          dpi: 300,
          docId: documentId,
          maxPages: 1,
        });
        renderedPages = (images || []).map(img => ({
          page: img.page,
          base64: img.base64,
          format: img.format || 'png',
          dpi: 300,
        }));
      }
    } catch (renderErr) {
      logger.warn('[Documents API] Page render failed for doc %d: %s', documentId, renderErr.message);
      // Non-fatal: continue without rendered image
    }

    res.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        content: content || doc.content || '',
        created: doc.created || doc.added,
        mime_type: doc.mime_type,
        renderedPages,
      }
    });
  } catch (error) {
    logger.error('[Documents API] Failed to get document content:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve document content' });
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

/**
 * GET /api/documents/:id/preview-image
 * Returns the first page of a document as base64 for prompt testing.
 */
router.get('/:id/preview-image', requireAdmin, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id, 10);
    if (isNaN(documentId) || documentId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid document ID' });
    }

    const doc = await paperlessService.getDocument(documentId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Priority 1: Check for existing 300dpi normalized image in NormalizationStore
    const { NormalizationStore } = require('../../services/normalization/NormalizationStore');
    const normStore = new NormalizationStore();
    const page1Path = normStore.getPagePath(documentId, 1);
    const fs = require('fs').promises;

    try {
      await fs.access(page1Path);
      const imageBuffer = await fs.readFile(page1Path);
      logger.info(`[Documents API] Serving persisted 300dpi normalized image for doc ${documentId}`);
      return res.json({
        success: true,
        image_data: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        source: 'persisted_300dpi'
      });
    } catch (err) {
      logger.info(`[Documents API] No persisted image for doc ${documentId}, falling back to on-demand render`);
    }

    // Check if renderable
    const mimeType = String(doc.mime_type || '').toLowerCase();
    const isPdf = mimeType === 'application/pdf';
    const isImage = isSupportedImageMimeType(mimeType);

    if (!isPdf && !isImage) {
      return res.status(415).json({
        success: false,
        error: 'Document type not supported for visual preview',
        mimeType
      });
    }

    // Priority 2: Fallback to on-demand render (150dpi)
    const { pdfRenderer } = require('../../services/visual-rag-client/PDFRenderer');
    const axios = require('axios');
    const apiUrl = process.env.PAPERLESS_API_URL;
    const apiToken = process.env.PAPERLESS_API_TOKEN;

    const pdfResponse = await axios.get(
      `${apiUrl}/documents/${documentId}/download/`,
      {
        headers: { 'Authorization': `Token ${apiToken}` },
        responseType: 'arraybuffer',
        timeout: 30000
      }
    );

    const images = await pdfRenderer.renderBuffer(Buffer.from(pdfResponse.data), {
      dpi: 150,
      maxPages: 1,
      docId: documentId
    });

    if (images && images.length > 0) {
      let format = String(images[0].format || '').toLowerCase();
      if (!format && isImage) {
        format = mimeType.split('/')[1] || 'png';
      }
      if (format === 'jpg') {
        format = 'jpeg';
      }
      if (!format) {
        format = 'png';
      }
      res.json({
        success: true,
        image_data: `data:image/${format};base64,${images[0].base64}`,
        source: 'on_demand_150dpi'
      });
    } else {
      res.status(404).json({ success: false, error: 'Failed to render document image' });
    }
  } catch (error) {
    logger.error('[Documents API] Image preview failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/documents/:id/ocr/regenerate
 * Targeted OCR regeneration for a document using VIS_OCR_V1.
 */
router.post('/:id/ocr/regenerate', async (req, res) => {
  const documentId = parseInt(req.params.id, 10);
  if (isNaN(documentId)) {
    return res.status(400).json({ success: false, error: 'Invalid document ID' });
  }

  try {
    const doc = await paperlessService.getDocument(documentId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const ollamaService = AIServiceFactory.getService();
    const executor = new ExpertPipelineExecutor(ollamaService);
    
    // Preparation for OCR (matches production flow)
    const preparedDoc = buildPreparedDocument(doc, documentId);
    
    logger.info({ event: 'ocr_regeneration_start', documentId });

    // 1. Download document
    const pdfBuffer = await paperlessService.downloadOriginalDocument(documentId)
        || await paperlessService.downloadDocument(documentId);

    if (!pdfBuffer) {
      throw new Error(`Unable to download document ${documentId}`);
    }

    // 2. Render images at high-res (300 DPI)
    const { pdfRenderer: renderer } = require('../../services/visual-rag-client/PDFRenderer');
    let images = [];
    
    try {
      images = await renderer.renderBuffer(pdfBuffer, {
          dpi: config.visualRag?.visionRenderDpi || 300,
          docId: documentId
      });
    } catch (renderErr) {
      // Fallback: If original is not renderable (e.g. text file), try to use the Paperless thumbnail (ticket:009.1)
      logger.info(`[Documents API] Document ${documentId} is not renderable; attempting thumbnail fallback for OCR`);
      const thumbBuffer = await paperlessService.getThumbnailImage(documentId);
      if (thumbBuffer) {
        images = [{
          page: 1,
          base64: thumbBuffer.toString('base64'),
          format: 'webp' // Standard for Paperless thumbnails
        }];
      } else {
        throw renderErr; // Re-throw if no thumbnail fallback possible
      }
    }

    if (!images || images.length === 0) {
      throw new Error('Failed to render document images for OCR');
    }

    // 3. Attach base64 images to preparedDoc so _executeVisualOCR can find them
    preparedDoc.base64Images = images.map(img => img.base64);

    // Execute OCR
    const ocrResult = await executor._executeVisualOCR(preparedDoc, { forceAllPages: true });
    
    // Mirror result to document object for buildVisOcrMetadata
    preparedDoc.enhanced_ocr_text = ocrResult.text;
    preparedDoc._ocr_metadata = ocrResult.metadata;
    
    // Re-use logic for metadata building and Paperless-ngx sync
    const { 
      buildVisOcrMetadata, 
      ensureOcrCustomFields, 
      normalizeCustomFieldValue 
    } = require('../../services/experts/utils');
    
    // Require translator lazily to avoid circular require issues
    let LocalTranslatorCtor;
    try {
      LocalTranslatorCtor = require('../../services/experts/translation/LocalTranslator');
    } catch (e) {
      const tm = require('../../services/experts/translation');
      LocalTranslatorCtor = tm.LocalTranslator || tm;
    }
    const translator = new LocalTranslatorCtor({ ollamaService });
    
    const visualPageTexts = ocrResult.metadata?.visual_pages || [];
    const ocrMetadata = await buildVisOcrMetadata(
      ocrResult.text,
      doc.language,
      translator,
      {
        includeTranslations: config.ocrCheckpoint?.includeTranslations !== 'no',
        skipEmptyText: true,
        pageTexts: visualPageTexts
      }
    );

    // Update Paperless-ngx Custom Fields
    if (config.ocrCheckpoint?.enabled === 'yes') {
      const checkpointResult = await ensureOcrCustomFields({ continueOnPartialSuccess: true });
      if (checkpointResult.success || (checkpointResult.fields?.length > 0)) {
        const customFields = {};
        if (ocrMetadata.vis_ocr_text) customFields.vis_ocr_text = ocrMetadata.vis_ocr_text;
        if (ocrMetadata.vis_ocr_text_de) customFields.vis_ocr_text_de = ocrMetadata.vis_ocr_text_de;
        if (ocrMetadata.vis_ocr_text_en) customFields.vis_ocr_text_en = ocrMetadata.vis_ocr_text_en;

        const normalizedFields = {};
        const { normalizeCustomFieldValue: normVal } = require('../../services/customFieldUtils');
        for (const k of Object.keys(customFields)) {
          normalizedFields[k] = normVal(customFields[k]);
        }
        await paperlessService.updateDocument(documentId, { custom_fields: normalizedFields });
      }
    }

    // Save to expert knowledge repository (PostgreSQL)
    const { visualOverlayRepository } = require('../../services/visual-rag-client/VisualOverlayRepository');
    await visualOverlayRepository.saveExpertKnowledge(documentId, {
      enhancedOcrText: ocrResult.text,
      expertMetadata: ocrResult.metadata,
      qualityScore: ocrResult.quality_score
    });

    logger.info({ 
      event: 'ocr_regeneration_complete', 
      documentId, 
      source: ocrResult.source, 
      quality: ocrResult.quality_score 
    });

    res.json({
      success: true,
      text: ocrResult.text,
      pages: visualPageTexts,
      source: ocrResult.source,
      quality: ocrResult.quality_score
    });

  } catch (error) {
    logger.error({ event: 'ocr_regeneration_failed', documentId, error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
