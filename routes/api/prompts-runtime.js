const express = require('express');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const router = express.Router();
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const AIServiceFactory = require('../../services/aiServiceFactory');
const paperlessService = require('../../services/paperlessService');
const {
  DocumentProcessor,
  ImagePreparator
} = require('../../services/integration/DocumentProcessor');
const { promptRegistry } = require('../../services/prompts/PromptRegistry');
const logger = require('../../services/logger');

// Per-user execution tracking (prevent concurrent executions)
const activeExecutions = new Map(); // userId -> { promise, startTime, documentId, executionId }

function hasActiveExecution(userId) {
  return activeExecutions.has(userId);
}

function registerExecution(userId, promise, documentId, cleanupDelayMs = 600000) {
  const startTime = Date.now();
  const executionId = Symbol(`prompts-runtime-${userId}`);
  activeExecutions.set(userId, {
    promise,
    startTime,
    documentId,
    executionId
  });
  
  // Auto-cleanup on completion
  promise.finally(() => {
    const activeExecution = activeExecutions.get(userId);
    if (activeExecution && activeExecution.executionId === executionId) {
      activeExecutions.delete(userId);
    }
  });

  // Safety timeout: auto-clear after 10 minutes to prevent deadlocks
  setTimeout(() => {
    const activeExecution = activeExecutions.get(userId);
    if (activeExecution && activeExecution.executionId === executionId) {
      logger.warn(`[Prompts Runtime] Safety cleanup for active execution (user: ${userId}, doc: ${documentId}) after 10m`);
      activeExecutions.delete(userId);
    }
  }, cleanupDelayMs);
}

/**
 * Extract {{variable}} names from text
 * @param {string} text - Template text
 * @returns {Array<string>} Array of variable names
 */
function extractTemplateVars(text) {
  const matches = (text || '').match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2).trim()))];
}

/**
 * Map pipeline execution result to prompt template variables
 * @param {Object} pipelineResult - Result from DocumentProcessor.process()
 * @param {Array<string>} promptVariables - Detected variables from template
 * @returns {Object} Mapped variables { varName: value }
 */
function mapPipelineContextToVariables(pipelineResult, promptVariables) {
  const mapping = {};
  
  // Variable mapping table
  const varMap = {
    'ocr_text': () => pipelineResult.result?.ocr?.text || pipelineResult.result?.content || '',
    'text_chunk': () => pipelineResult.result?.ocr?.text || pipelineResult.result?.content || '',
    'content': () => pipelineResult.result?.ocr?.text || pipelineResult.result?.content || '',
    'ocr_quality': () => String(pipelineResult.result?.ocr?.confidence || 'medium'),
    'domain': () => pipelineResult.result?.classification?.classification?.primary_domain || 
                    pipelineResult.result?.classification?.domain || 'general',
    'document_type': () => pipelineResult.result?.classification?.classification?.doc_type_hint || 
                           pipelineResult.result?.classification?.doc_type || '',
    'filename': () => pipelineResult.result?._expert_result?.document?.filename || 
                      pipelineResult.result?.document?.filename || '',
    'source_system': () => 'test-lab',
    'resolution': () => pipelineResult.result?._expert_result?.document?.resolution || '300 DPI',
    'file_size': () => String(pipelineResult.result?._expert_result?.document?.file_size || 'unknown'),
    'page_number': () => '1',
    'total_pages': () => String(pipelineResult.result?._expert_result?.document?.page_count || 
                                pipelineResult.result?.document?.page_count || 
                                pipelineResult.result?.document?.base64Images?.length || 1),
    'extraction_result': () => JSON.stringify(pipelineResult.result?.extraction || {}),
    'visual_fields': () => JSON.stringify(pipelineResult.result?.visualElements || 
                                         pipelineResult.result?.visual || []),
    'confidence': () => String(pipelineResult.metadata?.confidence || 
                              pipelineResult.result?.confidence || 0),
    'title': () => pipelineResult.result?._expert_result?.document?.title || 
                    pipelineResult.result?.document?.title || '',
    'created': () => pipelineResult.result?._expert_result?.document?.created || 
                      pipelineResult.result?.document?.created || '',
    'pipeline_id': () => pipelineResult.metadata?.pipelineId || '',
    'classification_json': () => JSON.stringify(pipelineResult.result?._expert_result?.result?.classification?.classification || 
                                               pipelineResult.result?.classification?.classification || 
                                               pipelineResult.result?.classification || {}),
    'routing_json': () => JSON.stringify(pipelineResult.result?._expert_result?.result?.classification?.routing || 
                                        pipelineResult.result?.classification?.routing || {}),
    'quality_json': () => JSON.stringify(pipelineResult.result?._expert_result?.result?.classification?.quality_assessment || 
                                        pipelineResult.result?.classification?.quality_assessment || {}),
    'doc_stats': () => JSON.stringify({
      id: pipelineResult.result?.document?.id,
      filename: pipelineResult.result?.document?.filename,
      ocr_length: (pipelineResult.result?.ocr?.text || '').length,
      has_image: Boolean(pipelineResult.result?._expert_result?.document?.image_data || 
                         pipelineResult.result?.document?.image_data ||
                         pipelineResult.result?._expert_result?.document?.image_path ||
                         pipelineResult.result?.document?.image_path)
    }),
    'pipelines': () => {
      const { expertRegistry } = require('../../services/experts/ExpertRegistry');
      return JSON.stringify(expertRegistry.getPipelines().map(p => ({
        id: p.id,
        name: p.name,
        domain: p.domain,
        documentTypes: p.documentTypes
      })));
    },
    'tools_json': () => {
      const { getAllowedToolDefinitions, resolveToolingConfig } = require('../../services/experts/utils');
      const toolingConfig = resolveToolingConfig({});
      return JSON.stringify(getAllowedToolDefinitions(toolingConfig));
    }
  };
  
  for (const varName of promptVariables) {
    if (varMap[varName]) {
      mapping[varName] = varMap[varName]();
    } else {
      mapping[varName] = `[unmapped: ${varName}]`;
    }
  }
  
  return mapping;
}

/**
 * Determine whether mapped runtime variables contain useful content.
 * Filters out placeholders and purely diagnostic/internal keys.
 *
 * @param {Object} variables
 * @returns {boolean}
 */
function hasMeaningfulRuntimeVariables(variables = {}) {
  return Object.entries(variables).some(([name, value]) => {
    if (name.startsWith('__')) return false;

    const text = String(value ?? '').trim();
    if (!text) return false;
    if (text.startsWith('[unmapped:') && text.endsWith(']')) return false;

    // Ignore static defaults when judging degraded success.
    if (name === 'source_system' && text === 'test-lab') return false;
    if (name === 'resolution' && text === '300 DPI') return false;
    if (name === 'file_size' && text === 'unknown') return false;

    return true;
  });
}

function stripImageDataHeader(imageData) {
  if (typeof imageData !== 'string') {
    return '';
  }
  return imageData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
}

function resolveExpectedPageCount(rawCount) {
  const parsed = Number(rawCount);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return 1;
}

function toPngDataUrl(base64Payload) {
  const cleanPayload = stripImageDataHeader(base64Payload);
  if (!cleanPayload) {
    return '';
  }
  return `data:image/png;base64,${cleanPayload}`;
}

async function loadBase64ImagesFromPaths(pagePaths) {
  const normalizedPaths = Array.isArray(pagePaths)
    ? pagePaths.filter(Boolean)
    : [];
  if (normalizedPaths.length === 0) {
    return [];
  }

  const images = [];
  for (const pagePath of normalizedPaths) {
    try {
      const pageBuffer = await fs.readFile(pagePath);
      const imageDataUrl = toPngDataUrl(pageBuffer.toString('base64'));
      if (imageDataUrl) {
        images.push(imageDataUrl);
      }
    } catch (readError) {
      const error = new Error(
        `Failed to read normalized PNG attachment: ${pagePath}`
      );
      error.code = 'VISUAL_ATTACHMENT_FAILED';
      error.cause = readError;
      throw error;
    }
  }

  if (images.length === 0) {
    const error = new Error(
      'Normalized PNG attachment set was empty after loading'
    );
    error.code = 'VISUAL_ATTACHMENT_FAILED';
    throw error;
  }

  return images;
}

async function loadPersistedNormalizedPngPaths(documentId, expectedPages) {
  const { NormalizationStore } = require('../../services/normalization/NormalizationStore');
  const normalizationStore = new NormalizationStore();
  const pageCount = resolveExpectedPageCount(expectedPages);
  const pagePaths = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const pagePath = normalizationStore.getPagePath(documentId, pageNumber);
    try {
      await fs.access(pagePath);
      pagePaths.push(pagePath);
    } catch (_error) {
      return {
        expectedPages: pageCount,
        pagePaths,
        complete: false
      };
    }
  }

  return {
    expectedPages: pageCount,
    pagePaths,
    complete: pagePaths.length === pageCount
  };
}

async function persistRuntimePngPages(base64Images, documentId) {
  const images = Array.isArray(base64Images)
    ? base64Images.filter(Boolean)
    : [];
  if (images.length === 0) {
    return [];
  }

  const docKey = String(documentId || `doc-${Date.now()}`).replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );
  const outputDir = path.join(
    os.tmpdir(),
    'paperless-ai',
    'prompts-runtime-images',
    docKey
  );
  await fs.mkdir(outputDir, { recursive: true });

  const pagePaths = [];
  for (let i = 0; i < images.length; i += 1) {
    const cleanBase64 = stripImageDataHeader(images[i]);
    if (!cleanBase64) {
      continue;
    }
    const filePath = path.join(outputDir, `page_${i + 1}.png`);
    await fs.writeFile(filePath, Buffer.from(cleanBase64, 'base64'));
    pagePaths.push(filePath);
  }

  if (pagePaths.length === 0) {
    const error = new Error(
      'Failed to persist runtime PNG attachments for multimodal prompt testing'
    );
    error.code = 'VISUAL_ATTACHMENT_FAILED';
    throw error;
  }

  return pagePaths;
}

async function ensureRuntimePngAttachments(preparedDocument, documentId) {
  if (preparedDocument.image_path) {
    const existingPaths = Array.isArray(preparedDocument.page_image_paths)
      ? preparedDocument.page_image_paths.filter(Boolean)
      : [preparedDocument.image_path];
    if (existingPaths.length === 0) {
      const error = new Error(
        'Runtime PNG attachment path is missing for multimodal prompt testing'
      );
      error.code = 'VISUAL_INPUT_MISSING';
      throw error;
    }
    for (const filePath of existingPaths) {
      try {
        await fs.access(filePath);
      } catch (_error) {
        const error = new Error(
          `Runtime PNG attachment path is not readable: ${filePath}`
        );
        error.code = 'VISUAL_ATTACHMENT_FAILED';
        throw error;
      }
    }
    return existingPaths;
  }

  const sourceImages =
    Array.isArray(preparedDocument.base64Images)
    && preparedDocument.base64Images.length > 0
      ? preparedDocument.base64Images
      : preparedDocument.image_data
        ? [preparedDocument.image_data]
        : [];

  if (sourceImages.length === 0) {
    const error = new Error(
      'No PNG page image is available for multimodal runtime context generation'
    );
    error.code = 'VISUAL_INPUT_MISSING';
    throw error;
  }

  const pagePaths = await persistRuntimePngPages(sourceImages, documentId);
  preparedDocument.page_image_paths = pagePaths;
  preparedDocument.image_path = pagePaths[0];
  preparedDocument.image_path_abs = pagePaths[0];
  return pagePaths;
}

function isCriticalVisualErrorCode(errorCode) {
  return [
    'VISUAL_INPUT_MISSING',
    'VISUAL_ATTACHMENT_FAILED',
    'VISUAL_OCR_REQUIRED',
    'VISUAL_OCR_FAILED'
  ].includes(errorCode);
}

/**
 * Format pipeline error with stage breakdown
 * @param {Object} pipelineResult - Failed pipeline result
 * @returns {Object} Formatted error response
 */
function formatPipelineError(pipelineResult) {
  const stages = [];
  
  // Extract stage information from pipeline result
  const expertResult = pipelineResult._expert_result || pipelineResult;
  const quality = expertResult?.quality || {};
  const errors = quality.errors || [];
  
  // Build stage breakdown
  if (errors.length > 0) {
    errors.forEach(err => {
      stages.push({
        name: err.stage || 'unknown',
        status: 'error',
        error: err.error || err.message || 'Unknown error',
        duration: err.duration || 0
      });
    });
  }
  
  return {
    message: 'Pipeline execution failed',
    stages,
    summary: `${errors.length} stage(s) failed`
  };
}

/**
 * POST /api/prompts-runtime/context
 * Execute pipeline and return mapped variables for test lab
 */
router.post('/context', express.json(), authenticateApi, requireAdmin, async (req, res) => {
  const startTime = Date.now();
  const { documentId, promptId } = req.body;
  const userId = req.user.id;
  const parsedDocumentId = Number(documentId);
  
  // Validate request
  if (!Number.isInteger(parsedDocumentId) || parsedDocumentId <= 0 || !promptId) {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid required fields: documentId, promptId'
    });
  }
  
  // Validate prompt exists
  if (!promptRegistry.has(promptId)) {
    return res.status(404).json({
      success: false,
      error: `Prompt not found: ${promptId}`
    });
  }
  
  // Check per-user execution limit
  if (hasActiveExecution(userId)) {
    const active = activeExecutions.get(userId);
    return res.status(429).json({
      success: false,
      error: 'You have an active test execution. Please wait for it to complete.',
      activeExecution: {
        documentId: active.documentId,
        startTime: active.startTime
      }
    });
  }
  
  const executeAndMap = async () => {
    try {
      // Fetch document first so 404s return the correct status for test lab.
      let document = null;
      try {
        document = await paperlessService.getDocument(parsedDocumentId);
      } catch (error) {
        if (error?.response?.status === 404) {
          return res.status(404).json({
            success: false,
            error: `Document not found: ${parsedDocumentId}`
          });
        }
        throw error;
      }
      
      if (!document) {
        return res.status(404).json({
          success: false,
          error: `Document not found: ${parsedDocumentId}`
        });
      }

      const ocrText = await paperlessService
        .getDocumentContent(parsedDocumentId)
        .catch(() => '');
      
      const prompt = promptRegistry.get(promptId);
      const detectedVars = [
        ...extractTemplateVars(prompt.systemPrompt),
        ...extractTemplateVars(prompt.userTemplate || prompt.userPromptTemplate || '')
      ];

      // Determine required context tier
      const triageVars = ['classification_json', 'routing_json', 'quality_json', 'doc_stats', 'domain', 'document_type'];
      const extractionVars = ['extraction_result', 'visual_fields', 'ocr_text', 'content', 'text_chunk', 'ocr_quality'];
      
      const needsExtraction = detectedVars.some(v => extractionVars.includes(v));
      const needsMultimodal = prompt.modelType === 'multimodal';
      const needsTriage = needsExtraction || needsMultimodal || detectedVars.some(v => triageVars.includes(v));

      // Prepare document metadata
      const preparedDocument = {
        id: parsedDocumentId,
        title: document.title || '',
        filename: document.original_file_name || `doc-${parsedDocumentId}.pdf`,
        content: ocrText || document.content || '',
        ocr_text: ocrText || document.content || '',
        created: document.created || document.added || null,
        file_size: document.size || 'unknown',
        mime_type: document.mime_type,
        page_count: Number(document.page_count) || 1
      };

      // Load images if needed for multimodal prompts
      if (needsMultimodal || needsExtraction || needsTriage) {
        try {
          const expectedPages = resolveExpectedPageCount(
            preparedDocument.page_count
          );

          const persistedNormalized = await loadPersistedNormalizedPngPaths(
            parsedDocumentId,
            expectedPages
          );

          if (persistedNormalized.complete && persistedNormalized.pagePaths.length > 0) {
            const base64Images = await loadBase64ImagesFromPaths(
              persistedNormalized.pagePaths
            );
            preparedDocument.page_image_paths = persistedNormalized.pagePaths;
            preparedDocument.image_path = persistedNormalized.pagePaths[0];
            preparedDocument.image_path_abs = persistedNormalized.pagePaths[0];
            preparedDocument.base64Images = base64Images;
            preparedDocument.image_data = base64Images[0];
            preparedDocument.page_count = persistedNormalized.pagePaths.length;

            logger.info(
              `[Prompts Runtime] Loaded ${persistedNormalized.pagePaths.length} persisted normalized PNG page(s) for doc ${parsedDocumentId}`
            );
          } else {
            if (persistedNormalized.pagePaths.length > 0) {
              logger.warn(
                `[Prompts Runtime] Incomplete normalized PNG set for doc ${parsedDocumentId}: expected ${persistedNormalized.expectedPages}, found ${persistedNormalized.pagePaths.length}`
              );
            }

            const { pdfRenderer } = require('../../services/visual-rag-client/PDFRenderer');
            const downloadBuffer = await paperlessService.downloadDocument(parsedDocumentId);
            
            if (downloadBuffer) {
              const detectedFormat = ImagePreparator._detectImageFormat(downloadBuffer);
              logger.info(`[Prompts Runtime] Downloaded doc ${parsedDocumentId}, detected format: ${detectedFormat}`);
              
              if (detectedFormat !== 'pdf' && detectedFormat !== 'unknown') {
                // It's a supported image format, use it directly
                logger.info(`[Prompts Runtime] Using image directly for doc ${parsedDocumentId} (${detectedFormat})`);
                const preparedImage = await ImagePreparator.prepare(downloadBuffer);
                if (preparedImage?.base64) {
                  preparedDocument.image_data = preparedImage.base64;
                  preparedDocument.base64Images = [preparedImage.base64];
                }
                preparedDocument.page_count = 1;
              } else {
                // It's a PDF or something that needs rendering (or fallback to render attempt)
                logger.info(`[Prompts Runtime] Rendering doc ${parsedDocumentId} at 300 DPI (pages=${expectedPages})`);
                const images = await pdfRenderer.renderBuffer(downloadBuffer, {
                  dpi: 300,
                  maxPages: expectedPages,
                  docId: parsedDocumentId
                });
                
                if (images && images.length > 0) {
                  const runtimeImages = images
                    .map((image) => toPngDataUrl(image.base64))
                    .filter(Boolean);
                  preparedDocument.base64Images = runtimeImages;
                  preparedDocument.image_data = runtimeImages[0] || null;
                  preparedDocument.page_count = runtimeImages.length;
                  logger.info(
                    `[Prompts Runtime] Rendered ${runtimeImages.length} PNG page(s) for doc ${parsedDocumentId}`
                  );
                } else {
                  logger.warn(
                    `[Prompts Runtime] Render returned no images for doc ${parsedDocumentId}`
                  );
                }
              }
            }
          }

          const runtimePagePaths = await ensureRuntimePngAttachments(
            preparedDocument,
            parsedDocumentId
          );
          const requiredPages = resolveExpectedPageCount(preparedDocument.page_count);
          if (runtimePagePaths.length < requiredPages) {
            const pageCoverageError = new Error(
              `Runtime PNG coverage is incomplete (expected ${requiredPages}, found ${runtimePagePaths.length})`
            );
            pageCoverageError.code = 'VISUAL_INPUT_MISSING';
            throw pageCoverageError;
          }
        } catch (imgErr) {
          logger.warn(`[Prompts Runtime] Failed to load images for doc ${parsedDocumentId}:`, imgErr.message);
          const mustFailForPrompt = needsMultimodal === true;
          if (isCriticalVisualErrorCode(imgErr.code) || mustFailForPrompt) {
            const errorCode = isCriticalVisualErrorCode(imgErr.code)
              ? imgErr.code
              : 'VISUAL_INPUT_MISSING';
            return res.status(422).json({
              success: false,
              error: imgErr.message,
              code: errorCode
            });
          }
        }
      }

      let processingResult = { success: true, result: { document: preparedDocument }, metadata: {} };
      const ollamaService = AIServiceFactory.getService();
      
      if (needsExtraction) {
        logger.info(`[Prompts Runtime] Tier 3: Full Pipeline for "${promptId}"`);
        const processor = new DocumentProcessor(ollamaService, { defaultTimeout: 30000 });
        processingResult = await processor.process(preparedDocument, {
          mode: 'EXPERT_PIPELINE',
          forceVisualOcr: true,
          forceAllPages: true
        });
      } else if (needsTriage) {
        logger.info(`[Prompts Runtime] Tier 2: Triage Only for "${promptId}"`);
        const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
        const executor = new ExpertPipelineExecutor(ollamaService);
        const triageResult = await executor._classifyDocumentWithVisualTriage(preparedDocument, {
          renderWaitEnabled: true,
          refreshImages: async () => {
             // For triage only in test lab, we can just use the base images if available
             return preparedDocument.base64Images || [];
          }
        });
        processingResult = { 
          success: !triageResult._meta?.fallback, 
          result: { classification: triageResult, document: preparedDocument },
          metadata: { confidence: triageResult.confidence } 
        };
      } else {
        logger.info(`[Prompts Runtime] Tier 1: Metadata Only for "${promptId}"`);
      }
      
      // Map variables
      const variables = mapPipelineContextToVariables(processingResult, detectedVars);
      
      // Prefer PNG attachment paths for multimodal prompt test execution.
      if (
        Array.isArray(preparedDocument.page_image_paths)
        && preparedDocument.page_image_paths.length > 0
      ) {
        variables.__image_paths = JSON.stringify(
          preparedDocument.page_image_paths
        );
        variables.__image_path = preparedDocument.page_image_paths[0];
      } else if (preparedDocument.image_path) {
        variables.__image_path = preparedDocument.image_path;
      } else if (preparedDocument.image_data) {
        // Compatibility fallback for older test clients.
        variables.__image_data = preparedDocument.image_data;
      }

      // Inject missing metadata if pipeline was skipped or didn't provide them
      if (!variables.filename || variables.filename.includes('unmapped')) {
        variables.filename = preparedDocument.filename;
      }
      if (!variables.file_size || variables.file_size.includes('unmapped')) {
        variables.file_size = String(preparedDocument.file_size);
      }
      if (!variables.resolution || variables.resolution.includes('unmapped')) {
        variables.resolution = '300 DPI'; // Standard baseline
      }

      const duration = Date.now() - startTime;
      
      if (processingResult.success) {
        return res.json({
          success: true,
          variables,
          pipelineMetadata: {
            pipelineId: processingResult.metadata?.pipelineId || (needsExtraction || needsTriage ? 'pipeline_optimized' : 'metadata_only'),
            duration,
            confidence: processingResult.metadata?.confidence || 1.0,
            stages: []
          },
          documentMetadata: {
            id: parsedDocumentId,
            title: document.title || '',
            filename: preparedDocument.filename
          }
        });
      } else {
        const errorInfo = formatPipelineError(processingResult);
        const errorCode = processingResult.errorCode
          || processingResult.metadata?.errorCode
          || null;
        const isCriticalVisualFailure = isCriticalVisualErrorCode(errorCode);
        const hasStageErrors = Array.isArray(errorInfo.stages)
          && errorInfo.stages.length > 0;
        const hasUsableVariables = hasMeaningfulRuntimeVariables(variables);
        const normalizedStages = hasStageErrors
          ? errorInfo.stages
          : [{
            name: 'runtime-context',
            status: 'error',
            error: processingResult.error || 'Pipeline execution failed',
            duration
          }];

        if (isCriticalVisualFailure) {
          return res.status(422).json({
            success: false,
            error: processingResult.error || 'Visual pipeline input is missing',
            code: errorCode,
            variables,
            pipelineMetadata: {
              pipelineId: processingResult.metadata?.pipelineId || '',
              duration,
              confidence: 0,
              stages: normalizedStages
            },
            documentMetadata: {
              id: parsedDocumentId,
              title: document.title || '',
              filename: preparedDocument.filename
            }
          });
        }

        // Test lab can continue when pipeline failed noisily but still produced
        // usable mapped context and no explicit stage failures to display.
        if (!hasStageErrors && hasUsableVariables) {
          logger.warn({
            event: 'prompts_runtime_context_degraded_success',
            promptId,
            documentId: parsedDocumentId,
            error: processingResult.error || 'pipeline_failed_without_stages'
          });

          return res.json({
            success: true,
            degraded: true,
            warning: processingResult.error || 'Pipeline partially failed',
            variables,
            pipelineMetadata: {
              pipelineId: processingResult.metadata?.pipelineId || '',
              duration,
              confidence: processingResult.metadata?.confidence || 0,
              stages: normalizedStages
            },
            documentMetadata: {
              id: parsedDocumentId,
              title: document.title || '',
              filename: preparedDocument.filename
            }
          });
        }

        return res.status(500).json({
          success: false,
          error: processingResult.error || 'Pipeline execution failed',
          variables,
          pipelineMetadata: {
            pipelineId: processingResult.metadata?.pipelineId || '',
            duration,
            confidence: 0,
            stages: normalizedStages
          },
          documentMetadata: {
            id: parsedDocumentId,
            title: document.title || '',
            filename: preparedDocument.filename
          }
        });
      }
    } catch (error) {
      logger.error('[Prompts Runtime API] Execution failed:', error);
      const duration = Date.now() - startTime;
      const errorCode = error?.code || null;
      const statusCode = isCriticalVisualErrorCode(errorCode) ? 422 : 500;
      
      return res.status(statusCode).json({
        success: false,
        error: error.message || 'Pipeline execution failed',
        code: errorCode,
        pipelineMetadata: {
          duration,
          stages: [{
            name: 'execution',
            status: 'error',
            error: error.message,
            duration
          }]
        }
      });
    }
  };
  
  // Register execution and run
  const executionPromise = executeAndMap();
  registerExecution(userId, executionPromise, parsedDocumentId);
  
  await executionPromise;
});

// Export helper functions for testing
router._helpers = {
  hasActiveExecution,
  registerExecution,
  extractTemplateVars,
  mapPipelineContextToVariables,
  hasMeaningfulRuntimeVariables,
  formatPipelineError,
  resolveExpectedPageCount,
  loadBase64ImagesFromPaths,
  loadPersistedNormalizedPngPaths,
  persistRuntimePngPages,
  ensureRuntimePngAttachments,
  isCriticalVisualErrorCode,
  activeExecutions
};

module.exports = router;
