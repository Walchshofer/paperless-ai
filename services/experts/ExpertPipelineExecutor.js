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
const { getVisualRagModules } = require('./utils');

// Import Guidance client for deterministic extraction
const { guidanceClient, getFallbackPromptId } = require('../guidance');

// Import utility modules (via centralized index)
// Note: Only importing what's directly used in this file
// NORMALIZATION_TOOL_NAME and REVIEW_SKIP_REASONS are used in toolingExecution.js
// scoreOcrQuality is used internally by mergeOcrResults
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
            enableVisualRag: options.enableVisualRag ?? config.visualRagSidecar?.enabled === 'yes',
            includeOverlaysInResult: options.includeOverlaysInResult ?? true,
            embeddingModel: options.embeddingModel || 'nomic-embed-text',
            ...options
        };
        this.translator = options.translator || null;
        this.semanticRouter = options.semanticRouter || null;

        // Execution statistics
        this.stats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTimeMs: 0
        };

        // JSON repair helper (uses Ollama 'sauerkraut' model)
        this.jsonRepairService = new JsonRepairService(this.ollamaService);

        // Visual RAG components (lazy-initialized)
        this._visualRagInitialized = false;
        this._ingestionManager = null;
        this._visualOverlayRepository = null;
    }

    /**
     * Initialize Visual RAG components lazily
     * @private
     */
    _initVisualRag() {
        if (this._visualRagInitialized) {
            return;
        }
        this._visualRagInitialized = true;

        const modules = getVisualRagModules();
        if (modules) {
            this._ingestionManager = modules.ingestionManager;
            this._visualOverlayRepository = modules.visualOverlayRepository;
            logger.debug('[ExpertPipelineExecutor] Visual RAG components initialized');
        }
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

                    // Check if we need to abort
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

                    // Check for partial success scenarios
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
                        reviewSkips: postAnalysisSummary.skipped.filter(
                            skip => requiresHumanReview(skip.reason)
                        ).length
                    });
                }

                if (postAnalysisSummary.failPipeline) {
                    finalStatus = 'failed';
                    context.addError('orchestrator_tools', new Error('Post-analysis tool execution failed'));
                }
            }

            // Build final result
            let result = this._buildResult(pipeline, context, finalStatus, startTime);

            // Enrich with visual overlays if available
            const enableVisualRag =
                context.options?.enableVisualRag ?? this.options.enableVisualRag;
            if (enableVisualRag) {
                result = await this._enrichWithVisualOverlays(result, context);
            }

            // Update statistics
            this._updateStats(result);

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

            // Ensure a consistent error object is returned
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
                return { status: 'skipped', abort: false };
            }
        }

        if (stage.executionMode === ExecutionMode.FALLBACK) {
            if (!ConditionEvaluator.evaluate(stage.triggerCondition, context)) {
                context.skipStage(stage.id, 'Fallback not triggered');
                logger.debug(`Skipping fallback stage ${stage.id}: trigger condition not met`);
                return { status: 'skipped', abort: false };
            }
            context.recoveryAttempts += 1;
        }

        // Handle validation stages (no LLM call)
        if (stage.type === StageType.VALIDATION) {
            return this._executeValidationStage(stage, context, stageStart);
        }

        // Build input from mappings
        const stageInput = this._buildStageInput(stage.inputMapping, context);

        // Execute LLM stage with retry logic
        let lastError = null;
        const maxRetries = stage.retryCount || 1;

        for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
            try {
                const output = await this._executeLLMStage(stage, stageInput, context);

                // Store output
                const timing = Date.now() - stageStart;
                context.setStageOutput(stage.outputKey, output, timing);

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
                    error: stageError.message
                });

                if (attempt < maxRetries) {
                    // Wait before retry (exponential backoff)
                    await this._delay(1000 * attempt);
                }
            }
        }

        // All retries failed
        context.addError(stage.id, lastError);

        // Determine if this is fatal
        const isFatal = stage.type === StageType.CLASSIFICATION ||
                        (stage.executionMode === ExecutionMode.RECOVERY);

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
        // Build variables from input
        const variables = this._flattenInput(input);

        // Text context for RAG injection
        const textForContext = (input && (input.text || input.question || input.body)) ||
                               variables.text ||
                               context.document?.text ||
                               context.document?.ocr_text ||
                               Object.values(variables).join(' ');

        // Inject legal context if requested
        if (stage.injectLegalContext) {
            try {
                const legalCtx = await internalLegalRag.retrieve(textForContext);
                if (legalCtx) {
                    variables.legal_context = legalCtx;
                }
            } catch (legalError) {
                logger.warn({
                    event: 'legal_context_injection_failed',
                    stageId: stage.id,
                    error: legalError.message
                });
            }
        }

        // Inject VAT context if requested
        if (stage.injectVatContext) {
            try {
                const vatCtx = await internalVatRag.retrieve(textForContext);
                if (vatCtx) {
                    variables.vat_context = vatCtx;
                }
            } catch (vatError) {
                logger.warn({
                    event: 'vat_context_injection_failed',
                    stageId: stage.id,
                    error: vatError.message
                });
            }
        }

        const rawDomain = context?.classification?.classification?.primary_domain ||
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
                    if (!tag) {
                        return null;
                    }
                    if (typeof tag === 'string') {
                        return tag.trim();
                    }
                    if (typeof tag === 'object' && tag.name) {
                        return String(tag.name).trim();
                    }
                    return null;
                })
                .filter(Boolean)
            : [];

        const existingTagIds = Array.isArray(existingTagsRaw)
            ? existingTagsRaw
                .map(tag => {
                    if (typeof tag === 'number' && Number.isFinite(tag)) {
                        return tag;
                    }
                    if (tag && typeof tag === 'object' && typeof tag.id === 'number' && Number.isFinite(tag.id)) {
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

        if (domain && variables.domain === undefined) {
            variables.domain = domain;
        }
        if (existingTags.length > 0 && variables.existing_tags === undefined) {
            variables.existing_tags = existingTags;
        }
        if (modelName && variables.model === undefined) {
            variables.model = modelName;
        }

        // =================================================================
        // GUIDANCE PATH: Use Python Guidance service for deterministic JSON
        // =================================================================
        const guidanceEnabled =
            normalizeBoolean(context?.options?.guidanceEnabled, true) &&
            normalizeBoolean(context?.options?.orchestration?.use_guidance, true) &&
            normalizeBoolean(context?.options?.orchestration?.useGuidance, true);

        if (stage.guidanceTemplate && guidanceEnabled && await guidanceClient.isAvailable()) {
            const resolvedTemplate = resolveGuidanceTemplateName(stage.guidanceTemplate);
            logger.debug({
                event: 'stage_using_guidance',
                stageId: stage.id,
                template: resolvedTemplate,
                baseTemplate: stage.guidanceTemplate
            });

            try {
                const streamingThreshold = parseInt(
                    process.env.GUIDANCE_STREAMING_THRESHOLD || '2000',
                    10
                );
                const tokenCount = calculateTokens(textForContext || '');
                const enableStreaming =
                    Number.isFinite(streamingThreshold) &&
                    tokenCount > streamingThreshold;

                const guidanceResult = await guidanceClient.generate(
                    resolvedTemplate,
                    variables,
                    {
                        model: modelName,
                        temperature: 0.1,
                        stream: enableStreaming
                    }
                );

                if (guidanceResult.success) {
                    logger.info({
                        event: 'guidance_extraction_success',
                        stageId: stage.id,
                        template: resolvedTemplate,
                        baseTemplate: stage.guidanceTemplate,
                        valid: guidanceResult.validation?.valid,
                        source: guidanceResult.source
                    });

                    return guidanceResult.generated;
                }
            } catch (guidanceError) {
                logger.warn({
                    event: 'guidance_extraction_fallback',
                    stageId: stage.id,
                    template: resolvedTemplate,
                    baseTemplate: stage.guidanceTemplate,
                    error: guidanceError.message
                });
                // Fall through to PromptRegistry path
            }
        }

        // =================================================================
        // FALLBACK PATH: Use PromptRegistry + direct Ollama calls
        // =================================================================

        // Determine promptId - use stage.promptId or derive from guidanceTemplate
        const promptId = stage.promptId ||
                         (stage.guidanceTemplate ? getFallbackPromptId(stage.guidanceTemplate) : null);

        if (!promptId) {
            throw new Error(`Stage ${stage.id} has no promptId or guidanceTemplate configured`);
        }

        // Get prompt template
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
        const imageData = stage.modelType === ModelType.MULTIMODAL
            ? (input.image || resolvedImages.imageData)
            : null;

        // Build messages
        const messages = promptRegistry.buildMessages(
            promptId,
            variables,
            imageData
        );

        // Get model options
        const options = promptRegistry.getOptions(promptId);

        // Execute LLM call with timeout
        const timeout = stage.timeout || this.options.defaultTimeout;

        const response = await this._callOllamaWithTimeout(
            stage.model,
            messages,
            options,
            timeout
        );

        // Parse response via JSON repair
        const parsed = await this._parseResponse(response, stage);

        return parsed;
    }

    /**
     * Execute a validation stage
     */
    _executeValidationStage(stage, context, stageStart) {
        const validationResult = ValidationEngine.validate(
            stage.validationRules,
            context
        );

        const timing = Date.now() - stageStart;
        context.setStageOutput(stage.outputKey, validationResult, timing);

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

        for (const [key, value] of Object.entries(input)) {
            const fullKey = prefix ? `${prefix}_${key}` : key;

            if (value === null || value === undefined) {
                result[fullKey] = 'N/A';
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                // Recurse for nested objects
                Object.assign(result, this._flattenInput(value, fullKey));
                // Also store stringified version
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
        if (typeof response?.message?.content === 'string') {
            return response.message.content;
        }
        if (typeof response?.response === 'string') {
            return response.response;
        }
        if (typeof response === 'string') {
            return response;
        }
        return '';
    }

    async _summarizeTextForExtraction(text, options = {}) {
        if (!text || typeof text !== 'string') {
            return '';
        }

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
                content: 'Summarize the document for downstream extraction. Preserve key entities, dates, amounts, and terms. Return plain text only.'
            },
            {
                role: 'user',
                content: trimmedText
            }
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
            logger.warn('[ExpertPipelineExecutor] Summary fallback failed', {
                error: summaryError.message
            });
            return '';
        }
    }

    /**
     * Call Ollama API with timeout
     */
    async _callOllamaWithTimeout(model, messages, options, timeout) {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`LLM call timed out after ${timeout}ms`));
            }, timeout);
        });

        // Create LLM call promise
        const llmPromise = this._callOllama(model, messages, options);

        // Race them
        return Promise.race([llmPromise, timeoutPromise]);
    }

    /**
     * Call Ollama API
     * This integrates with the existing ollamaService pattern in the codebase
     */
    async _callOllama(model, messages, options) {
        const resolvedOptions = this._applyOllamaLimits(model, messages, options);
        truncationMetrics.recordRequest('expert', model);

        // If ollamaService is provided, use it
        if (this.ollamaService && typeof this.ollamaService.chat === 'function') {
            const response = await this.ollamaService.chat({
                model,
                messages,
                options: resolvedOptions,
                stream: false
            });

            const doneReason = response?.done_reason;
            const evalCount = response?.eval_count;
            if (doneReason === 'length'
                || (Number.isFinite(evalCount)
                    && Number.isFinite(resolvedOptions?.num_predict)
                    && evalCount >= resolvedOptions.num_predict)) {
                truncationMetrics.recordResponseTruncation('expert', model);
            }
            return response;
        }

        // Fallback: Direct HTTP call to Ollama
        const ollamaHost = config.ollama.apiUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
        const response = await axios.post(`${ollamaHost}/api/chat`, {
            model,
            messages,
            options: resolvedOptions,
            stream: false
        });

        const result = response.data;
        const doneReason = result?.done_reason;
        const evalCount = result?.eval_count;
        if (doneReason === 'length'
            || (Number.isFinite(evalCount)
                && Number.isFinite(resolvedOptions?.num_predict)
                && evalCount >= resolvedOptions.num_predict)) {
            truncationMetrics.recordResponseTruncation('expert', model);
        }
        return result.message?.content || result.response || '';
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
        const totalInputTokens = messageTokens + (imageCount * imageTokenOverhead);

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
        // Handle Ollama response format
        const content = typeof response === 'string' ?
                        response :
                        (response.message?.content || response.response || '');

        try {
            // Delegate extraction + repair logic to JsonRepairService
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
                    // fallthrough to no_json_extracted result
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

        // Determine overall confidence
        let overallConfidence = 0;
        const integratedOutput = context.getStageOutput('integrated_record') ||
                                  context.getStageOutput('financial_reasoning') ||
                                  context.getStageOutput('financial_extraction') ||
                                  context.getStageOutput('legal_extraction') ||
                                  context.getStageOutput('general_extraction');

        if (integratedOutput?.confidence_summary?.overall_confidence) {
            overallConfidence = integratedOutput.confidence_summary.overall_confidence;
        } else if (integratedOutput?.confidence?.overall) {
            overallConfidence = integratedOutput.confidence.overall;
        }

        return {
            success: status === 'success',
            pipeline_id: pipeline.id,
            pipeline_name: pipeline.name,
            pipeline_version: pipeline.version,
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
                requires_human_review: status !== 'success' ||
                                       overallConfidence < pipeline.confidenceThreshold ||
                                       !!context.options?.orchestration?.tooling?.requires_human_review
            },

            document_info: {
                id: context.document.id,
                filename: context.document.filename,
                source: context.document.source
            },

            timestamp: new Date().toISOString()
        };
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
                errors: [{
                    stageId: 'initialization',
                    error: error.message,
                    timestamp: Date.now()
                }],
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

        if (!this._visualOverlayRepository) {
            return [];
        }

        try {
            const available = await this._visualOverlayRepository.isAvailable();
            if (!available) {
                return [];
            }

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
     * Should be called during document processing when images are available.
     *
     * @param {number} docId - Paperless document ID
     * @param {string} pdfPath - Path to PDF file (relative to /media/paperless)
     * @param {Object} options - Ingestion options
     * @param {string} options.domain - Document domain (medical, financial, legal)
     * @param {Array<string>} options.base64Images - Pre-rendered page images
     * @returns {Promise<Object>} Ingestion result
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
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results with overlays
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
        if (!docId) {
            return result;
        }

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
        if (result.status === 'success') {
            this.stats.successfulExecutions += 1;
        } else {
            this.stats.failedExecutions += 1;
        }

        // Update running average
        const n = this.stats.totalExecutions;
        const currentAvg = this.stats.averageExecutionTimeMs;
        const newTime = result.metadata.execution_time_ms;
        this.stats.averageExecutionTimeMs = ((currentAvg * (n - 1)) + newTime) / n;
    }

    /**
     * Utility: delay for retry backoff
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Unload a model via Ollama to free VRAM (use keep_alive: 0).
     * Attempts to use provided ollamaService.chat or generate.
     */
    async _unloadModel(modelName) {
        if (!modelName || !this.ollamaService) {
            return;
        }

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
     * Uses VIS_OCR_V1 prompt with qwen3-vl:8b for high-precision text extraction.
     *
     * @param {Object} document - Document with base64Images array
     * @param {Object} options - OCR options
     * @returns {Promise<Object>} OCR result with text and metadata
     */
    async _executeVisualOCR(document, options = {}) {
        const resolvedImages = resolveDocumentImages(document);
        const base64Images = resolvedImages.base64Images || [];

        if (base64Images.length === 0) {
            logger.debug('[VisualOCR] No images available, using Paperless OCR');
            return {
                text: document.ocr_text || '',
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
                // Log warning but continue with other pages
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

        // Merge with Paperless OCR using semantic quality scoring
        const mergedResult = await mergeOcrResults(
            visualText,
            document.ocr_text || '',
            {
                ...options,
                logMetrics: true
            }
        );

        // Log OCR quality metrics
        logger.info({
            event: 'visual_ocr_quality_assessment',
            documentId: document.id || document.filename,
            qualityScore: mergedResult.quality_score,
            qualityBreakdown: mergedResult.quality_breakdown,
            selectedSource: mergedResult.source,
            reason: mergedResult.metadata.reason
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
     *
     * @param {string} base64Image - Base64-encoded page image
     * @param {number} pageNumber - Current page number (1-indexed)
     * @param {number} totalPages - Total number of pages
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<string>} Extracted text
     */
    async _extractTextFromPage(base64Image, pageNumber, totalPages, timeout = 60000) {
        const messages = promptRegistry.buildMessages(
            'VIS_OCR_V1',
            { page_number: pageNumber, total_pages: totalPages },
            base64Image
        );

        const response = await this._callOllamaWithTimeout(
            MODEL_NAMES.router,  // VIS_OCR_V1 uses same model as router
            messages,
            promptRegistry.getOptions('VIS_OCR_V1'),
            timeout
        );

        // Extract text content - VIS_OCR_V1 returns plain text, not JSON
        const content = typeof response === 'string'
            ? response
            : (response.message?.content || response.response || '');

        return content.trim();
    }

    /**
     * Classify a document without running the full pipeline.
     * Returns domain and routing information for use by DomainResolver.
     *
     * @param {Object} document - Document to classify (image_data, ocr_text, filename, etc.)
     * @param {Object} options - Classification options
     * @returns {Promise<Object>} Classification result with domain info
     */
    async classifyDocument(document, options = {}) {
        try {
            // Build router messages
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

            // Call router model
            const routerResponse = await this._callOllamaWithTimeout(
                MODEL_NAMES.router,
                routerMessages,
                promptRegistry.getOptions('SYS_ROUTER_V1'),
                options.timeout || 30000
            );

            const classificationResult = await this._parseResponse(routerResponse, {
                id: 'router',
                model: MODEL_NAMES.router
            });

            // Extract and normalize domain
            const domain = classificationResult?.classification?.primary_domain ||
                          classificationResult?.domain ||
                          'General';

            const documentType = classificationResult?.classification?.document_type ||
                                classificationResult?.document_type ||
                                'unknown';

            const confidence = classificationResult?.classification?.confidence ||
                              classificationResult?.confidence ||
                              0;

            // Get routing recommendation
            const { pipeline, routingMetadata } = expertRegistry.route(classificationResult);

            return {
                domain: domain.toLowerCase(),
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

            // Return fallback classification
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
            successRate: this.stats.totalExecutions > 0 ?
                         (this.stats.successfulExecutions / this.stats.totalExecutions) : 0
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
            averageExecutionTimeMs: 0
        };
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Execute full document processing pipeline
 *
 * This is the main entry point for document processing:
 * 1. Classifies document using router
 * 2. Routes to appropriate domain pipeline
 * 3. Executes pipeline stages
 * 4. Returns integrated result
 *
 * @param {Object} document - Document to process
 * @param {Object} ollamaService - Ollama API service
 * @param {Object} options - Processing options
 */
async function processDocument(document, ollamaService, options = {}) {
    const executor = new ExpertPipelineExecutor(ollamaService, options);

    // Step 1: Classify document using router
    logger.info({
        event: 'document_processing_start',
        documentId: document.id || document.filename
    });

    // Build router messages
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

    // Call router model
    let classificationResult;
    try {
        logger.info({
            event: 'router_call_start',
            model: MODEL_NAMES.router,
            hasImageData: !!document.image_data,
            imageDataLength: document.image_data?.length || 0,
            filename: document.filename
        });

        const routerResponse = await executor._callOllama(
            MODEL_NAMES.router,
            routerMessages,
            promptRegistry.getOptions('SYS_ROUTER_V1')
        );

        // Log raw router response for debugging
        const rawContent = typeof routerResponse === 'string'
            ? routerResponse
            : (routerResponse?.message?.content || routerResponse?.response || JSON.stringify(routerResponse));

        logger.info({
            event: 'router_raw_response',
            model: MODEL_NAMES.router,
            responseLength: rawContent?.length || 0,
            responsePreview: rawContent?.substring(0, 500) || 'empty',
            responseType: typeof routerResponse
        });

        classificationResult = await executor._parseResponse(routerResponse, {
            id: 'router',
            model: MODEL_NAMES.router
        });

        logger.info({
            event: 'router_parsed_result',
            parsed: !!classificationResult?._meta?.parsed,
            domain: classificationResult?.classification?.primary_domain,
            confidence: classificationResult?.classification?.confidence,
            extractionFailed: classificationResult?.extraction_failed
        });
    } catch (routerError) {
        logger.error({
            event: 'router_classification_failed',
            error: routerError.message
        });

        // Fallback classification
        classificationResult = {
            classification: {
                primary_domain: 'General',
                document_type: 'unknown',
                confidence: 0.1
            },
            routing: {
                requires_visual_analysis: false,
                requires_expert_model: false
            }
        };
    }

    const hasImage = !!(document.image_data || document.base64Images?.length);
    const toolingConfig = resolveToolingConfig(options);
    let orchestrationPlan = null;

    if (MODEL_NAMES.orchestrator) {
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
            const orchestrationMessages = promptRegistry.buildMessages(
                'SYS_ORCHESTRATOR_V1',
                {
                    classification_json: JSON.stringify(classificationResult?.classification || {}, null, 0),
                    routing_json: JSON.stringify(classificationResult?.routing || {}, null, 0),
                    quality_json: JSON.stringify(classificationResult?.quality_assessment || {}, null, 0),
                    doc_stats: JSON.stringify(docStats, null, 0),
                    pipelines: JSON.stringify(pipelineCatalog, null, 0),
                    tools_json: JSON.stringify(toolDefinitions, null, 0)
                }
            );

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

        orchestrationPlan = attachToolingSummary(
            orchestrationPlan,
            preVisionSummaryForAttachment
        );

        if (preVisionSummaryForAttachment.normalization) {
            orchestrationPlan.normalization = preVisionSummaryForAttachment.normalization;
        }

        // Attach normalization telemetry if collector provided
        if (orchestrationPlan.normalization && options.telemetry) {
            try {
                options.telemetry.setNormalization(orchestrationPlan.normalization);
            } catch (err) {
                logger.warn({ event: 'telemetry_normalization_set_failed', error: err.message });
            }
        }

        classificationResult.orchestration = orchestrationPlan; 

        const hasNormalizationOutput = Array.isArray(normalizationImages)
            && normalizationImages.length > 0
            && normalizationIsFinal;

        if (Array.isArray(normalizationImages)
            && normalizationImages.length > 0
            && !normalizationIsFinal) {
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
            document.normalized_image_data = normalizationImageData
                || normalizationImages[0];
            document.image_data = document.normalized_image_data;
            document.base64Images = normalizationImages;
            document._normalization_metadata = normalizationMetadata || null;

            logger.info({
                event: 'orchestrator_normalization_applied',
                documentId: document.id || document.filename,
                originalImageCount: document._original_base64Images?.length || 0,
                normalizedImageCount: normalizationImages.length
            });

            if (hasNormalizationOutput && normalizationMetadata) {
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
    // Extract enhanced text using vision model before pipeline execution
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
            // Fallback to Paperless OCR
            document.enhanced_ocr_text = document.ocr_text;
            document._ocr_metadata = { source: 'paperless_error_fallback' };
        }
    } else {
        // No images available or OCR disabled - use Paperless OCR directly
        document.enhanced_ocr_text = document.ocr_text;
        document._ocr_metadata = { source: 'paperless' };
    }

    const ocrText = document.enhanced_ocr_text || document.ocr_text || '';
    const ocrLanguageHint = classificationResult?.classification?.metadata_hints?.language ||
        classificationResult?.metadata_hints?.language ||
        classificationResult?.language ||
        document.language;

        const translationConfig = config.translation || {};
        // Require translator lazily to avoid circular require issues
        let LocalTranslatorCtor;
        try {
            LocalTranslatorCtor = require('./translation/LocalTranslator');
        } catch (e) {
            const tm = require('./translation');
            LocalTranslatorCtor = tm.LocalTranslator || tm;
        }
        const translator = new LocalTranslatorCtor({ ollamaService });

    // Build OCR metadata with language normalization
    const normalizedLanguage = normalizeLanguageHint(ocrLanguageHint);
    const ocrMetadata = await buildVisOcrMetadata(ocrText, normalizedLanguage || ocrLanguageHint, translator, {
        includeTranslations: config.ocrCheckpoint?.includeTranslations !== 'no',
        skipEmptyText: true,
        translationOptions: {
            maxTokens: translationConfig.maxTokens,
            temperature: translationConfig.temperature,
            contextWindow: translationConfig.contextWindow
        }
    });

    document._vis_ocr_metadata = ocrMetadata;

    if (document.id && config.ocrCheckpoint?.enabled === 'yes') {
        try {
            const required = (config.ocrCheckpoint && config.ocrCheckpoint.required === 'yes') || false;
            const continueOnPartial = (config.ocrCheckpoint && config.ocrCheckpoint.continueOnPartialSuccess === 'yes') || true;

            const checkpointResult = await ensureOcrCustomFields({ continueOnPartialSuccess: continueOnPartial, failFast: required });

            // Preserve OCR metadata no matter what
            document._ocr_checkpoint = checkpointResult;

            if (checkpointResult.success || (checkpointResult.fields && checkpointResult.fields.length > 0 && continueOnPartial)) {
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
                    await paperlessService.updateDocument(document.id, {
                        custom_fields: customFields
                    });

                    logger.info({
                        event: 'ocr_checkpoint_updated',
                        documentId: document.id,
                        fieldsUpdated: Object.keys(customFields).length
                    });
                }

                if (!checkpointResult.success && checkpointResult.errors && checkpointResult.errors.length > 0) {
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
                // Total failure
                logger.warn({
                    event: 'ocr_checkpoint_failed_total',
                    documentId: document.id,
                    errors: checkpointResult.errors
                });

                // If checkpoint required, fail pipeline
                if (required) {
                    throw new Error('OCR checkpoint failed and is configured as required');
                }
            }
        } catch (checkpointError) {
            logger.warn('[ExpertPipelineExecutor] OCR checkpoint update failed', {
                docId: document.id,
                error: checkpointError.message
            });
            // Preserve metadata for diagnostics
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
    const result = await executor.execute(
        pipeline.id,
        document,
        classificationResult,
        {
            ...options,
            routingMetadata,
            guidanceEnabled: useGuidance,
            enableVisualRag: useVisualRagRetrieval,
            orchestration: orchestrationPlan
        }
    );

    // Add routing info to result
    result.routing = routingMetadata;

    return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

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