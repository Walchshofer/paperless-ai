const express = require('express');
const router = express.Router();
const { authenticateApi, requireAdmin } = require('../../middleware/auth');
const AIServiceFactory = require('../../services/aiServiceFactory');
const paperlessService = require('../../services/paperlessService');
const { DocumentProcessor } = require('../../services/integration/DocumentProcessor');
const { promptRegistry } = require('../../services/prompts/PromptRegistry');
const logger = require('../../services/logger');

// Per-user execution tracking (prevent concurrent executions)
const activeExecutions = new Map(); // userId -> { promise, startTime, documentId }

function hasActiveExecution(userId) {
  return activeExecutions.has(userId);
}

function registerExecution(userId, promise, documentId) {
  activeExecutions.set(userId, {
    promise,
    startTime: Date.now(),
    documentId
  });
  
  // Auto-cleanup on completion
  promise.finally(() => {
    activeExecutions.delete(userId);
  });

  // Safety timeout: auto-clear after 10 minutes to prevent deadlocks
  setTimeout(() => {
    if (activeExecutions.has(userId) && activeExecutions.get(userId).startTime === activeExecutions.get(userId).startTime) {
      logger.warn(`[Prompts Runtime] Safety cleanup for active execution (user: ${userId}, doc: ${documentId}) after 10m`);
      activeExecutions.delete(userId);
    }
  }, 600000);
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
                         pipelineResult.result?.document?.image_data)
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
  
  // Validate request
  if (!documentId || !promptId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: documentId, promptId'
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
      // Fetch document
      const [document, ocrText] = await Promise.all([
        paperlessService.getDocument(documentId),
        paperlessService.getDocumentContent(documentId).catch(() => '')
      ]);
      
      if (!document) {
        return res.status(404).json({
          success: false,
          error: `Document not found: ${documentId}`
        });
      }
      
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
        id: documentId,
        title: document.title || '',
        filename: document.original_file_name || `doc-${documentId}.pdf`,
        content: ocrText || document.content || '',
        ocr_text: ocrText || document.content || '',
        created: document.created || document.added || null,
        file_size: document.size || 'unknown',
        mime_type: document.mime_type,
        page_count: 1 // Default, will be updated if images are loaded
      };

      // Load images if needed for multimodal prompts
      if (needsMultimodal || needsExtraction || needsTriage) {
        try {
          const { NormalizationStore } = require('../../services/normalization/NormalizationStore');
          const normStore = new NormalizationStore();
          const page1Path = normStore.getPagePath(documentId, 1);
          const fs = require('fs').promises;
          
          try {
            await fs.access(page1Path);
            const imageBuffer = await fs.readFile(page1Path);
            preparedDocument.image_data = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            preparedDocument.base64Images = [preparedDocument.image_data];
            preparedDocument.page_count = 1;
            logger.info(`[Prompts Runtime] Loaded persisted 300dpi image for doc ${documentId}`);
          } catch (err) {
            // Fallback: load direct if image or render on demand if PDF
            const isImage = preparedDocument.mime_type && preparedDocument.mime_type.startsWith('image/');
            
            if (isImage) {
              logger.info(`[Prompts Runtime] Loading image directly for doc ${documentId} (${preparedDocument.mime_type})`);
              const imageBuffer = await paperlessService.downloadDocument(documentId);
              if (imageBuffer) {
                preparedDocument.image_data = `data:${preparedDocument.mime_type};base64,${imageBuffer.toString('base64')}`;
                preparedDocument.base64Images = [preparedDocument.image_data];
                preparedDocument.page_count = 1;
              }
            } else {
              logger.info(`[Prompts Runtime] No persisted image for doc ${documentId}, rendering 300 DPI (real-conditions)...`);
              const { pdfRenderer } = require('../../services/visual-rag-client/PDFRenderer');
              const pdfBuffer = await paperlessService.downloadDocument(documentId);
              if (pdfBuffer) {
                const images = await pdfRenderer.renderBuffer(pdfBuffer, {
                  dpi: 300, // Real-world conditions
                  maxPages: 1,
                  docId: documentId
                });
                if (images && images.length > 0) {
                  preparedDocument.image_data = `data:image/png;base64,${images[0].base64}`;
                  preparedDocument.base64Images = [preparedDocument.image_data];
                  preparedDocument.page_count = images.length;
                  logger.info(`[Prompts Runtime] Successfully rendered doc ${documentId}, img_len=${preparedDocument.image_data.length}`);
                } else {
                  logger.warn(`[Prompts Runtime] Render returned no images for doc ${documentId}`);
                }
              }
            }
          }
        } catch (imgErr) {
          logger.warn(`[Prompts Runtime] Failed to load images for doc ${documentId}:`, imgErr.message);
        }
      }

      let processingResult = { success: true, result: { document: preparedDocument }, metadata: {} };
      const ollamaService = AIServiceFactory.getService();
      
      if (needsExtraction) {
        // Optimization: if we already have OCR text from paperless and don't need visual fields, 
        // we can bypass the full pipeline to save time in the test lab.
        const onlyNeedsText = detectedVars.every(v => !['visual_fields', 'extraction_result'].includes(v));
        if (onlyNeedsText && preparedDocument.ocr_text) {
          logger.info(`[Prompts Runtime] Tier 3 (Optimized): Using existing OCR for "${promptId}"`);
          processingResult = { 
            success: true, 
            result: { 
              ocr: { text: preparedDocument.ocr_text, confidence: 1.0 },
              document: preparedDocument 
            }, 
            metadata: { confidence: 1.0 } 
          };
        } else {
          logger.info(`[Prompts Runtime] Tier 3: Full Pipeline for "${promptId}"`);
          const processor = new DocumentProcessor(ollamaService, { defaultTimeout: 30000 });
          processingResult = await processor.process(preparedDocument, { mode: 'EXPERT_PIPELINE' });
        }
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
      
      // Inject image data for multimodal support in simulation streaming
      if (preparedDocument.image_data) {
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
            id: documentId,
            title: document.title || '',
            filename: preparedDocument.filename
          }
        });
      } else {
        const errorInfo = formatPipelineError(processingResult);
        return res.status(500).json({
          success: false,
          error: processingResult.error || 'Pipeline execution failed',
          variables,
          pipelineMetadata: {
            pipelineId: processingResult.metadata?.pipelineId || '',
            duration,
            confidence: 0,
            stages: errorInfo.stages
          },
          documentMetadata: {
            id: documentId,
            title: document.title || '',
            filename: preparedDocument.filename
          }
        });
      }
    } catch (error) {
      logger.error('[Prompts Runtime API] Execution failed:', error);
      const duration = Date.now() - startTime;
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Pipeline execution failed',
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
  registerExecution(userId, executionPromise, documentId);
  
  await executionPromise;
});

// Export helper functions for testing
router._helpers = {
  hasActiveExecution,
  registerExecution,
  extractTemplateVars,
  mapPipelineContextToVariables,
  formatPipelineError,
  activeExecutions
};

module.exports = router;
