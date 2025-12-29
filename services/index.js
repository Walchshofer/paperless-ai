/**
 * services/index.js
 * 
 * Central Service Registry and Export Hub
 * Integrates Expert Model Pipeline with existing paperless-ngx AI services.
 * 
 * Architecture Reference: Expert Model Pipeline Design, Section 6
 * 
 * Service Hierarchy:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                         SERVICE REGISTRY                                    │
 * │                                                                             │
 * │  ┌─────────────────────────────────────────────────────────────────────┐   │
 * │  │                     CORE SERVICES                                    │   │
 * │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
 * │  │  │  Logger  │  │  Config  │  │  Ollama  │  │ Paperless│            │   │
 * │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
 * │  └─────────────────────────────────────────────────────────────────────┘   │
 * │                                    │                                        │
 * │  ┌─────────────────────────────────▼───────────────────────────────────┐   │
 * │  │                   EXPERT PIPELINE SERVICES                          │   │
 * │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
 * │  │  │ Prompts  │  │ Experts  │  │ Pipeline │  │ Document │            │   │
 * │  │  │ Registry │  │ Registry │  │ Executor │  │ Processor│            │   │
 * │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
 * │  └─────────────────────────────────────────────────────────────────────┘   │
 * │                                    │                                        │
 * │  ┌─────────────────────────────────▼───────────────────────────────────┐   │
 * │  │                     LEGACY SERVICES                                  │   │
 * │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
 * │  │  │  Vision  │  │   Text   │  │ Classify │  │  Utils   │            │   │
 * │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
 * │  └─────────────────────────────────────────────────────────────────────┘   │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 *   const services = require('./services');
 *   
 *   // Initialize with Ollama service
 *   const processor = services.createDocumentProcessor(ollamaService);
 *   
 *   // Process a document
 *   const result = await processor.process(document);
 *   
 *   // Or use individual components
 *   const { promptRegistry, expertRegistry } = services;
 */

// ============================================================================
// CORE DEPENDENCIES
// ============================================================================

const logger = require('./logger');
const config = require('../config/config');

// ============================================================================
// PROMPT SYSTEM
// ============================================================================

// NOTE: PromptRegistry is the authoritative prompt management API. PromptFactory
// is intentionally excluded from exports and not re-exported here. PromptFactory
// remains in the repo for legacy Ollama compatibility but should not be used by
// new or migrated code.
const { 
    PromptRegistry, 
    promptRegistry,
    DomainType,
    ModelType,
    PromptCategory 
} = require('./prompts/PromptRegistry');

const { 
    registerMedicalPrompts,
    MedicalDocumentTypes,
    MedicalExtractionFields 
} = require('./prompts/MedicalPrompts');

// ============================================================================
// EXPERT SYSTEM
// ============================================================================

const { 
    ExpertRegistry, 
    expertRegistry 
} = require('./experts/ExpertRegistry');

const { 
    ExpertPipelineExecutor,
    processDocument,
    createPipelineExecutor 
} = require('./experts/ExpertPipelineExecutor');

// ============================================================================
// INTEGRATION LAYER
// ============================================================================

const {
    DocumentProcessor,
    ImagePreparator,
    ResultMerger,
    createDocumentProcessor,
    createProcessingMiddleware,
    createClassificationMiddleware,
    ProcessorConfig
} = require('./integration/DocumentProcessor');

// ============================================================================
// TOOLING
// ============================================================================

const { paperlessApiTools } = require('./tools');

// ============================================================================
// LEGACY SERVICES (existing)
// ============================================================================

// These are the existing services that the expert pipeline integrates with
let legacyVision = null;
let legacyText = null;
let legacyClassify = null;

try {
    legacyVision = require('./ollama/vision');
} catch (e) {
    logger.debug('Legacy vision service not available');
}

try {
    legacyText = require('./ollama/text');
} catch (e) {
    logger.debug('Legacy text service not available');
}

// Legacy classify service not implemented in current codebase

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

/**
 * Initialize all expert pipeline services
 * Should be called once during application startup
 * 
 * @param {Object} options - Initialization options
 * @returns {Object} Initialized service references
 */


function initializeExpertPipeline(options = {}) {
    const initStart = Date.now();
    
    logger.info('Initializing Expert Pipeline services...');
    
    // Ensure registries return sensible defaults to avoid TypeErrors
    const safePromptList = (promptRegistry && typeof promptRegistry.list === 'function') ? promptRegistry.list() || [] : [];
    const safePipelines = (expertRegistry && typeof expertRegistry.list === 'function') ? expertRegistry.list() || [] : [];

    // Register builtin prompts unless explicitly disabled
    if (options.registerBuiltinPrompts !== false && promptRegistry && typeof promptRegistry._registerBuiltinPrompts === 'function') {
        try {
            promptRegistry._registerBuiltinPrompts();
        } catch (err) {
            logger.warn('Failed to register built-in prompts:', err);
        }
        logger.info(`Built-in prompts registered: ${safePromptList.length}`);
    }

    // Register medical prompts if enabled
    if (options.enableMedical !== false && typeof registerMedicalPrompts === 'function') {
        try {
            registerMedicalPrompts(promptRegistry);
        } catch (err) {
            logger.warn('Failed to register medical prompts:', err);
        }
        logger.info(`Registered ${safePromptList.length} prompts`);
    }
    
    // Log registered pipelines
    logger.info(`Available pipelines: ${safePipelines.map(p => p && p.id).filter(Boolean).join(', ')}`);
    
    // Log pipeline details
    for (const pipeline of safePipelines) {
        logger.debug(`Pipeline ${pipeline && pipeline.id}:`, {
            name: pipeline && pipeline.name,
            stages: pipeline && pipeline.stageCount,
            domain: pipeline && pipeline.domain
        });
    }
    
    const initTime = Date.now() - initStart;
    logger.info(`Expert Pipeline initialization complete in ${initTime}ms`);
    
    return {
        promptRegistry,
        expertRegistry,
        initializationTime: initTime,
        promptCount: safePromptList.length,
        pipelineCount: safePipelines.length
    };
}

/**
 * Create a fully configured service container
 * 
 * @param {Object} ollamaService - Ollama service instance
 * @param {Object} options - Configuration options
 * @returns {Object} Service container with all components
 */
function createServiceContainer(ollamaService, options = {}) {
    // Initialize pipeline components
    const initResult = initializeExpertPipeline(options);
    
    // Create document processor
    const documentProcessor = createDocumentProcessor(ollamaService, options);
    
    // Create pipeline executor for direct access
    const pipelineExecutor = createPipelineExecutor(ollamaService, options);
    
    return {
        // Main processor
        documentProcessor,
        
        // Direct component access
        pipelineExecutor,
        promptRegistry,
        expertRegistry,
        
        // Utilities
        ImagePreparator,
        ResultMerger,
        
        // Legacy services (if available)
        legacy: {
            vision: legacyVision,
            text: legacyText,
            classify: legacyClassify
        },
        
        // Metadata
        initialized: true,
        initializationTime: initResult.initializationTime,
        
        // Convenience methods
        process: (doc, opts) => documentProcessor.process(doc, opts),
        classify: (doc, opts) => documentProcessor.classify(doc, opts),
        healthCheck: () => documentProcessor.healthCheck(),
        getStats: () => documentProcessor.getStats()
    };
}

// ============================================================================
// EXPRESS ROUTER FACTORY
// ============================================================================

/**
 * Create Express router with all expert pipeline endpoints
 * 
 * @param {Object} documentProcessor - DocumentProcessor instance
 * @returns {express.Router} Configured router
 */
function createExpertPipelineRouter(documentProcessor) {
    const express = require('express');
    const router = express.Router();
    
    /**
     * POST /process
     * Process a document through the expert pipeline
     */
    router.post('/process', createProcessingMiddleware(documentProcessor));
    
    /**
     * POST /classify
     * Classify a document without full processing
     */
    router.post('/classify', createClassificationMiddleware(documentProcessor));
    
    /**
     * GET /health
     * Health check endpoint
     */
    router.get('/health', async (req, res) => {
        try {
            const health = await documentProcessor.healthCheck();
            const statusCode = health.status === 'healthy' ? 200 : 
                              health.status === 'degraded' ? 200 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                error: error.message
            });
        }
    });
    
    /**
     * GET /stats
     * Get processing statistics
     */
    router.get('/stats', (req, res) => {
        const stats = documentProcessor.getStats();
        res.json(stats);
    });
    
    /**
     * GET /pipelines
     * List available pipelines
     */
    router.get('/pipelines', (req, res) => {
        const pipelines = expertRegistry.list().map(p => ({
            id: p.id,
            name: p.name,
            domain: p.domain,
            version: p.version,
            stages: p.stages.length
        }));
        res.json({ pipelines });
    });
    
    /**
     * GET /prompts
     * List registered prompts
     */
    router.get('/prompts', (req, res) => {
        const prompts = promptRegistry.list().map(p => ({
            id: p.id,
            domain: p.domain,
            model: p.model,
            category: p.category,
            version: p.version
        }));
        res.json({ prompts });
    });
    
    /**
     * POST /recommend
     * Get pipeline recommendation for a document
     */
    router.post('/recommend', async (req, res, next) => {
        try {
            const document = req.body.document || req.body;
            const recommendation = await documentProcessor.recommendPipeline(document);
            res.json({
                success: true,
                recommendation
            });
        } catch (error) {
            next(error);
        }
    });
    
    return router;
}

// ============================================================================
// WEBHOOK HANDLER FACTORY
// ============================================================================

/**
 * Create webhook handler for paperless-ngx document events
 * 
 * @param {Object} documentProcessor - DocumentProcessor instance
 * @param {Object} options - Handler options
 * @returns {Function} Webhook handler function
 */
function createWebhookHandler(documentProcessor, options = {}) {
    const {
        autoProcess = true,
        processingMode = 'hybrid',
        onSuccess = null,
        onError = null
    } = options;
    
    return async function webhookHandler(webhookData) {
        const { document_id, document, event_type } = webhookData;
        
        logger.info('Webhook received', {
            documentId: document_id,
            eventType: event_type
        });
        
        // Only process on document creation/update
        if (!['document_created', 'document_updated'].includes(event_type)) {
            logger.debug('Ignoring event type', { eventType: event_type });
            return { processed: false, reason: 'event_type_ignored' };
        }
        
        if (!autoProcess) {
            return { processed: false, reason: 'auto_process_disabled' };
        }
        
        try {
            const result = await documentProcessor.process(document, {
                mode: processingMode,
                context: {
                    webhook: true,
                    eventType: event_type
                }
            });
            
            if (onSuccess) {
                await onSuccess(result, webhookData);
            }
            
            return {
                processed: true,
                success: result.success,
                documentId: document_id,
                pipelineId: result.metadata?.pipelineId
            };
            
        } catch (error) {
            logger.error('Webhook processing failed', {
                documentId: document_id,
                error: error.message
            });
            
            if (onError) {
                await onError(error, webhookData);
            }
            
            return {
                processed: true,
                success: false,
                documentId: document_id,
                error: error.message
            };
        }
    };
}

// ============================================================================
// TYPE DEFINITIONS (for documentation)
// ============================================================================

/**
 * @typedef {Object} ProcessingResult
 * @property {boolean} success - Whether processing succeeded
 * @property {Object} result - Extracted data and classifications
 * @property {Object} paperless - Result formatted for paperless-ngx
 * @property {Object} metadata - Processing metadata
 */

/**
 * @typedef {Object} ClassificationResult
 * @property {string} primary_domain - Primary document domain
 * @property {string} document_type - Specific document type
 * @property {number} confidence - Classification confidence (0-1)
 * @property {Object} metadata_hints - Detected entities and hints
 */

/**
 * @typedef {Object} HealthCheckResult
 * @property {string} status - Overall status (healthy/degraded/unhealthy)
 * @property {Object} components - Component health details
 */

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // ========================
    // Core Services
    // ========================
    logger,
    config,
    
    // ========================
    // Prompt System
    // ========================
    PromptRegistry,
    promptRegistry,
    DomainType,
    ModelType,
    PromptCategory,
    registerMedicalPrompts,
    MedicalDocumentTypes,
    MedicalExtractionFields,
    
    // ========================
    // Expert System
    // ========================
    ExpertRegistry,
    expertRegistry,
    ExpertPipelineExecutor,
    processDocument,
    createPipelineExecutor,
    
    // ========================
    // Integration Layer
    // ========================
    DocumentProcessor,
    ImagePreparator,
    ResultMerger,
    createDocumentProcessor,
    createProcessingMiddleware,
    createClassificationMiddleware,
    ProcessorConfig,

    // ========================
    // Tooling
    // ========================
    paperlessApiTools,
    
    // ========================
    // Factory Functions
    // ========================
    initializeExpertPipeline,
    createServiceContainer,
    createExpertPipelineRouter,
    createWebhookHandler,
    
    // ========================
    // Legacy Services
    // ========================
    legacy: {
        vision: legacyVision,
        text: legacyText,
        classify: legacyClassify
    }
};

// ============================================================================
// QUICK START EXAMPLE (in comments for documentation)
// ============================================================================

/**
 * Quick Start Example:
 * 
 * ```javascript
 * const express = require('express');
 * const services = require('./services');
 * const ollamaService = require('./ollama'); // Your existing Ollama service
 * 
 * // Option 1: Use service container (recommended)
 * const container = services.createServiceContainer(ollamaService, {
 *     enableMedical: true
 * });
 * 
 * // Process a document
 * const result = await container.process({
 *     id: 'doc-123',
 *     filename: 'lab_results.pdf',
 *     content: 'Patient: John Doe...',
 *     image_path: '/path/to/image.png'
 * });
 * 
 * console.log(result.paperless); // Ready for paperless-ngx API
 * 
 * // Option 2: Use with Express
 * const app = express();
 * const router = services.createExpertPipelineRouter(container.documentProcessor);
 * app.use('/api/expert', router);
 * 
 * // Option 3: Use webhook handler
 * const webhookHandler = services.createWebhookHandler(container.documentProcessor, {
 *     autoProcess: true,
 *     processingMode: 'hybrid',
 *     onSuccess: async (result) => {
 *         // Update paperless-ngx with extracted data
 *         await updatePaperlessDocument(result.paperless);
 *     }
 * });
 * 
 * app.post('/webhook', async (req, res) => {
 *     const result = await webhookHandler(req.body);
 *     res.json(result);
 * });
 * ```
 */
