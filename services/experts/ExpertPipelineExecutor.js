/**
 * ExpertPipelineExecutor.js
 *
 * Stage-by-stage pipeline execution engine for expert model chains.
 * Orchestrates document flow through classification, analysis, and integration stages.
 *
 * Architecture Reference: Expert Model Pipeline Design, Section 4
 * Hardware Target: NVIDIA RTX 3090 Ti (24GB VRAM)
 *
 * Execution Flow:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                        PIPELINE EXECUTION ENGINE                            │
 * │                                                                             │
 * │  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐             │
 * │  │  Stage 1 │───▶│  Stage 2 │───▶│  Stage 3 │───▶│  Stage N │             │
 * │  │ (Visual) │    │  (Text)  │    │(Integrate)│   │(Validate)│             │
 * │  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘             │
 * │       │               │               │               │                    │
 * │       ▼               ▼               ▼               ▼                    │
 * │  ┌─────────────────────────────────────────────────────────────┐          │
 * │  │                    EXECUTION CONTEXT                         │          │
 * │  │  - Stage outputs accumulate                                  │          │
 * │  │  - Errors trigger recovery stages                           │          │
 * │  │  - Metrics logged per ADR-005                               │          │
 * │  └─────────────────────────────────────────────────────────────┘          │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 * Model Configuration:
 * - Router: qwen3-vl:8b (multimodal)
 * - Medical Imaging: llava-med-v1.5:latest (multimodal)
 * - Medical Text: medtext-llama3:latest (text-only)
 * - General Fallback: sauerkraut-llama3.1:8b (text-only)
 */

const axios = require('axios');
const logger = require('../logger');
const config = require('../../config/config');
const { promptRegistry, ModelType, MODEL_NAMES } = require('../prompts/PromptRegistry');
const internalVatRag = require('../rag/InternalVatRag');
const internalLegalRag = require('../rag/InternalLegalRag');
const JsonRepairService = require('../rag/JsonRepairService');
const { expertRegistry, StageType, ExecutionMode } = require('./ExpertRegistry');

// Import extracted modules
const { ExecutionContext } = require('./context');
const { ConditionEvaluator, ValidationEngine } = require('./evaluation');
const { getVisualRagModules } = require('./utils');

// ============================================================================
// PIPELINE EXECUTOR
// ============================================================================

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
            ...options
        };

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
        if (this._visualRagInitialized) return;
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
        this.stats.totalExecutions++;

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
            } catch (error) {
                // Try to find a pipeline by stage id (backwards compatibility)
                try {
                    pipeline = expertRegistry.findPipelineByStageId(pipelineId);
                    logger.info(`Resolved stage id ${pipelineId} to pipeline ${pipeline.id}`);
                } catch (err) {
                    logger.error({
                        event: 'pipeline_not_found',
                        pipelineId,
                        error: err.message
                    });
                    return this._buildErrorResult(pipelineId, error, startTime);
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
                        } catch (err) {
                            logger.warn({ event: 'model_unload_error', stageId: stage.id, error: err.message });
                        }
                    }

                    // Check for partial success scenarios
                    if (stageResult.status === 'error' && stage.type !== StageType.RECOVERY) {
                        finalStatus = 'partial';
                    }
                }
            } catch (error) {
                logger.error({
                    event: 'pipeline_execution_error',
                    pipelineId,
                    error: error.message
                });
                finalStatus = 'failed';
                context.addError('pipeline', error);
            }

            // Build final result
            let result = this._buildResult(pipeline, context, finalStatus, startTime);

            // Enrich with visual overlays if available
            if (this.options.enableVisualRag) {
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
        } catch (err) {
            logger.error({
                event: 'pipeline_execution_unexpected_error',
                pipelineId,
                error: err.message
            });

            // Ensure a consistent error object is returned (tests expect this shape)
            return this._buildErrorResult(pipelineId, err, startTime);
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
            context.recoveryAttempts++;
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

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

            } catch (error) {
                lastError = error;
                logger.warn({
                    event: 'stage_execution_retry',
                    stageId: stage.id,
                    attempt,
                    maxRetries,
                    error: error.message
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
     */
    async _executeLLMStage(stage, input, context) {
        // Get prompt template
        const prompt = promptRegistry.get(stage.promptId);
        if (prompt.model && stage.model && prompt.model !== stage.model) {
            logger.warn({
                event: 'stage_model_mismatch',
                stageId: stage.id,
                promptId: stage.promptId,
                stageModel: stage.model,
                promptModel: prompt.model
            });
        }

        // Build variables and image data
        const variables = this._flattenInput(input);
        const imageData = stage.modelType === ModelType.MULTIMODAL ?
                          input.image || context.document.image_data : null;

        // Local context injection: choose a reasonable text source
        const textForContext = input && (input.text || input.question || input.body) || variables.text || context.document?.text || context.document?.ocr_text || Object.values(variables).join(' ');

        if (stage.injectLegalContext) {
            try {
                const legalCtx = await internalLegalRag.retrieve(textForContext);
                if (legalCtx) variables.legal_context = legalCtx;
            } catch (err) {
                logger.warn({ event: 'legal_context_injection_failed', stageId: stage.id, error: err.message });
            }
        }

        if (stage.injectVatContext) {
            try {
                const vatCtx = await internalVatRag.retrieve(textForContext);
                if (vatCtx) variables.vat_context = vatCtx;
            } catch (err) {
                logger.warn({ event: 'vat_context_injection_failed', stageId: stage.id, error: err.message });
            }
        }

        // Build messages
        const messages = promptRegistry.buildMessages(
            stage.promptId,
            variables,
            imageData
        );

        // Get model options
        const options = promptRegistry.getOptions(stage.promptId);

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
        // If ollamaService is provided, use it
        if (this.ollamaService && typeof this.ollamaService.chat === 'function') {
            return await this.ollamaService.chat({
                model,
                messages,
                options,
                stream: false
            });
        }

        // Fallback: Direct HTTP call to Ollama
        const ollamaHost = config.ollama.apiUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
        const response = await axios.post(`${ollamaHost}/api/chat`, {
            model,
            messages,
            options,
            stream: false
        });

        const result = response.data;
        return result.message?.content || result.response || '';
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
                } catch (err) { void err; /* fallthrough */ }
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
        } catch (error) {
            logger.warn({
                event: 'response_parse_warning',
                stageId: stage.id,
                error: error.message
            });

            return {
                _meta: {
                    parsed: false,
                    parseError: error.message,
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
            status: status,

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
                recovery_attempts: context.recoveryAttempts
            },

            quality: {
                error_count: context.errors.length,
                warning_count: context.warnings.length,
                errors: context.errors,
                warnings: context.warnings,
                requires_human_review: status !== 'success' ||
                                       overallConfidence < pipeline.confidenceThreshold
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
        this.stats.failedExecutions++;

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
        } catch (error) {
            logger.warn({
                event: 'visual_overlay_fetch_failed',
                docId,
                error: error.message
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
            const result = await this._ingestionManager.ingestDocument(docId, pdfPath, options);

            logger.info({
                event: 'visual_rag_ingestion_complete',
                docId,
                visualIndexSuccess: result.visualIndex?.success,
                overlayCount: result.overlayExtraction?.overlayCount || 0
            });

            return result;
        } catch (error) {
            logger.error({
                event: 'visual_rag_ingestion_failed',
                docId,
                error: error.message
            });
            return { success: false, error: error.message };
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
        } catch (error) {
            logger.warn({
                event: 'visual_search_failed',
                query,
                error: error.message
            });
            return { query, results: [], totalResults: 0, error: error.message };
        }
    }

    /**
     * Enrich pipeline result with visual overlays
     * @private
     */
    async _enrichWithVisualOverlays(result, context) {
        if (!this.options.enableVisualRag || !this.options.includeOverlaysInResult) {
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
        } catch (error) {
            logger.warn({
                event: 'visual_overlay_enrichment_failed',
                docId,
                error: error.message
            });
        }

        return result;
    }

    /**
     * Update execution statistics
     */
    _updateStats(result) {
        if (result.status === 'success') {
            this.stats.successfulExecutions++;
        } else {
            this.stats.failedExecutions++;
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
        } catch (err) {
            logger.warn({ event: 'model_unload_failed', model: modelName, error: err.message });
        }
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
                confidence: confidence,
                selected_pipeline: pipeline.id,
                routing: routingMetadata,
                raw_classification: classificationResult
            };
        } catch (error) {
            logger.warn({
                event: 'classify_document_failed',
                documentId: document.id || document.filename,
                error: error.message
            });

            // Return fallback classification
            return {
                domain: 'general',
                document_type: 'unknown',
                confidence: 0,
                selected_pipeline: 'PIPELINE_GENERAL_V1',
                routing: null,
                error: error.message
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

    } catch (error) {
        logger.error({
            event: 'router_classification_failed',
            error: error.message
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

    // Step 2: Route to appropriate pipeline
    const { pipeline, routingMetadata } = expertRegistry.route(classificationResult);

    // Step 3: Execute pipeline
    const result = await executor.execute(
        pipeline.id,
        document,
        classificationResult,
        {
            ...options,
            routingMetadata
        }
    );

    // Add routing info to result
    result.routing = routingMetadata;

    return result;
}

// ============================================================================
// EXPORTS
// ============================================================================

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
