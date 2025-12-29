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
 * - Router: qwen3-vl:8B (multimodal)
 * - Medical Imaging: llava-med-v1.6:latest (multimodal)
 * - Medical Text: medtext-llama3:latest (text-only)
 * - General Fallback: llama3.2:latest (text-only)
 */

const logger = require('../logger');
const { promptRegistry, ModelType } = require('../prompts/PromptRegistry');
const { expertRegistry, StageType, ExecutionMode } = require('./ExpertRegistry');

// ============================================================================
// EXECUTION CONTEXT
// ============================================================================

/**
 * ExecutionContext - Maintains state throughout pipeline execution
 * 
 * Tracks:
 * - Original document data
 * - Classification result
 * - Stage outputs (accumulated)
 * - Errors and recovery attempts
 * - Timing metrics
 */
class ExecutionContext {
    constructor(document, classificationResult, options = {}) {
        this.document = document;
        this.classification = classificationResult;
        this.options = options;
        
        // Stage outputs keyed by outputKey
        this.stageOutputs = new Map();
        
        // Execution tracking
        this.stagesExecuted = [];
        this.stagesSkipped = [];
        this.errors = [];
        this.warnings = [];
        
        // Timing
        this.startTime = Date.now();
        this.stageTimings = new Map();
        
        // Recovery tracking
        this.recoveryAttempts = 0;
        this.maxRecoveryAttempts = options.maxRecoveryAttempts || 2;
    }
    
    /**
     * Store output from a completed stage
     */
    setStageOutput(outputKey, output, timing) {
        this.stageOutputs.set(outputKey, output);
        this.stageTimings.set(outputKey, timing);
        this.stagesExecuted.push(outputKey);
    }
    
    /**
     * Get output from a previous stage
     */
    getStageOutput(outputKey) {
        return this.stageOutputs.get(outputKey);
    }
    
    /**
     * Record a skipped stage
     */
    skipStage(stageId, reason) {
        this.stagesSkipped.push({ stageId, reason, timestamp: Date.now() });
    }
    
    /**
     * Record an error
     */
    addError(stageId, error) {
        this.errors.push({
            stageId,
            error: error.message || String(error),
            stack: error.stack,
            timestamp: Date.now()
        });
    }
    
    /**
     * Record a warning
     */
    addWarning(stageId, message) {
        this.warnings.push({
            stageId,
            message,
            timestamp: Date.now()
        });
    }
    
    /**
     * Resolve a path like 'stages.medical_visual.output' to actual value
     */
    resolvePath(path) {
        if (!path || typeof path !== 'string') {
            return null;
        }
        
        const parts = path.split('.');
        let current = null;
        
        // Handle different path roots
        switch (parts[0]) {
            case 'document':
                current = this.document;
                parts.shift();
                break;
            case 'classification':
                current = this.classification;
                parts.shift();
                break;
            case 'context':
                current = this.options.context || {};
                parts.shift();
                break;
            case 'stages':
                // stages.stage_id.output -> get from stageOutputs
                if (parts.length >= 3 && parts[2] === 'output') {
                    const stageOutputKey = this._findOutputKeyForStage(parts[1]);
                    return this.stageOutputs.get(stageOutputKey);
                }
                return null;
            case 'routing':
                current = this.classification?.routing || {};
                parts.shift();
                break;
            default:
                return null;
        }
        
        // Navigate remaining path
        for (const part of parts) {
            if (current === null || current === undefined) {
                return null;
            }
            current = current[part];
        }
        
        return current;
    }
    
    /**
     * Find the outputKey for a stage by its id
     */
    _findOutputKeyForStage(stageId) {
        // This requires knowledge of the pipeline stages
        // For now, use convention that outputKey often matches stage purpose
        const conventions = {
            'medical_visual': 'imaging_analysis',
            'medical_text': 'text_extraction',
            'medical_integration': 'integrated_record',
            'medical_validation': 'validation_result',
            'medical_recovery': 'recovery_extraction',
            'financial_visual': 'visual_analysis',
            'financial_extraction': 'financial_extraction',
            'financial_reasoning': 'financial_reasoning',
            'financial_vat_expert': 'financial_vat_analysis',
            'legal_extraction': 'legal_extraction',
            'general_extraction': 'general_extraction'
        };
        return conventions[stageId] || stageId;
    }
    
    /**
     * Get execution summary
     */
    getSummary() {
        return {
            totalTimeMs: Date.now() - this.startTime,
            stagesExecuted: this.stagesExecuted.length,
            stagesSkipped: this.stagesSkipped.length,
            errorCount: this.errors.length,
            warningCount: this.warnings.length,
            recoveryAttempts: this.recoveryAttempts
        };
    }
    
    /**
     * Get all stage outputs as plain object
     */
    getAllOutputs() {
        const outputs = {};
        for (const [key, value] of this.stageOutputs) {
            outputs[key] = value;
        }
        return outputs;
    }
}

// ============================================================================
// CONDITION EVALUATOR
// ============================================================================

/**
 * Evaluates stage conditions to determine if stage should execute
 */
class ConditionEvaluator {
    /**
     * Evaluate a condition against the execution context
     */
    static evaluate(condition, context) {
        if (!condition) {
            return true;  // No condition means always execute
        }
        
        // Handle 'anyOf' conditions
        if (condition.anyOf) {
            return condition.anyOf.some(c => this.evaluateSingle(c, context));
        }
        
        // Handle 'allOf' conditions
        if (condition.allOf) {
            return condition.allOf.every(c => this.evaluateSingle(c, context));
        }
        
        // Single condition
        return this.evaluateSingle(condition, context);
    }
    
    /**
     * Evaluate a single condition
     */
    static evaluateSingle(condition, context) {
        const { field, operator, value } = condition;
        const actualValue = context.resolvePath(field);
        
        switch (operator) {
            case 'equals':
                return actualValue === value;
            case 'not_equals':
                return actualValue !== value;
            case 'gt':
                return actualValue > value;
            case 'gte':
                return actualValue >= value;
            case 'lt':
                return actualValue < value;
            case 'lte':
                return actualValue <= value;
            case 'not_empty':
                return actualValue && 
                       (Array.isArray(actualValue) ? actualValue.length > 0 : true);
            case 'is_empty':
                return !actualValue || 
                       (Array.isArray(actualValue) && actualValue.length === 0);
            case 'contains':
                return Array.isArray(actualValue) && actualValue.includes(value);
            case 'exists':
                return actualValue !== null && actualValue !== undefined;
            default:
                logger.warn(`Unknown condition operator: ${operator}`);
                return false;
        }
    }
}

// ============================================================================
// VALIDATION ENGINE
// ============================================================================

/**
 * Validates stage outputs against defined rules
 */
class ValidationEngine {
    /**
     * Run validation rules against context
     */
    static validate(rules, context) {
        const issues = [];
        let allPassed = true;
        
        for (const rule of rules) {
            const result = ConditionEvaluator.evaluateSingle(rule, context);
            
            if (!result) {
                allPassed = false;
                issues.push({
                    field: rule.field,
                    operator: rule.operator,
                    expected: rule.value,
                    actual: context.resolvePath(rule.field),
                    message: rule.errorMessage || `Validation failed for ${rule.field}`
                });
            }
        }
        
        return {
            valid: allPassed,
            issues: issues,
            checkedRules: rules.length
        };
    }
}

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
            ...options
        };
        
        // Execution statistics
        this.stats = {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            averageExecutionTimeMs: 0
        };
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
            logger.error(`Pipeline not found: ${pipelineId}`);
            return this._buildErrorResult(pipelineId, error, startTime);
        }
        
        // Create execution context
        const context = new ExecutionContext(document, classificationResult, {
            ...options,
            pipelineId
        });
        
        // Execute stages
        let finalStatus = 'success';
        try {
            for (const stage of pipeline.stages) {
                const stageResult = await this._executeStage(stage, context, pipeline);
                
                // Check if we need to abort
                if (stageResult.abort) {
                    finalStatus = 'failed';
                    break;
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
        const result = this._buildResult(pipeline, context, finalStatus, startTime);
        
        // Update statistics
        this._updateStats(result);
        
        // Log completion
        logger.info({
            event: 'pipeline_execution_complete',
            pipelineId,
            status: finalStatus,
            executionTimeMs: result.metadata.execution_time_ms,
            stagesExecuted: context.stagesExecuted.length
        });
        
        return result;
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

        // Build messages
        const variables = this._flattenInput(input);
        const imageData = stage.modelType === ModelType.MULTIMODAL ? 
                          input.image || context.document.image_data : null;
        
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
        
        // Parse response
        const parsed = this._parseResponse(response, stage);
        
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
        const fetch = require('node-fetch');
        const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
        
        const response = await fetch(`${ollamaHost}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                messages,
                options,
                stream: false
            })
        });
        
        if (!response.ok) {
            throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        return result.message?.content || result.response || '';
    }
    
    /**
     * Parse LLM response, attempting JSON extraction
     */
    _parseResponse(response, stage) {
        // Handle Ollama response format
        const content = typeof response === 'string' ? 
                        response : 
                        (response.message?.content || response.response || '');
        
        // Attempt JSON parsing
        try {
            // Handle ```json blocks
            let jsonStr = content;
            
            if (content.includes('```json')) {
                const start = content.indexOf('```json') + 7;
                const end = content.indexOf('```', start);
                if (end > start) {
                    jsonStr = content.substring(start, end);
                }
            } else if (content.includes('```')) {
                const start = content.indexOf('```') + 3;
                const end = content.indexOf('```', start);
                if (end > start) {
                    jsonStr = content.substring(start, end);
                }
            }
            
            const parsed = JSON.parse(jsonStr.trim());
            
            return {
                ...parsed,
                _meta: {
                    parsed: true,
                    stageId: stage.id,
                    model: stage.model,
                    rawLength: content.length
                }
            };
            
        } catch (error) {
            // Return structured error with raw content
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
        const routerResponse = await executor._callOllama(
            'qwen3-vl:8B',
            routerMessages,
            promptRegistry.getOptions('SYS_ROUTER_V1')
        );
        
        classificationResult = executor._parseResponse(routerResponse, {
            id: 'router',
            model: 'qwen3-vl:8B'
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

module.exports = {
    ExpertPipelineExecutor,
    ExecutionContext,
    ConditionEvaluator,
    ValidationEngine,
    processDocument
};
