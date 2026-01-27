/**
 * ExpertPipelineExecutor.js
 *
 * Stage-by-stage pipeline execution engine for expert model chains.
 * Orchestrates document flow through classification, analysis, and integration stages.
 *
 * Architecture Reference: Expert Model Pipeline Design, Section 4
 * Hardware Target: NVIDIA RTX 3090 Ti (24GB VRAM)
 */

const axios = require('axios');

const logger = require('../logger');
const config = require('../../config/config');

const { calculateTokens, truncateToTokenLimit } = require('../ollama/utils');
const truncationMetrics = require('../ollama/truncationMetrics');

const { metricsCollector } = require('../metrics/PrometheusMetrics');
const { promptRegistry, ModelType, MODEL_NAMES } = require('../prompts/PromptRegistry');

const internalVatRag = require('../rag/InternalVatRag');
const internalLegalRag = require('../rag/InternalLegalRag');
const JsonRepairService = require('../rag/JsonRepairService');

const { expertRegistry, StageType, ExecutionMode } = require('./ExpertRegistry');

// Delay importing LocalTranslator to avoid circular dependency issues
const paperlessService = require('../paperlessService');

// Import extracted utility modules
const { ExecutionContext } = require('./context');
const { ConditionEvaluator, ValidationEngine } = require('./evaluation');

// Import Guidance client for deterministic extraction
const { guidanceClient, getFallbackPromptId } = require('../guidance');

// Import ParallelOcrExecutor for Phase 2: Parallel OCR Execution
const { ParallelOcrExecutor } = require('./ParallelOcrExecutor');

// Import utility modules (via centralized index)
const {
  normalizeLanguageHint,
  normalizeBoolean,
  resolveDocumentImages,
  ORCHESTRATOR_TOOL_PHASES,
  resolveToolingConfig,
  getAllowedToolDefinitions,
  extractToolPlan,
  requiresHumanReview,
  resolveGuidanceTemplateName,
  mergeOcrResults,
  buildVisOcrMetadata,
  ensureOcrCustomFields,
  executeToolCalls,
  attachToolingSummary
} = require('./utils');

/**
 * ExpertPipelineExecutor - Main execution engine
 *
 * Executes pipeline stages in order, handling:
 * - Conditional execution
 * - Parallel stages (where supported)
 * - Fallback/recovery stages
 * - Timeout management
 * - Error handling and logging
 */
class ExpertPipelineExecutor {
  /**
   * @param {Object} ollamaService - Reference to Ollama API service
   * @param {Object} options - Executor configuration
   */
  constructor(ollamaService, options = {}) {
    this.ollamaService = ollamaService;
    this.options = {
      defaultTimeout: options.defaultTimeout || 60000,
      maxRetries: options.maxRetries || 2,
      logLevel: options.logLevel || 'info',
      enableMetrics: options.enableMetrics !== false,
      enableVisualRag:
        options.enableVisualRag ?? config.visualRagSidecar?.enabled === 'yes',
      includeOverlaysInResult: options.includeOverlaysInResult ?? true,
      embeddingModel: options.embeddingModel || 'nomic-embed-text',
      ...options
    };

    this.translator = options.translator || null;
    this.semanticRouter = options.semanticRouter || null;
    this.metricsCollector = options.metricsCollector || metricsCollector || null;
    this.visualSearchClient = options.visualSearchClient || null;
    this.ragService = options.ragService || null;

    // Execution statistics
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTimeMs: 0,
      routerRetries: 0,
      routerFallbacks: 0
    };

    // JSON repair helper (uses Ollama 'sauerkraut' model)
    this.jsonRepairService = new JsonRepairService(this.ollamaService);

    // Visual RAG components (lazy-initialized)
    this._visualRagInitialized = false;
    this._ingestionManager = null;
    this._visualOverlayRepository = null;

    // Parallel OCR Executor (Phase 2)
    this.parallelOcrExecutor = new ParallelOcrExecutor(
      this.ollamaService,
      options.parallelOcr || {},
      options.metricsCollector || null
    );
  }

  /**
   * Initialize Visual RAG components lazily
   * @private
   */
  _initVisualRag() {
    if (this._visualRagInitialized) return;
    this._visualRagInitialized = true;

    // Lazy import to avoid unused load + circular patterns
    const { getVisualRagModules } = require('./utils');
    const modules = getVisualRagModules();

    if (modules) {
      this._ingestionManager = modules.ingestionManager;
      this._visualOverlayRepository = modules.visualOverlayRepository;
      logger.debug('[ExpertPipelineExecutor] Visual RAG components initialized');
    }
  }

  _getVisualSearchClient() {
    if (this.visualSearchClient) {
      return this.visualSearchClient;
    }
    const { VisualSearchClient } = require('../visual-rag-client/VisualSearchClient');
    return new VisualSearchClient();
  }

  _getRagService() {
    if (this.ragService) {
      return this.ragService;
    }
    return require('../ragService');
  }

  /**
   * Execute a complete pipeline for a document
   *
   * @param {string} pipelineId - Pipeline to execute
   * @param {Object} document - Document data (image, text, metadata)
   * @param {Object} classificationResult - Output from router/classifier
   * @param {Object} options - Execution options
   * @returns {Object} Pipeline execution result
   */
  async execute(pipelineId, document, classificationResult, options = {}) {
    const startTime = Date.now();
    this.stats.totalExecutions += 1;

    try {
      logger.info({
        event: 'pipeline_execution_start',
        pipelineId,
        documentId: document.id || document.filename,
        classification: classificationResult?.classification?.primary_domain
      });

      // Get pipeline definition
      let pipeline;
      try {
        pipeline = expertRegistry.get(pipelineId);
      } catch (pipelineError) {
        // Try to find a pipeline by stage id (backwards compatibility)
        try {
          pipeline = expertRegistry.findPipelineByStageId(pipelineId);
          logger.info(`Resolved stage id ${pipelineId} to pipeline ${pipeline.id}`);
        } catch (resolutionError) {
          logger.error({
            event: 'pipeline_not_found',
            pipelineId,
            error: resolutionError.message
          });
          return this._buildErrorResult(pipelineId, pipelineError, startTime);
        }
      }

      // Create execution context
      const context = new ExecutionContext(document, classificationResult, {
        ...options,
        pipelineId
      });

      // Execute stages
      let finalStatus = 'success';
      try {
        for (const stage of (pipeline && pipeline.stages) || []) {
          const stageResult = await this._executeStage(stage, context, pipeline);

          // Abort handling
          if (stageResult.abort) {
            finalStatus = 'failed';
            break;
          }

          // Unload model after stage if requested (for model swaps)
          if (stage.unloadAfter) {
            try {
              await this._unloadModel(stage.unloadModelName || stage.model);
            } catch (unloadError) {
              logger.warn({
                event: 'model_unload_error',
                stageId: stage.id,
                error: unloadError.message
              });
            }
          }

          // Partial success scenarios
          if (stageResult.status === 'error' && stage.type !== StageType.RECOVERY) {
            finalStatus = 'partial';
          }
        }
      } catch (stageExecutionError) {
        logger.error({
          event: 'pipeline_execution_error',
          pipelineId,
          error: stageExecutionError.message
        });
        finalStatus = 'failed';
        context.addError('pipeline', stageExecutionError);
      }

      // Execute post-analysis tools if orchestration is available
      if (context.options?.orchestration && !context.options.orchestration.extraction_failed) {
        const { plan: toolPlan } = extractToolPlan(context.options.orchestration);
        context.options.orchestration.tool_plan = toolPlan;

        const postAnalysisSummary = await executeToolCalls({
          phase: ORCHESTRATOR_TOOL_PHASES.POST_ANALYSIS,
          calls: toolPlan.post_analysis,
          document: context.document,
          toolingConfig: resolveToolingConfig(context.options)
        });

        context.options.orchestration = attachToolingSummary(
          context.options.orchestration,
          postAnalysisSummary
        );

        if (postAnalysisSummary.requires_human_review) {
          context.addWarning('orchestrator_tools', 'Post-analysis tool requires human review');
          logger.info({
            event: 'post_analysis_human_review_required',
            pipelineId,
            reviewSkips: postAnalysisSummary.skipped.filter(skip =>
              requiresHumanReview(skip.reason)
            ).length
          });
        }

        if (postAnalysisSummary.failPipeline) {
          finalStatus = 'failed';
          context.addError(
            'orchestrator_tools',
            new Error('Post-analysis tool execution failed')
          );
        }
      }

      // Build final result
      let result = this._buildResult(pipeline, context, finalStatus, startTime);

      // Enrich with visual overlays if available
      const enableVisualRag = context.options?.enableVisualRag ?? this.options.enableVisualRag;
      if (enableVisualRag) {
        result = await this._enrichWithVisualOverlays(result, context);
      }

      // Update statistics
      this._updateStats(result);
      if (this.metricsCollector?.recordPipelineCompletion) {
        this.metricsCollector.recordPipelineCompletion(
          pipelineId,
          result.metadata.execution_time_ms
        );
      }

      // Log completion
      logger.info({
        event: 'pipeline_execution_complete',
        pipelineId,
        status: finalStatus,
        executionTimeMs: result.metadata.execution_time_ms,
        stagesExecuted: context.stagesExecuted.length,
        hasVisualData: result.visual?.hasVisualData || false
      });

      return result;
    } catch (unexpectedError) {
      logger.error({
        event: 'pipeline_execution_unexpected_error',
        pipelineId,
        error: unexpectedError.message,
        stack: unexpectedError.stack
      });

      return this._buildErrorResult(pipelineId, unexpectedError, startTime);
    }
  }

  /**
   * Execute a single pipeline stage
   */
  async _executeStage(stage, context, pipeline) {
    const stageStart = Date.now();

    logger.debug({
      event: 'stage_execution_start',
      pipelineId: pipeline ? pipeline.id : undefined,
      stageId: stage.id,
      stageName: stage.name,
      executionMode: stage.executionMode
    });

    // Check execution conditions
    if (stage.executionMode === ExecutionMode.CONDITIONAL) {
      if (!ConditionEvaluator.evaluate(stage.condition, context)) {
        context.skipStage(stage.id, 'Condition not met');
        logger.debug(`Skipping stage ${stage.id}: condition not met`);
        this._recordStageLatency(stage, Date.now() - stageStart);
        return { status: 'skipped', abort: false };
      }
    }

    if (stage.executionMode === ExecutionMode.FALLBACK) {
      if (!ConditionEvaluator.evaluate(stage.triggerCondition, context)) {
        context.skipStage(stage.id, 'Fallback not triggered');
        logger.debug(`Skipping fallback stage ${stage.id}: trigger condition not met`);
        this._recordStageLatency(stage, Date.now() - stageStart);
        return { status: 'skipped', abort: false };
      }
      context.recoveryAttempts += 1;
    }

    // Validation stages (no LLM call)
    if (stage.type === StageType.VALIDATION) {
      return this._executeValidationStage(stage, context, stageStart);
    }

    // Parallel OCR stages (Phase 2)
    if (stage.type === StageType.TEXT_EXTRACTION && stage.useParallelOcr === true) {
      return this._executeParallelOcrStage(stage, context, stageStart);
    }

    // Visual query generation (Phase 3)
    if (stage.type === StageType.VISUAL_QUERY_GENERATION) {
      return this._executeVisualQueryGenerationStage(stage, context, stageStart);
    }

    // Visual query execution (Phase 4)
    if (stage.type === StageType.VISUAL_QUERY_EXECUTION) {
      return this._executeVisualQueryExecutionStage(stage, context, stageStart);
    }

    // Build input from mappings
    const stageInput = this._buildStageInput(stage.inputMapping, context);

    // Validation-driven retries for extraction stages (Stage 5)
    if (stage.type === StageType.TEXT_EXTRACTION && stage.useParallelOcr !== true) {
      const extractionFn = async () => this._executeLLMStage(stage, stageInput, context);
      const validationResult = await this._executeWithValidation(
        stage,
        context,
        pipeline,
        extractionFn
      );

      const timing = Date.now() - stageStart;

      // Store only the extraction output under the stage key (backwards compatible)
      context.setStageOutput(stage.outputKey, validationResult.output, timing);

      // Also store validation details under a predictable companion key
      context.setStageOutput(`${stage.outputKey}_validation`, validationResult.validation, timing);

      this._recordStageLatency(stage, timing);

      logger.debug({
        event: 'stage_execution_with_validation_complete',
        stageId: stage.id,
        terminalState: validationResult.terminalState,
        attempts: validationResult.attempts,
        timingMs: timing
      });

      const status =
        validationResult.terminalState === 'manual_review_required'
          ? 'error'
          : validationResult.terminalState === 'accepted_with_warnings'
            ? 'warning'
            : 'success';

      return {
        status,
        output: validationResult.output,
        abort: false,
        terminalState: validationResult.terminalState
      };
    }

    // Execute LLM stage with retry logic
    let lastError = null;
    const maxRetries = stage.retryCount || 1;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const output = await this._executeLLMStage(stage, stageInput, context);

        const timing = Date.now() - stageStart;
        context.setStageOutput(stage.outputKey, output, timing);
        this._recordStageLatency(stage, timing);

        logger.debug({
          event: 'stage_execution_complete',
          stageId: stage.id,
          attempt,
          timingMs: timing
        });

        return { status: 'success', output, abort: false };
      } catch (stageError) {
        lastError = stageError;

        logger.warn({
          event: 'stage_execution_retry',
          stageId: stage.id,
          attempt,
          maxRetries,
          retry_scope: 'document',
          retry_reason: stageError.code || 'execution_failed',
          validation_triggered: false,
          error: stageError.message
        });

        logger.info({
          event: 'retry_triggered',
          stage: stage.id,
          reason: stageError.code || 'execution_failed',
          severity: 'high',
          retry_scope: 'document'
        });

        if (this.metricsCollector?.recordRetry) {
          this.metricsCollector.recordRetry({
            pipelineId: pipeline?.id || context?.options?.pipelineId,
            stageName: stage.id,
            reason: stageError.code || 'execution_failed',
            severity: 'high'
          });
        }

        if (attempt < maxRetries) {
          await this._delay(1000 * attempt);
        }
      }
    }

    // All retries failed
    context.addError(stage.id, lastError);
    this._recordStageLatency(stage, Date.now() - stageStart);

    if (stage.type === StageType.TEXT_EXTRACTION && this.metricsCollector?.recordExtractionError) {
      this.metricsCollector.recordExtractionError(stage.id || stage.name);
    }

    logger.error({
      event: 'stage_execution_failed',
      stageId: stage.id,
      retry_scope: 'document',
      retry_reason: 'max_retries_exceeded',
      maxRetries,
      finalError: lastError?.message
    });

    const isFatal =
      stage.type === StageType.CLASSIFICATION || stage.executionMode === ExecutionMode.RECOVERY;

    return {
      status: 'error',
      error: lastError,
      abort: isFatal
    };
  }

  /**
   * Execute an LLM-based stage
   *
   * Uses Guidance service for deterministic extraction when guidanceTemplate is defined.
   * Falls back to direct Ollama calls via PromptRegistry when Guidance is unavailable.
   */
  async _executeLLMStage(stage, input, context) {
    const variables = this._flattenInput(input);

    const textForContext =
      (input && (input.text || input.question || input.body)) ||
      variables.text ||
      context.document?.text ||
      context.document?.ocr_text ||
      Object.values(variables).join(' ');

    // Inject legal context
    if (stage.injectLegalContext) {
      try {
        const legalCtx = await internalLegalRag.retrieve(textForContext);
        if (legalCtx) variables.legal_context = legalCtx;
      } catch (legalError) {
        logger.warn({
          event: 'legal_context_injection_failed',
          stageId: stage.id,
          error: legalError.message
        });
      }
    }

    // Inject VAT context
    if (stage.injectVatContext) {
      try {
        const vatCtx = await internalVatRag.retrieve(textForContext);
        if (vatCtx) variables.vat_context = vatCtx;
      } catch (vatError) {
        logger.warn({
          event: 'vat_context_injection_failed',
          stageId: stage.id,
          error: vatError.message
        });
      }
    }

    const rawDomain =
      context?.classification?.classification?.primary_domain ||
      context?.classification?.domain ||
      context?.classification?.classification?.domain ||
      context?.options?.domain ||
      '';

    const domain = rawDomain ? String(rawDomain).trim().toLowerCase() : null;
    const modelName = stage.model || config.ollama?.model || null;

    const existingTagsRaw =
      context?.options?.existingTags ||
      context?.options?.existing_tags ||
      context?.options?.existingTagNames ||
      context?.options?.existingTagsList ||
      context?.document?.tags ||
      [];

    let existingTags = Array.isArray(existingTagsRaw)
      ? existingTagsRaw
          .map(tag => {
            if (!tag) return null;
            if (typeof tag === 'string') return tag.trim();
            if (typeof tag === 'object' && tag.name) return String(tag.name).trim();
            return null;
          })
          .filter(Boolean)
      : [];

    const existingTagIds = Array.isArray(existingTagsRaw)
      ? existingTagsRaw
          .map(tag => {
            if (typeof tag === 'number' && Number.isFinite(tag)) return tag;
            if (
              tag &&
              typeof tag === 'object' &&
              typeof tag.id === 'number' &&
              Number.isFinite(tag.id)
            ) {
              return tag.id;
            }
            return null;
          })
          .filter(id => typeof id === 'number')
      : [];

    if (existingTags.length === 0 && existingTagIds.length > 0) {
      if (Array.isArray(context._resolvedExistingTagNames)) {
        existingTags = context._resolvedExistingTagNames;
      } else {
        try {
          if (paperlessService.client) {
            const resolved = await Promise.all(
              existingTagIds.map(tagId => paperlessService.getTagTextFromId(tagId))
            );
            existingTags = resolved.filter(Boolean);
            context._resolvedExistingTagNames = existingTags;
          }
        } catch (tagError) {
          logger.warn({
            event: 'existing_tag_resolution_failed',
            stageId: stage.id,
            error: tagError.message
          });
        }
      }
    }

    if (domain && variables.domain === undefined) variables.domain = domain;
    if (existingTags.length > 0 && variables.existing_tags === undefined) {
      variables.existing_tags = existingTags;
    }
    if (modelName && variables.model === undefined) variables.model = modelName;

    // =================================================================
    // GUIDANCE PATH
    // =================================================================
    const orchestration = context?.options?.orchestration || {};

    // If any of these are explicitly set false, treat Guidance as disabled.
    const guidanceEnabled =
      normalizeBoolean(context?.options?.guidanceEnabled, true) &&
      normalizeBoolean(orchestration.use_guidance, true) &&
      normalizeBoolean(orchestration.useGuidance, true);

    const hasGuidanceTemplate = Boolean(stage.guidanceTemplate);

    let guidanceAttempted = false;
    let guidanceSucceeded = false;
    let fallbackReason = null;

    if (hasGuidanceTemplate) {
      let guidanceAvailable = false;

      if (guidanceEnabled) {
        guidanceAvailable = await guidanceClient.isAvailable();
      }

      if (!guidanceEnabled) {
        fallbackReason = 'guidance_disabled';
      } else if (!guidanceAvailable) {
        fallbackReason = 'guidance_unavailable';
      } else {
        const resolvedTemplate = resolveGuidanceTemplateName(stage.guidanceTemplate);

        logger.debug({
          event: 'stage_using_guidance',
          stageId: stage.id,
          template: resolvedTemplate,
          baseTemplate: stage.guidanceTemplate
        });

        guidanceAttempted = true;

        try {
          const streamingThreshold = parseInt(
            process.env.GUIDANCE_STREAMING_THRESHOLD || '2000',
            10
          );
          const tokenCount = calculateTokens(textForContext || '');
          const enableStreaming =
            Number.isFinite(streamingThreshold) && tokenCount > streamingThreshold;

          const isExtractionTemplate =
            resolvedTemplate.includes('extractor') ||
            resolvedTemplate.includes('classifier') ||
            resolvedTemplate.includes('validator');

          const templateTemperature = isExtractionTemplate ? 0.0 : 0.1;

          const guidanceResult = await guidanceClient.generate(resolvedTemplate, variables, {
            model: modelName,
            temperature: templateTemperature,
            stream: enableStreaming
          });

          if (guidanceResult.success) {
            guidanceSucceeded = true;

            logger.info({
              event: 'guidance_extraction_success',
              stageId: stage.id,
              template: resolvedTemplate,
              baseTemplate: stage.guidanceTemplate,
              valid: guidanceResult.validation?.valid,
              source: guidanceResult.source,
              temperature: templateTemperature
            });

            if (this.metricsCollector?.recordGuidanceResult) {
              this.metricsCollector.recordGuidanceResult(stage.id, true);
            }

            return guidanceResult.generated;
          }

          fallbackReason = guidanceResult.error || 'guidance_invalid_output';

          logger.warn({
            event: 'guidance_extraction_fallback',
            stageId: stage.id,
            template: resolvedTemplate,
            baseTemplate: stage.guidanceTemplate,
            error: fallbackReason
          });
        } catch (guidanceError) {
          fallbackReason = guidanceError.message;
          logger.warn({
            event: 'guidance_extraction_fallback',
            stageId: stage.id,
            template: resolveGuidanceTemplateName(stage.guidanceTemplate),
            baseTemplate: stage.guidanceTemplate,
            error: guidanceError.message
          });
        }
      }
    }

    if (guidanceAttempted && !guidanceSucceeded && this.metricsCollector?.recordGuidanceResult) {
      this.metricsCollector.recordGuidanceResult(stage.id, false);
    }

    if (hasGuidanceTemplate && fallbackReason) {
      const pipelineId = context?.options?.pipelineId;

      logger.info({
        event: 'fallback_executed',
        stage: stage.id,
        from: 'guidance',
        to: 'prompt_registry',
        reason: fallbackReason
      });

      if (this.metricsCollector?.recordFallback) {
        this.metricsCollector.recordFallback({
          pipelineId,
          from: 'guidance',
          to: 'prompt_registry',
          reason: fallbackReason
        });
      }
    }

    // =================================================================
    // FALLBACK PATH: PromptRegistry + direct Ollama calls
    // =================================================================
    const promptId =
      stage.promptId ||
      (stage.guidanceTemplate ? getFallbackPromptId(stage.guidanceTemplate) : null);

    if (!promptId) {
      throw new Error(`Stage ${stage.id} has no promptId or guidanceTemplate configured`);
    }

    const prompt = promptRegistry.get(promptId);
    if (prompt.model && stage.model && prompt.model !== stage.model) {
      logger.warn({
        event: 'stage_model_mismatch',
        stageId: stage.id,
        promptId,
        stageModel: stage.model,
        promptModel: prompt.model
      });
    }

    logger.info({
      event: 'prompt_template_selected',
      stage: stage.id,
      promptId,
      promptVersion: prompt.version,
      promptModel: prompt.model,
      stageModel: stage.model,
      modelType: stage.modelType
    });

    // Build image data for multimodal stages (prefer normalized)
    const resolvedImages = resolveDocumentImages(context.document);
    const imageData =
      stage.modelType === ModelType.MULTIMODAL ? input.image || resolvedImages.imageData : null;

    const messages = promptRegistry.buildMessages(promptId, variables, imageData);
    const modelOptions = promptRegistry.getOptions(promptId);

    const timeout = stage.timeout || this.options.defaultTimeout;
    const response = await this._callOllamaWithTimeout(stage.model, messages, modelOptions, timeout);

    return this._parseResponse(response, stage);
  }

  /**
   * Execute a validation stage
   */
  _executeValidationStage(stage, context, stageStart) {
    const validationResult = ValidationEngine.validateLegacy(stage.validationRules, context);

    const timing = Date.now() - stageStart;
    context.setStageOutput(stage.outputKey, validationResult, timing);
    this._recordStageLatency(stage, timing);

    if (!validationResult.valid) {
      for (const issue of validationResult.issues) {
        context.addWarning(stage.id, issue.message);
      }
    }

    return {
      status: validationResult.valid ? 'success' : 'warning',
      output: validationResult,
      abort: false
    };
  }

  /**
   * Execute a parallel OCR stage (Phase 2)
   */
  async _executeParallelOcrStage(stage, context, stageStart) {
    logger.info({
      event: 'parallel_ocr_stage_start',
      stageId: stage.id,
      documentId: context.document?.id || context.document?.filename
    });

    try {
      const document = {
        id: context.document?.id,
        filename: context.document?.filename,
        imageBase64: context.document?.imageBase64,
        imagePath: context.document?.imagePath,
        imageBuffer: context.document?.imageBuffer
      };

      const routerDomain =
        context?.classification?.classification?.primary_domain ||
        context?.classification?.domain ||
        context?.classification?.classification?.domain ||
        null;

      const documentType = routerDomain || context.document?.documentType || 'general';

      const metadata = {
        documentType,
        classification: context.classification,
        ...stage.metadata
      };

      const result = await this.parallelOcrExecutor.execute(document, metadata);
      const timing = Date.now() - stageStart;

      const ocrMetadata = {
        source: result.ocr.source,
        conflict_rate: result.ocr.reconciliation?.conflictRate ?? null,
        latency_ms: timing,
        reconciliation: result.ocr.reconciliation || null,
        visual_elements_available: Boolean(result.visualElements)
      };

      const ocrOutput = {
        text: result.ocr.text,
        source: result.ocr.source,
        confidence: result.ocr.confidence,
        reconciliation: result.ocr.reconciliation,
        visualElements: result.visualElements,
        ocr_metadata: ocrMetadata,
        metadata: {
          ...result.metadata,
          executionTimeMs: timing
        }
      };

      context.setStageOutput(stage.outputKey || 'ocr', ocrOutput, timing);

      if (result.ocr.text) {
        context.document.enhanced_ocr_text = result.ocr.text;
        context.document._ocr_metadata = ocrMetadata;
        if (!context.document.ocr_text) context.document.ocr_text = result.ocr.text;
        if (!context.document.text) context.document.text = result.ocr.text;
      }

      logger.info({
        event: 'parallel_ocr_stage_complete',
        stageId: stage.id,
        documentId: context.document?.id,
        success: result.success,
        ocrSource: result.ocr.source,
        tracksSucceeded: result.metadata.tracksSucceeded,
        executionTimeMs: timing
      });

      this._recordStageLatency(stage, timing);

      return {
        status: result.success ? 'success' : 'partial',
        output: ocrOutput,
        abort: false
      };
    } catch (error) {
      const timing = Date.now() - stageStart;
      this._recordStageLatency(stage, timing);

      logger.error({
        event: 'parallel_ocr_stage_failed',
        stageId: stage.id,
        documentId: context.document?.id,
        error: error.message,
        executionTimeMs: timing
      });

      context.addError(stage.id, error);

      // Graceful degradation: try to use existing OCR if available
      if (context.document?.content || context.document?.ocr_text) {
        const fallbackText = context.document.content || context.document.ocr_text;

        logger.warn({
          event: 'parallel_ocr_fallback_to_existing',
          stageId: stage.id,
          documentId: context.document?.id,
          fallbackSource: 'existing_ocr'
        });

        const fallbackOutput = {
          text: fallbackText,
          source: 'fallback-existing',
          confidence: 0.5,
          ocr_metadata: {
            source: 'fallback-existing',
            conflict_rate: null,
            latency_ms: timing,
            reconciliation: null,
            visual_elements_available: false
          },
          metadata: {
            fallback: true,
            originalError: error.message
          }
        };

        context.setStageOutput(stage.outputKey || 'ocr', fallbackOutput, timing);
        context.document.enhanced_ocr_text = fallbackText;
        context.document._ocr_metadata = fallbackOutput.ocr_metadata;
        if (!context.document.ocr_text) context.document.ocr_text = fallbackText;
        if (!context.document.text) context.document.text = fallbackText;

        return {
          status: 'warning',
          output: fallbackOutput,
          abort: false
        };
      }

      return {
        status: 'error',
        error,
        abort: false
      };
    }
  }

  /**
   * Execute a visual query generation stage (Phase 3)
   */
  async _executeVisualQueryGenerationStage(stage, context, stageStart) {
    logger.info({
      event: 'visual_query_generation_stage_start',
      stageId: stage.id,
      documentId: context.document?.id || context.document?.filename
    });

    const orchestration = context?.options?.orchestration || {};
    const enableVisualRag = context?.options?.enableVisualRag ?? this.options.enableVisualRag;

    const allowQueryGeneration =
      normalizeBoolean(orchestration.use_visual_query_generation, true) &&
      normalizeBoolean(orchestration.useVisualQueryGeneration, true);

    const allowVisualRetrieval =
      normalizeBoolean(orchestration.use_visual_rag_retrieval, true) &&
      normalizeBoolean(orchestration.useVisualRagRetrieval, true);

    const buildFallbackOutput = (reason, error = null) => {
      const timing = Date.now() - stageStart;
      const fallbackOutput = {
        queries: [],
        metadata: {
          total_queries_generated: 0,
          success_rate: 0,
          fields_targeted: [],
          missing_fields: [],
          low_confidence_fields: [],
          fallback: true,
          skip_reason: reason,
          error: error?.message
        },
        executionTimeMs: timing
      };

      context.setStageOutput(stage.outputKey || 'visual_queries', fallbackOutput, timing);
      this._recordStageLatency(stage, timing);

      return { output: fallbackOutput, timing };
    };

    if (!enableVisualRag || !allowQueryGeneration || !allowVisualRetrieval) {
      const skipReason = !enableVisualRag
        ? 'visual_rag_disabled'
        : !allowQueryGeneration
          ? 'visual_query_generation_disabled'
          : 'visual_rag_retrieval_disabled';

      context.skipStage(stage.id, skipReason);
      const { output } = buildFallbackOutput(skipReason);

      logger.info({
        event: 'visual_query_generation_skipped',
        stageId: stage.id,
        documentId: context.document?.id,
        reason: skipReason
      });

      return { status: 'skipped', output, abort: false };
    }

    try {
      const { visualQueryGenerator } = require('./VisualQueryGenerator');

      if (typeof context.visualSidecarAvailable !== 'boolean') {
        const { VisualSearchClient } = require('../visual-rag-client/VisualSearchClient');
        const visualSearchClient = new VisualSearchClient();
        context.visualSidecarAvailable = await visualSearchClient.isAvailable();
      }

      if (!context.visualSidecarAvailable) {
        const { output } = buildFallbackOutput('visual_sidecar_unavailable');
        context.skipStage(stage.id, 'visual_sidecar_unavailable');

        logger.warn({
          event: 'visual_query_generation_sidecar_unavailable',
          stageId: stage.id,
          documentId: context.document?.id
        });

        return { status: 'skipped', output, abort: false };
      }

      const stageInput = this._buildStageInput(stage.inputMapping, context);

      const extractionResults =
        stageInput.extraction ||
        context.getStageOutput('extraction') ||
        context.getStageOutput('general_extraction') ||
        context.getStageOutput('text_extraction') ||
        {};

      const ocrResults =
        stageInput.ocr ||
        context.getStageOutput('ocr') || {
          text: context.document?.ocr_text || context.document?.text || '',
          source: 'fallback'
        };

      const visualElements = ocrResults.visualElements || context.getStageOutput('ocr')?.visualElements || [];

      let fieldTaxonomy = null;
      try {
        if (paperlessService && typeof paperlessService.getFieldTaxonomy === 'function') {
          fieldTaxonomy = await paperlessService.getFieldTaxonomy();
        }
      } catch (taxonomyError) {
        logger.warn({
          event: 'field_taxonomy_unavailable',
          stageId: stage.id,
          reason: taxonomyError.message
        });
      }

      const documentMetadata = {
        id: context.document?.id,
        filename: context.document?.filename,
        documentType:
          context.getStageOutput('classification')?.primary_domain ||
          context.document?.documentType ||
          'general'
      };

      const allowedFields = new Set();
      const taxonomyFields = Array.isArray(fieldTaxonomy?.fields) ? fieldTaxonomy.fields : [];

      for (const field of taxonomyFields) {
        if (typeof field === 'string' && field) allowedFields.add(field);
      }

      if (Array.isArray(extractionResults.fields)) {
        for (const field of extractionResults.fields) {
          if (field?.name) allowedFields.add(field.name);
        }
      }

      if (Array.isArray(visualQueryGenerator?.config?.fallbackFieldSet)) {
        for (const field of visualQueryGenerator.config.fallbackFieldSet) {
          if (field) allowedFields.add(field);
        }
      }

      const hasAllowedFields = allowedFields.size > 0;

      const normalizeFloat = (value, fallback) => {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(1, Math.max(0, parsed));
      };

      const normalizeQueries = async (rawQueries, sourceLabel) => {
        const allowedTypes = new Set(['field_extraction', 'validation', 'exploration']);

        const normalized = (Array.isArray(rawQueries) ? rawQueries : [])
          .map(query => {
            if (!query || typeof query !== 'object') return null;

            const question = typeof query.question === 'string' ? query.question.trim() : '';
            const fieldTarget = typeof query.field_target === 'string' ? query.field_target.trim() : '';
            if (!question || !fieldTarget) return null;

            if (hasAllowedFields && !allowedFields.has(fieldTarget)) return null;

            const expectedType = allowedTypes.has(query.expected_element_type)
              ? query.expected_element_type
              : 'field_extraction';

            return {
              question,
              field_target: fieldTarget,
              expected_element_type: expectedType,
              priority: normalizeFloat(query.priority, 0.5),
              confidence: normalizeFloat(query.confidence, 0.6),
              rarity_factor: normalizeFloat(query.rarity_factor, 0.5),
              source: sourceLabel
            };
          })
          .filter(Boolean);

        const minQueries = visualQueryGenerator.config?.minQueriesPerDocument || 3;
        if (normalized.length >= minQueries) return normalized;

        const fallback = await visualQueryGenerator.generateQueries({
          extractionResults,
          ocrResults,
          fieldTaxonomy,
          documentMetadata
        });

        const supplemental = Array.isArray(fallback.visual_queries) ? fallback.visual_queries : [];
        const seenTargets = new Set(normalized.map(q => q.field_target));
        const allowDuplicates = hasAllowedFields && seenTargets.size >= allowedFields.size;

        let index = 0;
        while (normalized.length < minQueries && supplemental.length > 0) {
          const candidate = supplemental[index % supplemental.length];
          index += 1;
          if (!candidate) continue;
          if (!allowDuplicates && seenTargets.has(candidate.field_target)) continue;

          normalized.push({
            question: candidate.question,
            field_target: candidate.field_target,
            expected_element_type: candidate.expected_element_type || 'field_extraction',
            priority: normalizeFloat(candidate.priority, 0.5),
            confidence: normalizeFloat(candidate.confidence, 0.6),
            rarity_factor: normalizeFloat(candidate.rarity_factor, 0.5),
            source: 'heuristic'
          });

          seenTargets.add(candidate.field_target);
        }

        return normalized;
      };

      const guidanceEnabled =
        normalizeBoolean(context?.options?.guidanceEnabled, true) &&
        normalizeBoolean(orchestration.use_guidance, true) &&
        normalizeBoolean(orchestration.useGuidance, true);

      let generated = null;
      let source = 'heuristic';

      const documentDomain = String(documentMetadata.documentType || '').toLowerCase();
      let resolvedTemplate = stage.guidanceTemplate || null;

      if (
        resolvedTemplate === 'visual_query_generator_de' &&
        ['financial', 'medical', 'legal'].includes(documentDomain)
      ) {
        resolvedTemplate = `${documentDomain}_visual_query_generator_de`;
      }
      resolvedTemplate = resolveGuidanceTemplateName(resolvedTemplate);

      if (resolvedTemplate && guidanceEnabled && (await guidanceClient.isAvailable())) {
        const vars = {
          extraction_result: extractionResults,
          ocr_text: ocrResults.text || '',
          field_schema: fieldTaxonomy || {},
          visual_elements: visualElements,
          document_metadata: documentMetadata,
          document_type: documentMetadata.documentType,
          document_id: documentMetadata.id,
          filename: documentMetadata.filename
        };

        try {
          const guidanceResult = await guidanceClient.generate(resolvedTemplate, vars, {
            model: stage.model,
            temperature: 0.0
          });

          if (guidanceResult.success && guidanceResult.validation?.valid) {
            generated = guidanceResult.generated;
            source = guidanceResult.source || 'guidance';
          } else {
            logger.warn({
              event: 'visual_query_generation_guidance_invalid',
              stageId: stage.id,
              template: resolvedTemplate,
              valid: guidanceResult.validation?.valid,
              errors: guidanceResult.validation?.errors?.slice(0, 3)
            });
          }
        } catch (guidanceError) {
          logger.warn({
            event: 'visual_query_generation_guidance_failed',
            stageId: stage.id,
            template: resolvedTemplate,
            error: guidanceError.message
          });
        }
      }

      if (!generated) {
        const promptId =
          stage.promptId || (stage.guidanceTemplate ? getFallbackPromptId(stage.guidanceTemplate) : null);

        if (promptId && typeof promptRegistry.has === 'function' && promptRegistry.has(promptId)) {
          const promptVariables = {
            extraction_result: JSON.stringify(extractionResults || {}),
            ocr_text: ocrResults.text || '',
            field_schema: JSON.stringify(fieldTaxonomy || {}),
            visual_elements: JSON.stringify(visualElements || [])
          };

          try {
            const messages = promptRegistry.buildMessages(promptId, promptVariables);
            const opts = promptRegistry.getOptions(promptId);
            const timeout = stage.timeout || this.options.defaultTimeout;

            const response = await this._callOllamaWithTimeout(stage.model, messages, opts, timeout);
            generated = await this._parseResponse(response, stage);
            source = 'prompt';
          } catch (promptError) {
            logger.warn({
              event: 'visual_query_generation_prompt_failed',
              stageId: stage.id,
              promptId,
              error: promptError.message
            });
          }
        }
      }

      let normalizedQueries = [];
      if (generated) {
        const rawQueries = Array.isArray(generated.queries)
          ? generated.queries
          : Array.isArray(generated.visual_queries)
            ? generated.visual_queries
            : [];
        normalizedQueries = await normalizeQueries(rawQueries, source);
      }

      if (normalizedQueries.length === 0) {
        const fallbackResult = await visualQueryGenerator.generateQueries({
          extractionResults,
          ocrResults,
          fieldTaxonomy,
          documentMetadata
        });
        normalizedQueries = fallbackResult.visual_queries;
        source = 'heuristic';
      }

      const timing = Date.now() - stageStart;
      const queryOutput = {
        queries: normalizedQueries,
        metadata: {
          total_queries_generated: normalizedQueries.length,
          success_rate: normalizedQueries.length > 0 ? 1 : 0,
          fields_targeted: normalizedQueries.map(q => q.field_target),
          source
        },
        executionTimeMs: timing
      };

      context.setStageOutput(stage.outputKey || 'visual_queries', queryOutput, timing);
      this._recordStageLatency(stage, timing);

      logger.info({
        event: 'visual_query_generation_stage_complete',
        stageId: stage.id,
        documentId: context.document?.id,
        queriesGenerated: normalizedQueries.length,
        generationSource: source,
        executionTimeMs: timing
      });

      return {
        status: 'success',
        output: queryOutput,
        abort: false
      };
    } catch (error) {
      const timing = Date.now() - stageStart;
      this._recordStageLatency(stage, timing);

      logger.error({
        event: 'visual_query_generation_stage_failed',
        stageId: stage.id,
        documentId: context.document?.id,
        error: error.message,
        stack: error.stack,
        executionTimeMs: timing
      });

      context.addError(stage.id, error);

      const { output } = buildFallbackOutput('generation_failed', error);

      logger.warn({
        event: 'visual_query_generation_fallback',
        stageId: stage.id,
        documentId: context.document?.id,
        message: 'Continuing with extraction-only results (no visual queries)'
      });

      return {
        status: 'warning',
        output,
        abort: false
      };
    }
  }

  /**
   * Execute a visual query execution stage (Phase 4)
   */
  async _executeVisualQueryExecutionStage(stage, context, stageStart) {
    logger.info({
      event: 'visual_query_execution_stage_start',
      stageId: stage.id,
      documentId: context.document?.id || context.document?.filename
    });

    const orchestration = context?.options?.orchestration || {};
    const enableVisualRag = context?.options?.enableVisualRag ?? this.options.enableVisualRag;

    const allowVisualValidation =
      normalizeBoolean(orchestration.use_visual_validation, true) &&
      normalizeBoolean(orchestration.useVisualValidation, true);

    const allowVisualRetrieval =
      normalizeBoolean(orchestration.use_visual_rag_retrieval, true) &&
      normalizeBoolean(orchestration.useVisualRagRetrieval, true);

    const extractionResults =
      context.getStageOutput('extraction') ||
      context.getStageOutput('general_extraction') ||
      context.getStageOutput('text_extraction') ||
      {};

    const buildFallbackOutput = (reason, error = null, extraMetadata = {}) => {
      const timing = Date.now() - stageStart;
      const fallbackOutput = {
        fields: (extractionResults.fields || []).map(f => ({
          ...f,
          visual_confirmation: false
        })),
        newly_discovered_fields: [],
        overlays: [],
        metadata: {
          total_queries_executed: 0,
          successful_queries: 0,
          failed_queries: 0,
          timeout_queries: 0,
          fallback: true,
          fallback_reason: reason,
          error: error?.message,
          ...extraMetadata
        },
        executionTimeMs: timing
      };

      context.setStageOutput(stage.outputKey || 'visual_execution', fallbackOutput, timing);
      this._recordStageLatency(stage, timing);

      return { output: fallbackOutput, timing };
    };

    if (!enableVisualRag || !allowVisualValidation || !allowVisualRetrieval) {
      const skipReason = !enableVisualRag
        ? 'visual_rag_disabled'
        : !allowVisualValidation
          ? 'visual_validation_disabled'
          : 'visual_rag_retrieval_disabled';

      context.skipStage(stage.id, skipReason);
      const { output } = buildFallbackOutput(skipReason);

      logger.info({
        event: 'visual_query_execution_skipped',
        stageId: stage.id,
        documentId: context.document?.id,
        reason: skipReason
      });

      return { status: 'skipped', output, abort: false };
    }

    try {
      const { VisualQueryExecutor } = require('./VisualQueryExecutor');
      const queryOutput = context.getStageOutput('visual_queries');
      const visualQueries = queryOutput?.queries || [];

      const fallbackReason = 'visual_503_fallback_text';

      if (!visualQueries || visualQueries.length === 0) {
        const { output } = buildFallbackOutput('no_queries');
        context.skipStage(stage.id, 'no_queries');
        logger.info({
          event: 'visual_query_execution_skipped',
          stageId: stage.id,
          documentId: context.document?.id,
          reason: 'no_queries'
        });
        return { status: 'skipped', output, abort: false };
      }

      const documentImage =
        context.document?.imageBase64 || context.document?.imageBuffer || context.document?.imagePath;

      const documentMetadata = {
        id: context.document?.id,
        filename: context.document?.filename,
        documentType:
          context.getStageOutput('classification')?.primary_domain ||
          context.document?.documentType ||
          'general'
      };

      const adjustTextFallbackFields = (fields = []) => fields.map(field => {
        const next = { ...field, visual_confirmation: false };
        if (Number.isFinite(next.confidence)) {
          next.confidence = Math.max(0, Math.min(1, next.confidence * 0.9));
          next.confidence_adjusted = true;
        }
        return next;
      });

      const executeTextFallback = async (reason, visualError = null) => {
        const ragService = this._getRagService();
        let status = null;
        try {
          status = await ragService.checkStatus();
        } catch (statusError) {
          status = { server_up: false, error: statusError.message };
        }

        const textAvailable = Boolean(
          status &&
          status.server_up &&
          (status.index_ready || status.data_loaded) &&
          !status.disabled
        );

        if (!textAvailable) {
          const textError = new Error(
            status?.error || 'Text RAG unavailable'
          );
          textError.code = status?.disabled ? 'RAG_DISABLED' : 'TEXT_RAG_UNAVAILABLE';
          context.addError(stage.id, textError);

          const { output } = buildFallbackOutput(reason, textError, {
            evidence_source: 'none',
            manual_review_required: true,
            text_status: status,
            text_fallback_unavailable: true,
            text_fallback_error: textError.message
          });
          output.fields = adjustTextFallbackFields(extractionResults.fields || []);

          logger.error({
            event: 'visual_text_fallback_unavailable',
            stageId: stage.id,
            documentId: context.document?.id,
            reason,
            error: textError.message
          });

          return { status: 'error', output, abort: false };
        }

        const requestId = context?.options?.requestId;
        const textEvidence = await Promise.all(visualQueries.map(async query => {
          try {
            const results = await ragService.search(query.question, { requestId });
            const matches = Array.isArray(results)
              ? results.filter(result =>
                String(result.doc_id || '') === String(documentMetadata.id || '')
              )
              : [];
            return {
              field_target: query.field_target,
              question: query.question,
              matches: matches.slice(0, 3)
            };
          } catch (searchError) {
            return {
              field_target: query.field_target,
              question: query.question,
              matches: [],
              error: searchError.message
            };
          }
        }));

        const { output } = buildFallbackOutput(reason, visualError, {
          evidence_source: 'text',
          manual_review_required: true,
          text_status: status,
          text_evidence: textEvidence
        });
        output.fields = adjustTextFallbackFields(extractionResults.fields || []);

        if (this.metricsCollector?.recordFallback) {
          this.metricsCollector.recordFallback({
            pipelineId: context.options?.pipelineId,
            from: 'visual',
            to: 'text',
            reason
          });
        }

        logger.warn({
          event: 'visual_query_execution_text_fallback',
          stageId: stage.id,
          documentId: context.document?.id,
          reason,
          textEvidenceCount: textEvidence.length
        });

        return { status: 'warning', output, abort: false };
      };

      const visualSearchClient = this._getVisualSearchClient();
      if (typeof context.visualSidecarAvailable !== 'boolean') {
        try {
          context.visualSidecarAvailable = await visualSearchClient.isAvailable();
        } catch (availabilityError) {
          context.visualSidecarAvailable = false;
          logger.warn({
            event: 'visual_sidecar_availability_check_failed',
            stageId: stage.id,
            documentId: context.document?.id,
            error: availabilityError.message
          });
        }
      }

      if (!context.visualSidecarAvailable) {
        return await executeTextFallback(fallbackReason, new Error('Visual sidecar unavailable'));
      }

      if (!documentImage) {
        const { output } = buildFallbackOutput('no_image');
        context.skipStage(stage.id, 'no_image');
        logger.info({
          event: 'visual_query_execution_skipped',
          stageId: stage.id,
          documentId: context.document?.id,
          reason: 'no_image'
        });
        return { status: 'skipped', output, abort: false };
      }

      this._initVisualRag();

      const executor = new VisualQueryExecutor(visualSearchClient, this._visualOverlayRepository, {
        ...(stage.executorConfig || {}),
        metricsCollector: this.metricsCollector
      });

      const result = await executor.executeQueries({
        visualQueries,
        extractionResults,
        documentMetadata,
        documentImage
      });

      const shouldFallbackToText = (metadata) => {
        if (!metadata?.fallback) {
          return false;
        }
        if (metadata.fallback_reason === 'circuit_breaker_open') {
          return true;
        }
        if (metadata.error_status === 503) {
          return true;
        }
        if (metadata.error_type === 'SIDECAR_INITIALIZING') {
          return true;
        }
        return false;
      };

      if (shouldFallbackToText(result.execution_metadata)) {
        const fallbackError = result.execution_metadata?.error
          ? new Error(result.execution_metadata.error)
          : new Error('Visual query execution unavailable');
        return await executeTextFallback(fallbackReason, fallbackError);
      }

      const timing = Date.now() - stageStart;

      const executionOutput = {
        fields: result.fields,
        newly_discovered_fields: result.newly_discovered_fields,
        overlays: result.overlays,
        metadata: result.execution_metadata,
        executionTimeMs: timing
      };

      context.setStageOutput(stage.outputKey || 'visual_execution', executionOutput, timing);
      this._recordStageLatency(stage, timing);

      if (result.fields && result.fields.length > 0) {
        context.document.fields = result.fields;
      }

      logger.info({
        event: 'visual_query_execution_stage_complete',
        stageId: stage.id,
        documentId: context.document?.id,
        fieldsCount: result.fields.length,
        newlyDiscoveredCount: result.newly_discovered_fields.length,
        visualConfirmationRate: result.execution_metadata.visual_confirmation_rate,
        executionTimeMs: timing
      });

      return {
        status: 'success',
        output: executionOutput,
        abort: false
      };
    } catch (error) {
      const timing = Date.now() - stageStart;
      this._recordStageLatency(stage, timing);

      if (this.metricsCollector?.recordIntegrationError) {
        this.metricsCollector.recordIntegrationError(stage.id || stage.name);
      }

      logger.error({
        event: 'visual_query_execution_stage_failed',
        stageId: stage.id,
        documentId: context.document?.id,
        error: error.message,
        stack: error.stack,
        executionTimeMs: timing
      });

      context.addError(stage.id, error);

      const { output } = buildFallbackOutput('execution_failed', error);

      logger.warn({
        event: 'visual_query_execution_fallback',
        stageId: stage.id,
        documentId: context.document?.id,
        message: 'Continuing with extraction-only results (no visual execution)'
      });

      return {
        status: 'warning',
        output,
        abort: false
      };
    }
  }

  _recordStageLatency(stage, timing) {
    if (!this.options.enableMetrics) return;
    if (!this.metricsCollector || typeof this.metricsCollector.recordStageLatency !== 'function') {
      return;
    }

    this.metricsCollector.recordStageLatency(
      stage.id || stage.name || 'unknown',
      stage.type || 'unknown',
      timing
    );
  }

  /**
   * Build input object from input mappings
   */
  _buildStageInput(inputMapping, context) {
    const input = {};
    for (const [key, path] of Object.entries(inputMapping || {})) {
      input[key] = context.resolvePath(path);
    }
    return input;
  }

  /**
   * Flatten nested input for template variable substitution
   */
  _flattenInput(input, prefix = '') {
    const result = {};

    for (const [key, value] of Object.entries(input || {})) {
      const fullKey = prefix ? `${prefix}_${key}` : key;

      if (value === null || value === undefined) {
        result[fullKey] = 'N/A';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this._flattenInput(value, fullKey));
        result[fullKey] = JSON.stringify(value);
      } else if (Array.isArray(value)) {
        result[fullKey] = JSON.stringify(value);
      } else {
        result[fullKey] = String(value);
      }
    }

    return result;
  }

  _extractTextResponse(response) {
    if (typeof response?.message?.content === 'string') return response.message.content;
    if (typeof response?.response === 'string') return response.response;
    if (typeof response === 'string') return response;
    return '';
  }

  async _summarizeTextForExtraction(text, options = {}) {
    if (!text || typeof text !== 'string') return '';

    const summaryConfig = options || {};
    const maxInputTokens = parseInt(summaryConfig.maxInputTokens || 4000, 10);
    const maxSummaryTokens = parseInt(summaryConfig.maxSummaryTokens || 512, 10);
    const temperature = summaryConfig.temperature ?? 0.1;
    const timeout = summaryConfig.timeout || 60000;
    const model = summaryConfig.model || config.ollama?.model || MODEL_NAMES.general;

    const trimmedText = truncateToTokenLimit(text, maxInputTokens);
    if (trimmedText.length < text.length) {
      truncationMetrics.recordPromptTruncation('expert', model);
    }

    const messages = [
      {
        role: 'system',
        content:
          'Summarize the document for downstream extraction. Preserve key entities, dates, amounts, and terms. Return plain text only.'
      },
      { role: 'user', content: trimmedText }
    ];

    try {
      const response = await this._callOllamaWithTimeout(
        model,
        messages,
        { temperature, num_predict: maxSummaryTokens },
        timeout
      );

      return this._extractTextResponse(response).trim();
    } catch (summaryError) {
      logger.warn('[ExpertPipelineExecutor] Summary fallback failed', { error: summaryError.message });
      return '';
    }
  }

  /**
   * Call Ollama API with timeout
   */
  async _callOllamaWithTimeout(model, messages, options, timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`LLM call timed out after ${timeout}ms`)), timeout);
    });

    const llmPromise = this._callOllama(model, messages, options);
    return Promise.race([llmPromise, timeoutPromise]);
  }

  /**
   * Call Ollama API (integrates with existing ollamaService pattern in the codebase)
   */
  async _callOllama(model, messages, options) {
    const resolvedOptions = this._applyOllamaLimits(model, messages, options);
    truncationMetrics.recordRequest('expert', model);

    if (this.ollamaService && typeof this.ollamaService.chat === 'function') {
      const response = await this.ollamaService.chat({
        model,
        messages,
        options: resolvedOptions,
        stream: false
      });

      const doneReason = response?.done_reason;
      const evalCount = response?.eval_count;

      if (
        doneReason === 'length' ||
        (Number.isFinite(evalCount) &&
          Number.isFinite(resolvedOptions?.num_predict) &&
          evalCount >= resolvedOptions.num_predict)
      ) {
        truncationMetrics.recordResponseTruncation('expert', model);
      }

      return response;
    }

    // Fallback: Direct HTTP call to Ollama
    const ollamaHost = config.ollama?.apiUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
    const response = await axios.post(`${ollamaHost}/api/chat`, {
      model,
      messages,
      options: resolvedOptions,
      stream: false
    });

    const result = response.data;

    const doneReason = result?.done_reason;
    const evalCount = result?.eval_count;

    if (
      doneReason === 'length' ||
      (Number.isFinite(evalCount) &&
        Number.isFinite(resolvedOptions?.num_predict) &&
        evalCount >= resolvedOptions.num_predict)
    ) {
      truncationMetrics.recordResponseTruncation('expert', model);
    }

    return result;
  }

  _applyOllamaLimits(model, messages, options = {}) {
    const resolved = this.ollamaService?._resolveOllamaLimits
      ? this.ollamaService._resolveOllamaLimits('expert', model)
      : { contextWindow: null, maxResponseTokens: null };

    const contextWindow = Number.isFinite(resolved.contextWindow)
      ? resolved.contextWindow
      : config.ollama?.limits?.text?.contextWindow;

    if (resolved.source === 'model_limits') {
      logger.info({
        event: 'model_limits_applied',
        stage: 'expert',
        model,
        contextWindow: resolved.contextWindow,
        maxResponseTokens: resolved.maxResponseTokens,
        modelKey: resolved.modelKey
      });
    }

    let responseTokens = Number.isFinite(resolved.maxResponseTokens)
      ? resolved.maxResponseTokens
      : options.num_predict;

    if (!Number.isFinite(responseTokens)) {
      responseTokens = config.ollama?.limits?.text?.maxResponseTokens || 0;
    }

    const messageTokens = Array.isArray(messages)
      ? messages.reduce((sum, msg) => sum + calculateTokens(msg?.content || ''), 0)
      : 0;

    const imageCount = Array.isArray(messages)
      ? messages.reduce((sum, msg) => sum + (Array.isArray(msg?.images) ? msg.images.length : 0), 0)
      : 0;

    const imageTokenOverhead = config.ollama?.limits?.imageTokenOverhead || 1024;
    const totalInputTokens = messageTokens + imageCount * imageTokenOverhead;

    const effectiveContextWindow = this.ollamaService?._getEffectiveContextWindow
      ? this.ollamaService._getEffectiveContextWindow(contextWindow)
      : contextWindow;

    const maxInputTokens = Math.max(0, (effectiveContextWindow || 0) - responseTokens);

    if (Number.isFinite(effectiveContextWindow) && totalInputTokens > maxInputTokens) {
      const availableResponseTokens = Math.max(0, effectiveContextWindow - totalInputTokens);
      if (availableResponseTokens < responseTokens) {
        logger.warn({
          event: 'prompt_truncated',
          stage: 'expert',
          model,
          reason: 'context_window',
          totalInputTokens,
          maxInputTokens,
          responseTokens,
          adjustedResponseTokens: availableResponseTokens,
          contextWindow,
          effectiveContextWindow,
          limitsSource: resolved.source,
          modelKey: resolved.modelKey
        });

        truncationMetrics.recordPromptTruncation('expert', model);
        responseTokens = availableResponseTokens;
      }
    }

    const numCtx = this.ollamaService?._calculateNumCtx
      ? this.ollamaService._calculateNumCtx(totalInputTokens, responseTokens, contextWindow)
      : effectiveContextWindow;

    return {
      ...options,
      num_predict: responseTokens,
      num_ctx: numCtx
    };
  }

  /**
   * Parse LLM response, attempting JSON extraction using JsonRepairService
   */
  async _parseResponse(response, stage) {
    const content =
      typeof response === 'string'
        ? response
        : response?.message?.content || response?.response || '';

    try {
      const extracted = await this.jsonRepairService.extractWithRepair(content);

      if (extracted && (typeof extracted === 'object' || Array.isArray(extracted))) {
        return {
          ...extracted,
          _meta: {
            parsed: true,
            stageId: stage.id,
            model: stage.model,
            rawLength: content.length
          }
        };
      }

      if (typeof extracted === 'string') {
        try {
          const parsed = JSON.parse(extracted);
          return {
            ...parsed,
            _meta: {
              parsed: true,
              stageId: stage.id,
              model: stage.model,
              rawLength: content.length
            }
          };
        } catch (jsonParseError) {
          logger.debug({
            event: 'response_json_parse_failed',
            stageId: stage.id,
            error: jsonParseError.message
          });
        }
      }

      logger.warn({
        event: 'response_parse_warning',
        stageId: stage.id,
        error: 'no_json_extracted'
      });

      return {
        _meta: {
          parsed: false,
          parseError: 'no_json_extracted',
          stageId: stage.id,
          model: stage.model
        },
        raw_content: content,
        extraction_failed: true
      };
    } catch (parseError) {
      logger.warn({
        event: 'response_parse_warning',
        stageId: stage.id,
        error: parseError.message
      });

      return {
        _meta: {
          parsed: false,
          parseError: parseError.message,
          stageId: stage.id,
          model: stage.model
        },
        raw_content: content,
        extraction_failed: true
      };
    }
  }

  /**
   * Build final pipeline result
   */
  _buildResult(pipeline, context, status, startTime) {
    const executionTimeMs = Date.now() - startTime;

    const integratedOutput =
      context.getStageOutput('integrated_record') ||
      context.getStageOutput('financial_extraction') ||
      context.getStageOutput('legal_extraction') ||
      context.getStageOutput('general_extraction') ||
      context.getStageOutput('medical_extraction');

    const advisoryReasoning = context.getStageOutput('financial_reasoning');
    if (advisoryReasoning) {
      logger.debug({
        event: 'advisory_reasoning_available',
        suggested_corrections: advisoryReasoning.suggested_corrections || null,
        consistency_checks: advisoryReasoning.consistency_checks || null,
        advisory_only: true
      });
    }

    let overallConfidence = 0;
    if (integratedOutput?.confidence_summary?.overall_confidence) {
      overallConfidence = integratedOutput.confidence_summary.overall_confidence;
    } else if (integratedOutput?.confidence?.overall) {
      overallConfidence = integratedOutput.confidence.overall;
    }

    const pipelineId = pipeline?.id || context?.options?.pipelineId || 'unknown';
    const pipelineName = pipeline?.name || 'unknown';
    const pipelineVersion = pipeline?.version || 'unknown';
    const confidenceThreshold = pipeline?.confidenceThreshold ?? 0;

    const result = {
      success: status === 'success',
      pipeline_id: pipelineId,
      pipeline_name: pipelineName,
      pipeline_version: pipelineVersion,
      status,

      result: {
        outputs: context.getAllOutputs(),
        primary_output: integratedOutput,
        classification: context.classification
      },

      metadata: {
        execution_time_ms: executionTimeMs,
        stages_executed: context.stagesExecuted,
        stages_skipped: context.stagesSkipped.map(s => s.stageId),
        stage_timings: Object.fromEntries(context.stageTimings),
        confidence: overallConfidence,
        recovery_attempts: context.recoveryAttempts,
        orchestration: context.options?.orchestration || null
      },

      quality: {
        error_count: context.errors.length,
        warning_count: context.warnings.length,
        errors: context.errors,
        warnings: context.warnings,
        requires_human_review:
          status !== 'success' ||
          overallConfidence < confidenceThreshold ||
          Boolean(context.options?.orchestration?.tooling?.requires_human_review)
      },

      document_info: {
        id: context.document.id,
        filename: context.document.filename,
        source: context.document.source
      },

      timestamp: new Date().toISOString()
    };

    if (advisoryReasoning) {
      result.metadata.advisory_reasoning = {
        suggested_corrections: advisoryReasoning.suggested_corrections || [],
        consistency_checks: advisoryReasoning.consistency_checks || [],
        source: 'FIN_REASONER_V1',
        note: 'Advisory only - not applied automatically'
      };
    }

    return result;
  }

  /**
   * Build error result when pipeline fails to start
   */
  _buildErrorResult(pipelineId, error, startTime) {
    this.stats.failedExecutions += 1;

    return {
      success: false,
      error: error.message,
      pipeline_id: pipelineId,
      status: 'failed',
      result: null,
      metadata: {
        execution_time_ms: Date.now() - startTime,
        stages_executed: [],
        stages_skipped: []
      },
      quality: {
        error_count: 1,
        errors: [
          {
            stageId: 'initialization',
            error: error.message,
            timestamp: Date.now()
          }
        ],
        requires_human_review: true
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get visual overlays for a document from PostgreSQL
   * @param {number} docId - Paperless document ID
   * @returns {Promise<Array<Object>>} Array of overlay objects
   */
  async getVisualOverlays(docId) {
    this._initVisualRag();

    if (!this._visualOverlayRepository) return [];

    try {
      const available = await this._visualOverlayRepository.isAvailable();
      if (!available) return [];
      return await this._visualOverlayRepository.getByDocId(docId);
    } catch (overlayError) {
      logger.warn({
        event: 'visual_overlay_fetch_failed',
        docId,
        error: overlayError.message
      });
      return [];
    }
  }

  /**
   * Ingest a document into the Visual RAG system (dual-path)
   */
  async ingestDocument(docId, pdfPath, options = {}) {
    this._initVisualRag();

    if (!this._ingestionManager) {
      logger.debug('[ExpertPipelineExecutor] Visual RAG not available, skipping ingestion');
      return { success: false, skipped: true, reason: 'Visual RAG not available' };
    }

    try {
      const result = await this._ingestionManager.ingestDocument(docId, pdfPath, {
        embeddingModel: this.options.embeddingModel,
        ...options
      });

      logger.info({
        event: 'visual_rag_ingestion_complete',
        docId,
        visualIndexSuccess: result.visualIndex?.success,
        overlayCount: result.overlayExtraction?.overlayCount || 0
      });

      return result;
    } catch (ingestionError) {
      logger.error({
        event: 'visual_rag_ingestion_failed',
        docId,
        error: ingestionError.message
      });
      return { success: false, error: ingestionError.message };
    }
  }

  /**
   * Perform visual search across indexed documents
   */
  async visualSearch(query, options = {}) {
    this._initVisualRag();

    if (!this._ingestionManager) {
      return { query, results: [], totalResults: 0, available: false };
    }

    try {
      return await this._ingestionManager.visualSearch(query, options);
    } catch (searchError) {
      logger.warn({
        event: 'visual_search_failed',
        query,
        error: searchError.message
      });
      return { query, results: [], totalResults: 0, error: searchError.message };
    }
  }

  /**
   * Enrich pipeline result with visual overlays
   * @private
   */
  async _enrichWithVisualOverlays(result, context) {
    const orchestration = context?.options?.orchestration || {};
    const enableVisualRag = context?.options?.enableVisualRag ?? this.options.enableVisualRag;

    const allowRetrieval =
      normalizeBoolean(orchestration.use_visual_rag_retrieval, true) &&
      normalizeBoolean(orchestration.useVisualRagRetrieval, true);

    if (!enableVisualRag || !this.options.includeOverlaysInResult || !allowRetrieval) {
      return result;
    }

    const docId = context.document?.id;
    if (!docId) return result;

    try {
      const overlays = await this.getVisualOverlays(docId);

      if (overlays.length > 0) {
        result.visual = {
          overlays: overlays.map(o => ({
            pageNumber: o.pageNumber,
            label: o.label,
            box: o.box,
            confidence: o.confidence,
            text: o.overlayData?.text
          })),
          overlayCount: overlays.length,
          hasVisualData: true
        };

        logger.debug({
          event: 'visual_overlays_enriched',
          docId,
          overlayCount: overlays.length
        });
      }
    } catch (enrichmentError) {
      logger.warn({
        event: 'visual_overlay_enrichment_failed',
        docId,
        error: enrichmentError.message
      });
    }

    return result;
  }

  /**
   * Update execution statistics
   */
  _updateStats(result) {
    if (result.status === 'success') this.stats.successfulExecutions += 1;
    else this.stats.failedExecutions += 1;

    const n = this.stats.totalExecutions;
    const currentAvg = this.stats.averageExecutionTimeMs;
    const newTime = result.metadata.execution_time_ms;

    this.stats.averageExecutionTimeMs = ((currentAvg * (n - 1)) + newTime) / n;
  }

  /**
   * Execute validator-driven retry orchestration after extraction stage
   */
  async _executeWithValidation(stage, context, pipeline, extractionFn) {
    const maxValidationRetries = 2; // bounded retries
    let attempt = 0;

    let lastValidationResult = null;
    let extractionOutput = null;

    const requiredFields = pipeline.requiredFields || stage.requiredFields || [];

    while (attempt < maxValidationRetries) {
      attempt += 1;

      try {
        extractionOutput = await extractionFn();
      } catch (extractionError) {
        logger.error({
          event: 'extraction_failed_in_validation_loop',
          stageId: stage.id,
          attempt,
          retry_scope: 'document',
          error: extractionError.message
        });
        throw extractionError;
      }

      const validationResult = ValidationEngine.validate(
        stage.validationRules || [],
        extractionOutput,
        context,
        {
          requiredFields,
          confidenceThreshold: pipeline.confidenceThreshold || 0.7
        }
      );

      lastValidationResult = validationResult;

      context.setStageOutput(`${stage.outputKey}_validation`, validationResult);

      logger.info({
        event: 'extraction_validated',
        stageId: stage.id,
        attempt,
        isValid: validationResult.isValid,
        score: validationResult.score,
        missingFieldsCount: validationResult.missingFields.length,
        lowConfidenceFieldsCount: validationResult.lowConfidenceFields.length,
        shouldFallback: validationResult.shouldFallback
      });

      if (validationResult.isValid) {
        logger.info({
          event: 'validation_success',
          stageId: stage.id,
          attempt,
          score: validationResult.score,
          retry_scope: 'document'
        });
        break;
      }

      if (validationResult.shouldFallback) {
        const retryReason =
          validationResult.missingFields.length > 0
            ? 'missing_required_fields'
            : 'low_validation_score';

        logger.warn({
          event: 'validation_triggered_retry',
          stageId: stage.id,
          attempt,
          retry_scope: 'document',
          retry_reason: retryReason,
          missingFields: validationResult.missingFields,
          score: validationResult.score,
          severity: 'high',
          validation_triggered: true
        });

        logger.info({
          event: 'retry_triggered',
          stage: stage.id,
          reason: retryReason,
          severity: 'high',
          retry_scope: 'document'
        });

        if (this.metricsCollector?.recordRetry) {
          this.metricsCollector.recordRetry({
            pipelineId: pipeline?.id || context?.options?.pipelineId,
            stageName: stage.id,
            reason: retryReason,
            severity: 'high'
          });
        }

        if (attempt === 1) {
          logger.info({
            event: 'retry_strategy',
            strategy: 'retry_extraction_same_ocr',
            attempt,
            retry_scope: 'document'
          });
          continue;
        }

        if (attempt === 2 && context.document.enhanced_ocr_text) {
          logger.info({
            event: 'retry_strategy',
            strategy: 'ocr_already_selected',
            attempt,
            retry_scope: 'document',
            note: 'OCR source already selected via Visual vs Tesseract comparison'
          });
          continue;
        }
      } else if (validationResult.lowConfidenceFields.length > 0) {
        logger.warn({
          event: 'validation_low_confidence',
          stageId: stage.id,
          attempt,
          retry_scope: 'document',
          retry_reason: 'low_confidence_fields',
          lowConfidenceFields: validationResult.lowConfidenceFields,
          severity: 'medium',
          validation_triggered: true
        });

        logger.info({
          event: 'retry_triggered',
          stage: stage.id,
          reason: 'low_confidence_fields',
          severity: 'medium',
          retry_scope: 'document'
        });

        if (this.metricsCollector?.recordRetry) {
          this.metricsCollector.recordRetry({
            pipelineId: pipeline?.id || context?.options?.pipelineId,
            stageName: stage.id,
            reason: 'low_confidence_fields',
            severity: 'medium'
          });
        }

        if (attempt === 1) {
          continue;
        }

        logger.warn({
          event: 'validation_accepted_with_warnings',
          stageId: stage.id,
          lowConfidenceFields: validationResult.lowConfidenceFields,
          score: validationResult.score,
          retry_scope: 'document'
        });

        context.addWarning(
          stage.id,
          `Low confidence fields: ${validationResult.lowConfidenceFields.join(', ')}`
        );

        break;
      }
    }

    let terminalState = 'success';
    if (lastValidationResult && !lastValidationResult.isValid) {
      if (lastValidationResult.missingFields.length > 0) {
        terminalState = 'manual_review_required';
        context.addError(
          stage.id,
          new Error(
            `Validation failed after ${attempt} attempts: missing required fields ${lastValidationResult.missingFields.join(
              ', '
            )}`
          )
        );
      } else {
        terminalState = 'accepted_with_warnings';
        context.addWarning(stage.id, `Accepted with low confidence after ${attempt} attempts`);
      }
    }

    logger.info({
      event: 'validation_terminal_state',
      stageId: stage.id,
      terminalState,
      attempts: attempt,
      finalScore: lastValidationResult?.score,
      retry_scope: 'document',
      missingFields: lastValidationResult?.missingFields,
      lowConfidenceFields: lastValidationResult?.lowConfidenceFields
    });

    return {
      output: extractionOutput,
      validation: lastValidationResult,
      terminalState,
      attempts: attempt
    };
  }

  /**
   * Utility: delay for retry backoff
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check model availability via ollamaService.listModels()
   */
  async _checkModelAvailability(modelName, timeout = 5000) {
    const start = Date.now();

    try {
      if (!this.ollamaService || typeof this.ollamaService.listModels !== 'function') {
        return { available: false, models: [], error: 'listModels_not_supported' };
      }

      const listPromise = this.ollamaService.listModels();
      const timeoutPromise = new Promise((_, rej) =>
        setTimeout(() => rej(new Error('timeout')), timeout)
      );

      const models = await Promise.race([listPromise, timeoutPromise]);

      const modelList = Array.isArray(models) ? models : [];
      const available = modelList.some(m => {
        const name = typeof m === 'string' ? m : m?.name || m?.model;
        return typeof name === 'string' && name.includes(modelName);
      });

      logger.info({
        event: 'router_model_availability_check',
        model: modelName,
        available,
        durationMs: Date.now() - start
      });

      return { available, models: modelList };
    } catch (err) {
      logger.warn({
        event: 'router_model_availability_check',
        model: modelName,
        available: false,
        error: err?.message ? err.message : String(err)
      });

      return { available: false, models: [], error: err?.message ? err.message : String(err) };
    }
  }

  /**
   * Classify document using router with retry, exponential backoff and optional model availability pre-check
   * Signature follows plan: accepts document, executor, routerMessages, options
   */
  async _classifyDocumentWithRetry(document, executor, routerMessages, _options = {}) {
    void document;
    void _options;

    executor = executor || this;

    // Allow tests or callers to override retry configuration via options.retryCfg
    const defaultRetryCfg = config.routerRetry || {};
    const retryCfg = Object.assign({}, defaultRetryCfg, _options.retryCfg || {});
    const maxRetries = typeof retryCfg.maxRetries === 'number' ? retryCfg.maxRetries : 3;
    const baseDelay = typeof retryCfg.baseDelay === 'number' ? retryCfg.baseDelay : 1000;
    const maxDelay = typeof retryCfg.maxDelay === 'number' ? retryCfg.maxDelay : 10000;
    // By default, enableModelCheck should be on unless explicitly disabled
    const enableModelCheck = (typeof retryCfg.enableModelCheck === 'undefined')
      ? true
      : (retryCfg.enableModelCheck === 'yes' || retryCfg.enableModelCheck === true);
    const modelCheckTimeout = retryCfg.modelCheckTimeout || 5000;

    if (enableModelCheck && MODEL_NAMES?.router) {
      try {
        logger.debug({ event: 'router_model_precheck_start', model: MODEL_NAMES.router, timeout: modelCheckTimeout });
        const availability = await executor._checkModelAvailability(MODEL_NAMES.router, modelCheckTimeout);
        if (!availability.available) {
          logger.warn({
            event: 'router_model_unavailable_precheck',
            model: MODEL_NAMES.router,
            loadedModels: availability.models || [],
            reason: availability.error || 'not_loaded'
          });
          // Record the fallback statistic and return a consistent fallback indicator
          this.stats.routerFallbacks += 1;
          return { _meta: { fallback: true, reason: 'model_not_available' } };
        }
      } catch (err) {
        logger.warn({
          event: 'router_model_availability_check_error',
          error: err?.message ? err.message : String(err)
        });
      }
    }

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const routerResponse = await executor._callOllama(
          MODEL_NAMES.router,
          routerMessages,
          promptRegistry.getOptions('SYS_ROUTER_V1')
        );

        return await executor._parseResponse(routerResponse, { id: 'router', model: MODEL_NAMES.router });
      } catch (err) {
        lastError = err;

        const msg = err?.message ? err.message : String(err);
        const statusCode = err?.statusCode;

        const isConnRefused = /ECONNREFUSED/i.test(msg) || /ECONNRESET/i.test(msg);
        const isModelNotAvailable = /Model not available/i.test(msg) || /model not loaded/i.test(msg);
        const is5xx = [500, 502, 503, 504].includes(statusCode);

        const retryable = isConnRefused || isModelNotAvailable || is5xx;

        if (!retryable) {
          logger.error({ event: 'router_classification_non_retryable_error', error: msg });
          throw err;
        }

        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

        logger.warn({
          event: 'router_classification_retry',
          attempt,
          maxRetries,
          delayMs: delay,
          error: msg
        });

        this.stats.routerRetries += 1;

        if (attempt < maxRetries) {
          await executor._delay(delay);
        }
      }
    }

    logger.error({
      event: 'router_classification_failed_all_retries',
      attempts: maxRetries,
      error: lastError?.message ? lastError.message : String(lastError)
    });

    this.stats.routerFallbacks += 1;
    return null;
  }

  /**
   * Unload a model via Ollama to free VRAM (use keep_alive: 0).
   */
  async _unloadModel(modelName) {
    if (!modelName || !this.ollamaService) return;

    try {
      if (typeof this.ollamaService.chat === 'function') {
        await this.ollamaService.chat({
          model: modelName,
          messages: [{ role: 'system', content: 'model_unload' }],
          options: { keep_alive: 0 },
          stream: false
        });
      } else if (typeof this.ollamaService.generate === 'function') {
        await this.ollamaService.generate({
          model: modelName,
          options: { keep_alive: 0 }
        });
      }

      logger.debug({ event: 'model_unloaded', model: modelName });
    } catch (unloadError) {
      logger.warn({
        event: 'model_unload_failed',
        model: modelName,
        error: unloadError.message
      });
    }
  }

  // ========================================================================
  // VISUAL OCR METHODS
  // ========================================================================

  /**
   * Execute visual OCR to extract text from document images using vision model.
   */
  async _executeVisualOCR(document, options = {}) {
    const resolvedImages = resolveDocumentImages(document);
    const base64Images = resolvedImages.base64Images || [];

    if (base64Images.length === 0) {
      logger.debug('[VisualOCR] No images available, using Paperless OCR');
      return {
        text: document.ocr_text || '',
        source: 'paperless',
        metadata: { source: 'paperless', pages: 0 }
      };
    }

    const maxPages = config.visualOCR?.maxPages || 20;
    const timeout = config.visualOCR?.timeout || 60000;

    const pageTexts = [];

    logger.info({
      event: 'visual_ocr_start',
      documentId: document.id || document.filename,
      totalPages: base64Images.length,
      processingPages: Math.min(base64Images.length, maxPages),
      image_source: resolvedImages.source
    });

    for (let i = 0; i < Math.min(base64Images.length, maxPages); i += 1) {
      try {
        const pageText = await this._extractTextFromPage(
          base64Images[i],
          i + 1,
          base64Images.length,
          timeout
        );
        pageTexts.push(`--- Page ${i + 1} ---\n${pageText}`);
      } catch (pageError) {
        logger.warn({
          event: 'page_ocr_failed',
          page: i + 1,
          documentId: document.id || document.filename,
          error: pageError.message
        });
        pageTexts.push(`--- Page ${i + 1} (fallback) ---\n[OCR failed for this page]`);
      }
    }

    const visualText = pageTexts.join('\n\n');
    const rawPages = pageTexts.slice();

    const mergedResult = await mergeOcrResults(visualText, document.ocr_text || '', {
      ...options,
      logMetrics: true
    });

    logger.info({
      event: 'visual_ocr_quality_assessment',
      documentId: document.id || document.filename,
      qualityScore: mergedResult.quality_score,
      qualityBreakdown: mergedResult.quality_breakdown,
      selectedSource: mergedResult.source,
      reason: mergedResult.metadata?.reason
    });

    mergedResult.metadata = {
      ...(mergedResult.metadata || {}),
      raw_visual_text: visualText,
      raw_pages: rawPages
    };

    logger.info({
      event: 'visual_ocr_complete',
      documentId: document.id || document.filename,
      pagesProcessed: pageTexts.length,
      source: mergedResult.source,
      qualityScore: mergedResult.quality_score
    });

    return mergedResult;
  }

  /**
   * Extract text from a single page image using VIS_OCR_V1 prompt.
   */
  async _extractTextFromPage(base64Image, pageNumber, totalPages, timeout = 60000) {
    const messages = promptRegistry.buildMessages(
      'VIS_OCR_V1',
      { page_number: pageNumber, total_pages: totalPages },
      base64Image
    );

    // Prefer explicit visual OCR model if configured; otherwise fall back safely.
    const visualOcrModel =
      config.visualOCR?.model || MODEL_NAMES?.visual_ocr || MODEL_NAMES?.vision || MODEL_NAMES.router;

    const response = await this._callOllamaWithTimeout(
      visualOcrModel,
      messages,
      promptRegistry.getOptions('VIS_OCR_V1'),
      timeout
    );

    const content =
      typeof response === 'string' ? response : response?.message?.content || response?.response || '';

    return content.trim();
  }

  /**
   * Classify a document without running the full pipeline.
   */
  async classifyDocument(document, options = {}) {
    try {
      let classificationResult;

      if (options.preCalculatedSignals && options.preCalculatedSignals.classification) {
        const signals = options.preCalculatedSignals;

        logger.info({
          event: 'using_pre_calculated_signals',
          documentId: document.id || document.filename,
          domain: signals.classification.primary_domain
        });

        classificationResult = {
          classification: signals.classification,
          routing: {
            requires_visual_analysis: true,
            requires_expert_model: true
          }
        };
      } else {
        const routerMessages = promptRegistry.buildMessages(
          'SYS_ROUTER_V1',
          {
            source_system: document.source || 'paperless-ngx',
            filename: document.filename || 'unknown',
            resolution: document.resolution || 'standard',
            file_size: document.file_size || 'unknown'
          },
          document.image_data
        );

        const routerResponse = await this._callOllamaWithTimeout(
          MODEL_NAMES.router,
          routerMessages,
          promptRegistry.getOptions('SYS_ROUTER_V1'),
          options.timeout || 30000
        );

        classificationResult = await this._parseResponse(routerResponse, {
          id: 'router',
          model: MODEL_NAMES.router
        });
      }

      const domain =
        classificationResult?.classification?.primary_domain || classificationResult?.domain || 'General';

      const documentType =
        classificationResult?.classification?.document_type || classificationResult?.document_type || 'unknown';

      const confidence =
        classificationResult?.classification?.confidence || classificationResult?.confidence || 0;

      const { pipeline, routingMetadata } = expertRegistry.route(classificationResult);

      return {
        domain: String(domain).toLowerCase(),
        document_type: documentType,
        confidence,
        selected_pipeline: pipeline.id,
        routing: routingMetadata,
        raw_classification: classificationResult
      };
    } catch (classificationError) {
      logger.warn({
        event: 'classify_document_failed',
        documentId: document.id || document.filename,
        error: classificationError.message
      });

      return {
        domain: 'general',
        document_type: 'unknown',
        confidence: 0,
        selected_pipeline: 'PIPELINE_GENERAL_V1',
        routing: null,
        error: classificationError.message
      };
    }
  }

  /**
   * Get executor statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalExecutions > 0
        ? this.stats.successfulExecutions / this.stats.totalExecutions
        : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTimeMs: 0,
      routerRetries: 0,
      routerFallbacks: 0
    };
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Execute full document processing pipeline
 */
async function processDocument(document, ollamaService, options = {}) {
  const executor = new ExpertPipelineExecutor(ollamaService, options);

  logger.info({
    event: 'document_processing_start',
    documentId: document.id || document.filename
  });

  let classificationResult;
  let classifyResult = null;

  const preCalculatedSignals = options.context?.preCalculatedSignals || options.preCalculatedSignals;

  if (preCalculatedSignals && preCalculatedSignals.classification) {
    logger.info({
      event: 'process_document_using_pre_calculated_signals',
      documentId: document.id || document.filename
    });

    classificationResult = {
      classification: preCalculatedSignals.classification,
      routing: {
        requires_visual_analysis: true,
        requires_expert_model: true
      },
      _meta: {
        source: 'visual_signal_analyzer',
        parsed: true
      }
    };
  } else {
    const routerMessages = promptRegistry.buildMessages(
      'SYS_ROUTER_V1',
      {
        source_system: document.source || 'paperless-ngx',
        filename: document.filename || 'unknown',
        resolution: document.resolution || 'standard',
        file_size: document.file_size || 'unknown'
      },
      document.image_data
    );

    classifyResult = await executor._classifyDocumentWithRetry(document, executor, routerMessages, options);
    classificationResult = classifyResult;
  }

  if (classificationResult === null && !preCalculatedSignals) {
    const maxRetries = (config.routerRetry && config.routerRetry.maxRetries) || 3;

    logger.error({
      event: 'router_classification_failed',
      reason: 'router_retries_exhausted',
      attempts: maxRetries,
      documentId: document.id || document.filename
    });

    classificationResult = {
      classification: {
        primary_domain: 'General',
        document_type: 'unknown',
        confidence: 0.1
      },
      routing: {
        requires_visual_analysis: false,
        requires_expert_model: false
      },
      _meta: {
        fallback: true,
        reason: 'router_retries_exhausted',
        attempts: maxRetries
      }
    };
  } else if (classifyResult && classifyResult._meta && classifyResult._meta.fallback) {
    const reason = classifyResult._meta.reason || 'model_not_available';

    logger.error({
      event: 'router_classification_failed',
      reason,
      documentId: document.id || document.filename
    });

    classificationResult = {
      classification: {
        primary_domain: 'General',
        document_type: 'unknown',
        confidence: 0.1
      },
      routing: {
        requires_visual_analysis: false,
        requires_expert_model: false
      },
      _meta: {
        fallback: true,
        reason
      }
    };
  } else {
    logger.info({
      event: 'router_parsed_result',
      parsed: Boolean(classificationResult?._meta?.parsed),
      domain: classificationResult?.classification?.primary_domain,
      confidence: classificationResult?.classification?.confidence,
      extractionFailed: classificationResult?.extraction_failed
    });
  }

  const hasImage = Boolean(document.image_data || document.base64Images?.length);
  const toolingConfig = resolveToolingConfig(options);
  let orchestrationPlan = null;

  if (MODEL_NAMES?.orchestrator) {
    try {
      const pipelineCatalog = expertRegistry.list().map(p => ({
        id: p.id,
        name: p.name,
        domain: p.domain,
        documentTypes: p.documentTypes
      }));

      const docStats = {
        id: document.id || null,
        filename: document.filename || null,
        source: document.source || null,
        file_size: document.file_size || null,
        has_image: hasImage,
        ocr_length: (document.ocr_text || document.content || '').length,
        visual_rag_sidecar_enabled: config.visualRagSidecar?.enabled === 'yes',
        guidance_enabled: config.guidanceService?.enabled === 'yes'
      };

      const toolDefinitions = getAllowedToolDefinitions(toolingConfig);

      const orchestrationMessages = promptRegistry.buildMessages('SYS_ORCHESTRATOR_V1', {
        classification_json: JSON.stringify(classificationResult?.classification || {}, null, 0),
        routing_json: JSON.stringify(classificationResult?.routing || {}, null, 0),
        quality_json: JSON.stringify(classificationResult?.quality_assessment || {}, null, 0),
        doc_stats: JSON.stringify(docStats, null, 0),
        pipelines: JSON.stringify(pipelineCatalog, null, 0),
        tools_json: JSON.stringify(toolDefinitions, null, 0)
      });

      const orchestrationResponse = await executor._callOllamaWithTimeout(
        MODEL_NAMES.orchestrator,
        orchestrationMessages,
        promptRegistry.getOptions('SYS_ORCHESTRATOR_V1'),
        options.timeout || 30000
      );

      orchestrationPlan = await executor._parseResponse(orchestrationResponse, {
        id: 'system_orchestrator',
        model: MODEL_NAMES.orchestrator
      });
    } catch (orchestrationError) {
      logger.warn({
        event: 'orchestrator_call_failed',
        error: orchestrationError.message
      });
    }
  }

  const requiresVisual = normalizeBoolean(
    orchestrationPlan?.requires_visual_analysis,
    normalizeBoolean(classificationResult?.routing?.requires_visual_analysis, hasImage)
  );

  const useVisualOcr = normalizeBoolean(orchestrationPlan?.use_visual_ocr, requiresVisual);
  const useGuidance = normalizeBoolean(orchestrationPlan?.use_guidance, true);

  const useVisualRagIngestion = normalizeBoolean(
    orchestrationPlan?.use_visual_rag_ingestion,
    config.visualRagSidecar?.enabled === 'yes'
  );

  const useVisualRagRetrieval = normalizeBoolean(
    orchestrationPlan?.use_visual_rag_retrieval,
    config.visualRagSidecar?.enabled === 'yes'
  );

  if (orchestrationPlan && !orchestrationPlan.extraction_failed) {
    orchestrationPlan = {
      ...orchestrationPlan,
      requires_visual_analysis: requiresVisual,
      use_visual_ocr: useVisualOcr,
      use_guidance: useGuidance,
      use_visual_rag_ingestion: useVisualRagIngestion,
      use_visual_rag_retrieval: useVisualRagRetrieval
    };
  }

  classificationResult.routing = {
    ...(classificationResult.routing || {}),
    requires_visual_analysis: requiresVisual
  };

  const recommendedPipeline = orchestrationPlan?.selected_pipeline || orchestrationPlan?.selectedPipeline;
  if (recommendedPipeline) {
    classificationResult.routing.recommended_pipeline = recommendedPipeline;
  }

  classificationResult.orchestration = orchestrationPlan;

  if (orchestrationPlan && !orchestrationPlan.extraction_failed) {
    const { plan: toolPlan } = extractToolPlan(orchestrationPlan);
    orchestrationPlan.tool_plan = toolPlan;

    const preVisionSummary = await executeToolCalls({
      phase: ORCHESTRATOR_TOOL_PHASES.PRE_VISION,
      calls: toolPlan.pre_vision,
      document,
      toolingConfig
    });

    const normalizationImages = preVisionSummary.normalizedImages;
    const normalizationImageData = preVisionSummary.normalizedImageData;
    const normalizationMetadata = preVisionSummary.normalizationMetadata;
    const normalizationIsFinal = preVisionSummary.normalizationIsFinal;

    const preVisionSummaryForAttachment = {
      ...preVisionSummary,
      normalizedImages: null,
      normalizedImageData: null
    };

    orchestrationPlan = attachToolingSummary(orchestrationPlan, preVisionSummaryForAttachment);

    if (preVisionSummaryForAttachment.normalization) {
      orchestrationPlan.normalization = preVisionSummaryForAttachment.normalization;
    }

    if (orchestrationPlan.normalization && options.telemetry) {
      try {
        options.telemetry.setNormalization(orchestrationPlan.normalization);
      } catch (err) {
        logger.warn({ event: 'telemetry_normalization_set_failed', error: err.message });
      }
    }

    classificationResult.orchestration = orchestrationPlan;

    const hasNormalizationOutput =
      Array.isArray(normalizationImages) && normalizationImages.length > 0 && normalizationIsFinal;

    if (Array.isArray(normalizationImages) && normalizationImages.length > 0 && !normalizationIsFinal) {
      logger.warn({
        event: 'orchestrator_normalization_out_of_order',
        documentId: document.id || document.filename,
        reason: 'normalization_not_last',
        normalizationToolIndex: preVisionSummary.normalizationToolIndex,
        totalResults: preVisionSummary.results.length
      });
    }

    if (hasNormalizationOutput) {
      document._original_image_data = document.image_data;
      document._original_base64Images = document.base64Images;

      document.normalized_base64Images = normalizationImages;
      document.normalized_image_data = normalizationImageData || normalizationImages[0];

      document.image_data = document.normalized_image_data;
      document.base64Images = normalizationImages;
      document._normalization_metadata = normalizationMetadata || null;

      logger.info({
        event: 'orchestrator_normalization_applied',
        documentId: document.id || document.filename,
        originalImageCount: document._original_base64Images?.length || 0,
        normalizedImageCount: normalizationImages.length
      });

      if (normalizationMetadata) {
        logger.info({
          event: 'normalization_metrics',
          documentId: document.id || document.filename,
          metrics: {
            normalization_rate: preVisionSummary.executed > 0 ? 1 : 0,
            change_detection_rate: normalizationMetadata.changes_detected ? 1 : 0,
            actions_count: normalizationMetadata.actions_applied?.length || 0,
            reingested: normalizationMetadata.reingested || false,
            confidence: normalizationMetadata.geometry_confidence || null
          }
        });
      }
    }

    const shouldRefreshImages = preVisionSummary.executed > 0 && !hasNormalizationOutput;
    if (shouldRefreshImages) {
      if (typeof options.refreshImages === 'function') {
        try {
          const refreshed = await options.refreshImages({ forcePdf: true });

          if (Array.isArray(refreshed?.base64Images) && refreshed.base64Images.length > 0) {
            document.base64Images = refreshed.base64Images;
          }

          if (refreshed?.image_data) {
            document.image_data = refreshed.image_data;
          } else if (document.base64Images?.length > 0) {
            document.image_data = document.base64Images[0];
          }

          logger.info({
            event: 'orchestrator_prevision_refresh',
            documentId: document.id || document.filename,
            images: document.base64Images?.length || 0
          });
        } catch (refreshError) {
          logger.warn({
            event: 'orchestrator_prevision_refresh_failed',
            documentId: document.id || document.filename,
            error: refreshError.message
          });
        }
      } else {
        logger.warn({
          event: 'orchestrator_prevision_refresh_missing',
          documentId: document.id || document.filename,
          reason: 'refreshImages function not provided'
        });
      }
    }

    if (preVisionSummary.failPipeline) {
      throw new Error('Orchestrator pre-vision tool execution failed');
    }
  }

  // Step 1.5: Visual OCR Enhancement Stage
  if (useVisualOcr && document.base64Images?.length > 0 && config.visualOCR?.enabled !== false) {
    try {
      const ocrResult = await executor._executeVisualOCR(document, options);

      document.enhanced_ocr_text = ocrResult.text;
      document._ocr_metadata = ocrResult.metadata;

      logger.info({
        event: 'visual_ocr_enhanced',
        documentId: document.id || document.filename,
        source: ocrResult.source,
        qualityScore: ocrResult.quality_score,
        textLength: ocrResult.text?.length || 0
      });
    } catch (ocrError) {
      logger.warn({
        event: 'visual_ocr_failed',
        documentId: document.id || document.filename,
        error: ocrError.message
      });

      document.enhanced_ocr_text = document.ocr_text;
      document._ocr_metadata = { source: 'paperless_error_fallback' };
    }
  } else {
    document.enhanced_ocr_text = document.ocr_text;
    document._ocr_metadata = { source: 'paperless' };
  }

  const ocrText = document.enhanced_ocr_text || document.ocr_text || '';

  const ocrLanguageHint =
    classificationResult?.classification?.metadata_hints?.language ||
    classificationResult?.metadata_hints?.language ||
    classificationResult?.language ||
    document.language;

  const translationConfig = config.translation || {};

  // Require translator lazily to avoid circular require issues
  let LocalTranslatorCtor;
  try {
    LocalTranslatorCtor = require('./translation/LocalTranslator');
  } catch (e) {
    void e;
    const tm = require('./translation');
    LocalTranslatorCtor = tm.LocalTranslator || tm;
  }

  const translator = new LocalTranslatorCtor({ ollamaService });

  const normalizedLanguage = normalizeLanguageHint(ocrLanguageHint);

  const ocrMetadata = await buildVisOcrMetadata(
    ocrText,
    normalizedLanguage || ocrLanguageHint,
    translator,
    {
      includeTranslations: config.ocrCheckpoint?.includeTranslations !== 'no',
      skipEmptyText: true,
      translationOptions: {
        maxTokens: translationConfig.maxTokens,
        temperature: translationConfig.temperature,
        contextWindow: translationConfig.contextWindow
      }
    }
  );

  document._vis_ocr_metadata = ocrMetadata;

  if (document.id && config.ocrCheckpoint?.enabled === 'yes') {
    try {
      const required = (config.ocrCheckpoint && config.ocrCheckpoint.required === 'yes') || false;
      const continueOnPartial =
        (config.ocrCheckpoint && config.ocrCheckpoint.continueOnPartialSuccess === 'yes') || true;

      const checkpointResult = await ensureOcrCustomFields({
        continueOnPartialSuccess: continueOnPartial,
        failFast: required
      });

      document._ocr_checkpoint = checkpointResult;

      if (
        checkpointResult.success ||
        (checkpointResult.fields && checkpointResult.fields.length > 0 && continueOnPartial)
      ) {
        const customFields = {};

        if ((checkpointResult.fields || []).includes('vis_ocr_text') && ocrMetadata.vis_ocr_text) {
          customFields.vis_ocr_text = ocrMetadata.vis_ocr_text;
        }
        if ((checkpointResult.fields || []).includes('vis_ocr_text_de') && ocrMetadata.vis_ocr_text_de) {
          customFields.vis_ocr_text_de = ocrMetadata.vis_ocr_text_de;
        }
        if ((checkpointResult.fields || []).includes('vis_ocr_text_en') && ocrMetadata.vis_ocr_text_en) {
          customFields.vis_ocr_text_en = ocrMetadata.vis_ocr_text_en;
        }

        if (Object.keys(customFields).length > 0) {
          // Normalize values to avoid sending raw numbers / objects to Paperless
          const { normalizeCustomFieldValue } = require('../../customFieldUtils');
          for (const k of Object.keys(customFields)) {
            customFields[k] = normalizeCustomFieldValue(customFields[k]);
          }

          await paperlessService.updateDocument(document.id, {
            custom_fields: customFields
          });

          logger.info({
            event: 'ocr_checkpoint_updated',
            documentId: document.id,
            fieldsUpdated: Object.keys(customFields).length
          });
        }

        if (!checkpointResult.success && checkpointResult.errors?.length > 0) {
          logger.warn({
            event: 'ocr_checkpoint_partial_success',
            documentId: document.id,
            succeeded: checkpointResult.fields.length,
            failed: checkpointResult.errors.length,
            errors: checkpointResult.errors
          });
        } else {
          logger.info({ event: 'ocr_checkpoint_completed', documentId: document.id });
        }
      } else {
        logger.warn({
          event: 'ocr_checkpoint_failed_total',
          documentId: document.id,
          errors: checkpointResult.errors
        });

        if (required) {
          throw new Error('OCR checkpoint failed and is configured as required');
        }
      }
    } catch (checkpointError) {
      logger.warn('[ExpertPipelineExecutor] OCR checkpoint update failed', {
        docId: document.id,
        error: checkpointError.message
      });

      document._ocr_checkpoint_exception = checkpointError.message;
    }
  }

  const summaryConfig = config.summaryFallback || {};
  if (summaryConfig.enabled === 'yes' && ocrText) {
    const tokenCount = calculateTokens(ocrText);
    const maxInputTokens = parseInt(summaryConfig.maxInputTokens || 4000, 10);

    if (tokenCount > maxInputTokens) {
      try {
        const summary = await executor._summarizeTextForExtraction(ocrText, summaryConfig);
        if (summary) {
          document.summary_text = summary;
          document.extraction_text = summary;
          document._summary_metadata = {
            source: 'summary_fallback',
            original_tokens: tokenCount,
            truncated_input_tokens: maxInputTokens
          };

          logger.info({
            event: 'text_summary_generated',
            documentId: document.id,
            originalTokens: tokenCount,
            summaryLength: summary.length
          });
        }
      } catch (summaryError) {
        logger.warn({
          event: 'text_summary_generation_failed',
          documentId: document.id,
          error: summaryError.message
        });
      }
    }
  }

  // Step 2: Route to appropriate pipeline
  const { pipeline, routingMetadata } = expertRegistry.route(classificationResult);

  logger.info({
    event: 'pipeline_routing_selected',
    documentId: document.id || document.filename,
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    domain: classificationResult?.classification?.primary_domain
  });

  // Step 3: Execute pipeline
  const result = await executor.execute(pipeline.id, document, classificationResult, {
    ...options,
    routingMetadata,
    guidanceEnabled: useGuidance,
    enableVisualRag: useVisualRagRetrieval,
    orchestration: orchestrationPlan
  });

  result.routing = routingMetadata;
  return result;
}

/**
 * Create pipeline executor instance
 */
function createPipelineExecutor(ollamaService, options = {}) {
  return new ExpertPipelineExecutor(ollamaService, options);
}

module.exports = {
  ExpertPipelineExecutor,
  ExecutionContext,
  ConditionEvaluator,
  ValidationEngine,
  processDocument,
  createPipelineExecutor
};
