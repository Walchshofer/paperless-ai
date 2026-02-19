/**
 * Pipeline Stages API Routes
 *
 * Admin-only stage-isolation endpoints for the Expert Pipeline.
 * Enables per-stage E2E testing without running the full pipeline.
 *
 * Endpoints:
 * - GET  /api/pipeline-stages               - List all pipelines and their stages
 * - GET  /api/pipeline-stages/:pipelineId   - Get stage definitions for a pipeline
 * - POST /api/pipeline-stages/execute-stage  - Execute a single stage in isolation
 *
 * Architecture Reference: docs/PIPELINE_STAGE_CONTRACTS.md
 * Stage Contracts:        docs/EXPERT_PIPELINE_DECISION_TABLE.md
 */

const express = require('express');
const path = require('path');
const router = express.Router();
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const AIServiceFactory = require('../../services/aiServiceFactory');
const paperlessService = require('../../services/paperlessService');
const logger = require('../../services/logger');
const { pdfRenderer } = require('../../services/visual-rag-client/PDFRenderer');

// Expert pipeline components
const { expertRegistry, StageType, ExecutionMode } = require('../../services/experts/ExpertRegistry');
const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
const { ExecutionContext } = require('../../services/experts/context');
const { promptRegistry, MODEL_NAMES } = require('../../services/prompts/PromptRegistry');

// All routes require admin authentication
router.use(authenticateApi);
router.use(requireAdmin);

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

const SUPPORTED_MIME_PREFIXES = Object.freeze(['application/pdf', 'image/']);

const MEDIA_ROOT = String(
  process.env.PAPERLESS_MEDIA_ROOT || '/usr/src/paperless/media'
).replace(/\\/g, '/');

/**
 * Check if a MIME type is supported (PDF or image).
 * @param {string|null} mimeType - Document MIME type
 * @returns {boolean}
 */
function isSupportedMime(mimeType) {
  if (!mimeType) return true;
  const normalized = String(mimeType).trim().toLowerCase();
  return SUPPORTED_MIME_PREFIXES.some((p) => normalized.startsWith(p));
}

/**
 * Build a prepared document object for pipeline consumption.
 * @param {Object} doc - Paperless document
 * @param {number} docId - Document ID
 * @param {string} [ocrText=''] - Pre-fetched OCR text
 * @returns {Object} Prepared document
 */
function buildPreparedDocument(doc, docId, ocrText = '') {
  const archiveFileName = doc.archive_file_name || doc.archive_filename || null;
  
  // Detect if document is a PDF based on mime_type or extension
  const mimeType = doc.mime_type || '';
  const isPdf = mimeType === 'application/pdf' || 
                (doc.original_file_name && doc.original_file_name.toLowerCase().endsWith('.pdf'));

  const originalFileName = doc.original_file_name ||
    `doc-${docId}${isPdf ? '.pdf' : ''}`;
  
  const relativePath = archiveFileName
    ? path.posix.join('documents', 'archive', archiveFileName)
    : path.posix.join('documents', 'originals', originalFileName);
  
  const absolutePath = path.posix.join(MEDIA_ROOT, relativePath);

  const prepared = {
    id: docId,
    title: doc.title || '',
    filename: originalFileName,
    content: ocrText || doc.content || '',
    ocr_text: ocrText || doc.content || '',
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    correspondent: doc.correspondent || null,
    document_type: doc.document_type || null,
    created: doc.created || doc.added || null,
    mime_type: doc.mime_type || null,
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

/**
 * Render first N pages of a document as base64 images.
 * @param {number} documentId - Paperless document ID
 * @param {number} [maxPages=3] - Maximum pages to render
 * @returns {Promise<string[]>} Array of base64-encoded page images
 */
async function renderDocumentPages(documentId, maxPages = 3) {
  try {
    const pdfBuffer = await paperlessService.downloadDocument(documentId);
    if (!pdfBuffer) return [];

    const images = await pdfRenderer.renderBuffer(pdfBuffer, {
      dpi: 300,
      docId: documentId,
      maxPages
    });

    return (images || []).map((img) => img.base64);
  } catch (error) {
    logger.warn({
      event: 'pipeline_stages_render_failed',
      documentId,
      error: error.message
    });
    return [];
  }
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-stages — List all pipelines
// ────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pipeline-stages:
 *   get:
 *     summary: List all expert pipelines and their stages
 *     description: |
 *       Returns all registered expert pipelines with stage metadata.
 *       Used for stage-isolation testing to discover available stages.
 *     tags:
 *       - Expert Pipeline
 *       - API
 *     responses:
 *       200:
 *         description: Pipeline definitions retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/', (req, res) => {
  try {
    const all = expertRegistry.getPipelines();

    const pipelines = all.map((pipeline) => ({
      id: pipeline.id,
      name: pipeline.name,
      domain: pipeline.domain,
      version: pipeline.version,
      stageCount: (pipeline.stages || []).length,
      stages: (pipeline.stages || []).map((stage) => ({
        id: stage.id,
        name: stage.name,
        type: stage.type,
        model: stage.model || null,
        modelType: stage.modelType || null,
        promptId: stage.promptId || null,
        guidanceTemplate: stage.guidanceTemplate || null,
        executionMode: stage.executionMode,
        outputKey: stage.outputKey,
        timeout: stage.timeout || null,
        retryCount: stage.retryCount || 1,
        useParallelOcr: stage.useParallelOcr || false,
        injectVatContext: stage.injectVatContext || false,
        injectLegalContext: stage.injectLegalContext || false
      }))
    }));

    res.json({ success: true, pipelines });
  } catch (error) {
    logger.error({
      event: 'pipeline_stages_list_failed',
      error: error.message
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/pipeline-stages/:pipelineId — Get single pipeline detail
// ────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pipeline-stages/{pipelineId}:
 *   get:
 *     summary: Get stage definitions for a specific pipeline
 *     description: |
 *       Returns detailed stage definitions for a pipeline, including
 *       model names, prompt IDs, guidance templates, and input/output mappings.
 *     tags:
 *       - Expert Pipeline
 *       - API
 *     parameters:
 *       - in: path
 *         name: pipelineId
 *         required: true
 *         schema:
 *           type: string
 *         description: Pipeline identifier (e.g. PIPELINE_FINANCIAL_V1)
 *     responses:
 *       200:
 *         description: Pipeline definition retrieved
 *       404:
 *         description: Pipeline not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:pipelineId', (req, res) => {
  const { pipelineId } = req.params;

  try {
    const pipeline = expertRegistry.get(pipelineId);

    res.json({
      success: true,
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        domain: pipeline.domain,
        version: pipeline.version,
        description: pipeline.description,
        documentTypes: pipeline.documentTypes || [],
        confidenceThreshold: pipeline.confidenceThreshold,
        timeoutMs: pipeline.timeoutMs,
        stages: (pipeline.stages || []).map((stage) => ({
          id: stage.id,
          name: stage.name,
          type: stage.type,
          model: stage.model || null,
          modelType: stage.modelType || null,
          promptId: stage.promptId || null,
          guidanceTemplate: stage.guidanceTemplate || null,
          executionMode: stage.executionMode,
          outputKey: stage.outputKey,
          inputMapping: stage.inputMapping || {},
          timeout: stage.timeout || null,
          retryCount: stage.retryCount || 1,
          useParallelOcr: stage.useParallelOcr || false,
          condition: stage.condition || null,
          triggerCondition: stage.triggerCondition || null,
          validationRules: stage.validationRules || null,
          injectVatContext: stage.injectVatContext || false,
          injectLegalContext: stage.injectLegalContext || false
        }))
      }
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: `Pipeline not found: ${pipelineId}`
    });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/pipeline-stages/execute-stage — Execute a single stage
// ────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pipeline-stages/execute-stage:
 *   post:
 *     summary: Execute a single pipeline stage in isolation
 *     description: |
 *       Runs exactly one pipeline stage for a given document, returning
 *       the stage output and execution metadata.
 *       This endpoint is intended for stage-isolation E2E testing.
 *
 *       The caller specifies:
 *       - `documentId` — Paperless document to process
 *       - `pipelineId` — Pipeline containing the target stage
 *       - `stageId` — Stage to execute
 *       - `mockContext` (optional) — Inject prior stage outputs
 *       - `classificationOverride` (optional) — Override classification result
 *
 *       The endpoint handles document fetching, image rendering, and context
 *       setup automatically. It returns the raw stage output for validation.
 *     tags:
 *       - Expert Pipeline
 *       - API
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documentId
 *               - pipelineId
 *               - stageId
 *             properties:
 *               documentId:
 *                 type: integer
 *                 description: Paperless document ID
 *               pipelineId:
 *                 type: string
 *                 description: Pipeline ID (e.g. PIPELINE_FINANCIAL_V1)
 *               stageId:
 *                 type: string
 *                 description: Stage ID within the pipeline (e.g. financial_extraction)
 *               mockContext:
 *                 type: object
 *                 description: |
 *                   Inject prior stage outputs into context.
 *                   Keys are outputKey names, values are the stage output objects.
 *               classificationOverride:
 *                 type: object
 *                 description: Override classification result with custom values
 *                 properties:
 *                   primary_domain:
 *                     type: string
 *                   document_type:
 *                     type: string
 *                   confidence:
 *                     type: number
 *               options:
 *                 type: object
 *                 description: Additional pipeline options
 *     responses:
 *       200:
 *         description: Stage executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stageId:
 *                   type: string
 *                 stageType:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [success, skipped, warning, error]
 *                 output:
 *                   type: object
 *                   description: Raw stage output
 *                 executionTimeMs:
 *                   type: number
 *                 contextSnapshot:
 *                   type: object
 *                   description: Selected context fields after stage execution
 *       400:
 *         description: Invalid request (missing params, unsupported document)
 *       404:
 *         description: Pipeline or stage not found
 *       500:
 *         description: Stage execution failed
 */
router.post('/execute-stage', async (req, res) => {
  const startTime = Date.now();
  const {
    documentId,
    pipelineId,
    stageId,
    mockContext,
    classificationOverride,
    options: extraOptions
  } = req.body;

  // ── Validate inputs ─────────────────────────────────────────────────────
  const docId = parseInt(documentId, 10);
  if (isNaN(docId) || docId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing documentId'
    });
  }

  if (!pipelineId || typeof pipelineId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing pipelineId'
    });
  }

  if (!stageId || typeof stageId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid or missing stageId'
    });
  }

  // ── Resolve pipeline and stage ──────────────────────────────────────────
  let pipeline;
  try {
    pipeline = expertRegistry.get(pipelineId);
  } catch {
    return res.status(404).json({
      success: false,
      error: `Pipeline not found: ${pipelineId}`
    });
  }

  const stage = (pipeline.stages || []).find((s) => s.id === stageId);
  if (!stage) {
    return res.status(404).json({
      success: false,
      error: `Stage '${stageId}' not found in pipeline '${pipelineId}'`,
      availableStages: (pipeline.stages || []).map((s) => s.id)
    });
  }

  // ── Fetch document ──────────────────────────────────────────────────────
  let sourceDocument;
  let ocrText = '';
  try {
    [sourceDocument, ocrText] = await Promise.all([
      paperlessService.getDocument(docId),
      paperlessService.getDocumentContent(docId).catch(() => '')
    ]);
  } catch (fetchError) {
    return res.status(500).json({
      success: false,
      error: `Failed to fetch document ${docId}: ${fetchError.message}`
    });
  }

  if (!sourceDocument) {
    return res.status(404).json({
      success: false,
      error: `Document not found: ${docId}`
    });
  }

  if (!isSupportedMime(sourceDocument.mime_type)) {
    return res.status(400).json({
      success: false,
      error: `Unsupported document format: ${sourceDocument.mime_type || 'unknown'}`,
      hint: 'Expert pipeline requires PDF or image documents'
    });
  }

  // ── Prepare document & context ──────────────────────────────────────────
  const preparedDocument = buildPreparedDocument(sourceDocument, docId, ocrText);

  // Render page images for visual stages
  const needsImages = [
    StageType.CLASSIFICATION,
    StageType.VISUAL_ANALYSIS,
    StageType.PRE_VISION_NORMALIZATION,
    StageType.VISUAL_QUERY_EXECUTION
  ].includes(stage.type);

  if (needsImages) {
    try {
      const pageImages = await renderDocumentPages(docId, 3);
      if (pageImages.length > 0) {
        preparedDocument.image_data = pageImages;
        preparedDocument.page_images = pageImages;
      }
    } catch (imgError) {
      logger.warn({
        event: 'pipeline_stages_image_render_failed',
        documentId: docId,
        stageId,
        error: imgError.message
      });
    }
  }

  // Build classification result
  const classificationResult = classificationOverride
    ? {
        classification: {
          primary_domain: classificationOverride.primary_domain || 'General',
          document_type: classificationOverride.document_type || 'unknown',
          confidence: classificationOverride.confidence || 0.8
        },
        routing: {
          requires_visual_analysis: classificationOverride.requires_visual_analysis ?? true,
          requires_expert_model: classificationOverride.requires_expert_model ?? true
        },
        quality_assessment: classificationOverride.quality_assessment || {
          visual_clarity: 'high',
          text_legibility: 'high'
        }
      }
    : {
        classification: {
          primary_domain: pipeline.domain || 'General',
          document_type: 'unknown',
          confidence: 0.8
        },
        routing: {
          requires_visual_analysis: true,
          requires_expert_model: true
        }
      };

  // ── Build executor & context ────────────────────────────────────────────
  const ollamaService = AIServiceFactory.getService();
  const executor = new ExpertPipelineExecutor(ollamaService, {
    defaultTimeout: stage.timeout || 90000,
    maxRetries: stage.retryCount || 2,
    enableVisualRag: (extraOptions?.enableVisualRag !== false),
    enableMetrics: false,
    visualTriage: {
      renderWaitEnabled: true,
      renderWaitTimeoutMs: 10000
    }
  });

  const context = new ExecutionContext(preparedDocument, classificationResult, {
    pipelineId,
    guidanceEnabled: extraOptions?.guidanceEnabled ?? true,
    enableVisualRag: extraOptions?.enableVisualRag ?? true,
    renderWaitEnabled: true,
    renderWaitTimeoutMs: 10000,
    refreshImages: async () => {
      const pageImages = await renderDocumentPages(docId, 3);
      if (pageImages.length > 0) {
        preparedDocument.image_data = pageImages[0];
        preparedDocument.base64Images = pageImages;
        preparedDocument.page_images = pageImages;
      }
      return pageImages;
    },
    ...extraOptions
  });

  // Inject mock context (prior stage outputs) if provided
  if (mockContext && typeof mockContext === 'object') {
    for (const [key, value] of Object.entries(mockContext)) {
      context.setStageOutput(key, value, 0);
    }

    // If OCR output is provided, also set it on the document
    if (mockContext.ocr?.text) {
      preparedDocument.enhanced_ocr_text = mockContext.ocr.text;
      preparedDocument.ocr_text = mockContext.ocr.text;
      if (!preparedDocument.content) {
        preparedDocument.content = mockContext.ocr.text;
      }
    }
  }

  // ── Execute stage ───────────────────────────────────────────────────────
  logger.info({
    event: 'pipeline_stage_isolation_start',
    documentId: docId,
    pipelineId,
    stageId,
    stageType: stage.type,
    model: stage.model,
    promptId: stage.promptId,
    username: req.user?.username || 'unknown'
  });

  try {
    const stageResult = await executor._executeStage(stage, context, pipeline);

    const executionTimeMs = Date.now() - startTime;

    // Build a context snapshot with the fields testers care about
    const contextSnapshot = {
      stagesExecuted: context.stagesExecuted || [],
      stagesSkipped: context.stagesSkipped || [],
      errors: context.errors || [],
      warnings: context.warnings || [],
      documentId: context.document?.id,
      enhancedOcrText: context.document?.enhanced_ocr_text
        ? `${context.document.enhanced_ocr_text.substring(0, 500)}...`
        : null,
      stageOutputs: {}
    };

    // Include all stage outputs in snapshot
    if (context._stageOutputs && typeof context._stageOutputs === 'object') {
      for (const [key, value] of Object.entries(context._stageOutputs)) {
        contextSnapshot.stageOutputs[key] = value;
      }
    } else if (typeof context.getStageOutput === 'function') {
      // Try to retrieve stage output by the outputKey
      const output = context.getStageOutput(stage.outputKey);
      if (output !== undefined) {
        contextSnapshot.stageOutputs[stage.outputKey] = output;
      }
    }

    logger.info({
      event: 'pipeline_stage_isolation_complete',
      documentId: docId,
      pipelineId,
      stageId,
      status: stageResult.status,
      executionTimeMs
    });

    res.json({
      success: stageResult.status !== 'error',
      stageId,
      stageType: stage.type,
      stageName: stage.name,
      model: stage.model || null,
      promptId: stage.promptId || null,
      guidanceTemplate: stage.guidanceTemplate || null,
      status: stageResult.status,
      abort: stageResult.abort || false,
      output: stageResult.output || null,
      terminalState: stageResult.terminalState || null,
      executionTimeMs,
      contextSnapshot
    });
  } catch (execError) {
    const executionTimeMs = Date.now() - startTime;

    logger.error({
      event: 'pipeline_stage_isolation_failed',
      documentId: docId,
      pipelineId,
      stageId,
      error: execError.message,
      executionTimeMs
    });

    res.status(500).json({
      success: false,
      stageId,
      stageType: stage.type,
      status: 'error',
      error: execError.message,
      executionTimeMs
    });
  }
});

module.exports = router;
