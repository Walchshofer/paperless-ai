/**
 * ExpertRegistry.js
 *
 * Domain Expert Pipeline Registration and Routing System.
 * Routes classified documents to appropriate expert model chains.
 *
 * Architecture Reference: Expert Model Pipeline Design, Section 3
 * Hardware Target: NVIDIA RTX 3090 Ti (24GB VRAM)
 *
 * Pipeline Architecture:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                         DOCUMENT INGESTION                              │
 * │                              ▼                                          │
 * │                    ┌─────────────────┐                                  │
 * │                    │  SYS_ROUTER_V1  │ (qwen3-vl:8b)                   │
 * │                    │  Classification │                                  │
 * │                    └────────┬────────┘                                  │
 * │                             │                                           │
 * │         ┌───────────────────┼───────────────────┐                      │
 * │         ▼                   ▼                   ▼                      │
 * │   ┌──────────┐       ┌──────────┐        ┌──────────┐                 │
 * │   │ MEDICAL  │       │FINANCIAL │        │  LEGAL   │                 │
 * │   │ Pipeline │       │ Pipeline │        │ Pipeline │                 │
 * │   └──────────┘       └──────────┘        └──────────┘                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Model Configuration:
 * - Router: qwen3-vl:8b (multimodal)
 * - Medical Imaging: llava-med-v1.6:latest (multimodal)
 * - Medical Text: medtext-llama3:latest (text-only)
 * - Finance Reasoning: llm-pro-finance-8b (text-only)
 * - Finance Calculator: fino1-8b (text-only)
 * - Finance General: llm-pro-finance-8b (text-only)
 * - General Fallback: sauerkraut-llama3.1:8b (text-only)
 */

const logger = require('../logger');
const { DomainType } = require('../prompts/PromptRegistry');
const { SemanticRouter } = require('./routing');

// Import pipeline definitions and constants from submodules
const { StageType, ExecutionMode } = require('./pipelines/constants');
const { MedicalPipeline } = require('./pipelines/MedicalPipeline');
const { FinancialPipeline } = require('./pipelines/FinancialPipeline');
const { LegalPipeline } = require('./pipelines/LegalPipeline');
const { GeneralPipeline } = require('./pipelines/GeneralPipeline');

// Re-export MODEL_NAMES from models.js for backwards compatibility
const { MODEL_NAMES: ModelNames } = require('./pipelines/models');

// ============================================================================
// EXPERT REGISTRY CLASS
// ============================================================================

/**
 * ExpertRegistry - Central registry for domain expert pipelines
 *
 * Responsibilities:
 * 1. Pipeline registration and lookup
 * 2. Document-to-pipeline routing based on classification
 * 3. Pipeline capability queries
 * 4. Model availability tracking
 */
class ExpertRegistry {
    constructor() {
        this.pipelines = new Map();
        this.documentTypeIndex = new Map();  // documentType -> pipelineId      
        this.domainIndex = new Map();        // domain -> [pipelineIds]
        this.semanticRouter = new SemanticRouter();

        // Register built-in pipelines
        this._registerBuiltinPipelines();
    }

    setSemanticRouter(router) {
        this.semanticRouter = router || this.semanticRouter;
    }

    getPipelines() {
        return Array.from(this.pipelines.values());
    }

    _registerBuiltinPipelines() {
        this.register(MedicalPipeline);
        this.register(FinancialPipeline);
        this.register(LegalPipeline);
        this.register(GeneralPipeline);

        logger.info(`ExpertRegistry initialized with ${this.pipelines.size} pipelines`);
    }

    /**
     * Find a pipeline that contains a stage with the specified stage id
     * @param {string} stageId
     * @returns {Object} pipeline
     */
    findPipelineByStageId(stageId) {
        const normalize = (s) => String(s || '').replace(/[-_]/g, '-');
        const target = normalize(stageId);
        for (const pipeline of this.pipelines.values()) {
            if ((pipeline.stages || []).some(s => normalize(s.id) === target)) {
                return pipeline;
            }
        }
        throw new Error(`Pipeline not found for stage: ${stageId}`);
    }

    /**
     * Register a pipeline
     */
    register(pipeline) {
        if (!pipeline.id || !pipeline.domain || !pipeline.stages || !Array.isArray(pipeline.stages) || pipeline.stages.length === 0) {
            throw new Error('Invalid pipeline registration: missing required fields or at least one stage required');
        }

        // Store pipeline
        this.pipelines.set(pipeline.id, {
            ...pipeline,
            registeredAt: Date.now()
        });

        // Index by document types
        for (const docType of pipeline.documentTypes || []) {
            this.documentTypeIndex.set(docType.toLowerCase(), pipeline.id);
        }

        // Index by domain and sort by priority (descending)
        const domainPipelines = this.domainIndex.get(pipeline.domain) || [];
        domainPipelines.push(pipeline.id);
        // Sort pipelines by priority (higher priority first)
        domainPipelines.sort((a, b) => {
            const pa = this.pipelines.get(a)?.priority || 0;
            const pb = this.pipelines.get(b)?.priority || 0;
            return pb - pa;
        });
        this.domainIndex.set(pipeline.domain, domainPipelines);

        logger.debug(`Registered pipeline: ${pipeline.id} (${pipeline.domain})`);
    }

    /**
     * Get a pipeline by ID
     */
    get(pipelineId) {
        const pipeline = this.pipelines.get(pipelineId);
        if (!pipeline) {
            throw new Error(`Pipeline not found: ${pipelineId}`);
        }
        return pipeline;
    }

    /**
     * Route a document to appropriate pipeline based on classification result
     *
     * @param {Object} classificationResult - Output from SYS_ROUTER_V1
     * @returns {Object} Selected pipeline and routing metadata
     */
    route(classificationResult) {
        // Support being called with either a wrapper ({ classification }) or the classification object directly
        const classification = classificationResult.classification || classificationResult;
        const routing = classificationResult.routing;
        const quality_assessment = classificationResult.quality_assessment;

        // Extract routing signals
        const domain = classification?.primary_domain || 'General';
        const documentType = (classification?.document_type || classification?.document_type === 0) ? String(classification.document_type).toLowerCase() : 'unknown';
        const confidence = classification?.confidence || 0;

        let selectedPipeline = null;
        let routingReason = '';
        let matchedConditions = [];
        let evaluatedPipelines = [];

        const recommendedPipelineId = routing?.recommended_pipeline ||
            routing?.recommendedPipeline ||
            routing?.selected_pipeline ||
            routing?.selectedPipeline;
        if (recommendedPipelineId && this.pipelines.has(recommendedPipelineId)) {
            selectedPipeline = this.get(recommendedPipelineId);
            routingReason = `Orchestrator override: ${recommendedPipelineId}`;
            evaluatedPipelines.push(recommendedPipelineId);
            matchedConditions.push({
                type: 'orchestrator',
                value: recommendedPipelineId,
                pipelineId: recommendedPipelineId
            });
        }

        if (!selectedPipeline && this.semanticRouter.enabled) {
            const candidatePipelines = this.getPipelines();
            const routerFailed = !!(classificationResult && classificationResult._meta && classificationResult._meta.fallback);
            const modelAvailable = !(classificationResult && classificationResult._meta && classificationResult._meta.reason === 'model_not_available');

            const routed = this.semanticRouter.selectPipelineWithFallback(
                classificationResult,
                candidatePipelines,
                { routerFailed, modelAvailable }
            );

            if (routed) {
                selectedPipeline = routed;
                routingReason = 'Semantic routing selection';
                evaluatedPipelines = candidatePipelines.map((p) => p.id);
                matchedConditions.push({
                    type: 'semantic',
                    value: `${classification.primary_domain || 'General'}:${classification.confidence || 0}`,
                    pipelineId: routed.id
                });
            }
        }

        // Strategy 1: Direct document type match
        if (!selectedPipeline && this.documentTypeIndex.has(documentType)) {
            const pipelineId = this.documentTypeIndex.get(documentType);
            evaluatedPipelines.push(pipelineId);
            selectedPipeline = this.get(pipelineId);
            routingReason = `Direct document type match: ${documentType}`;
            matchedConditions.push({ type: 'document_type', value: documentType, pipelineId });
        }

        // Strategy 2: Domain-based routing
        if (!selectedPipeline) {
            const domainEnum = this._mapDomainString(domain);
            const domainPipelines = this.domainIndex.get(domainEnum) || [];
            evaluatedPipelines = evaluatedPipelines.concat(domainPipelines);
            logger.debug(`Domain-based pipelines for ${domainEnum}: ${JSON.stringify(domainPipelines)}`);

            if (domainPipelines.length > 0) {
                // Select first matching domain pipeline (sorted by priority)
                selectedPipeline = this.get(domainPipelines[0]);
                routingReason = `Domain-based routing: ${domain}`;
                matchedConditions.push({ type: 'domain', value: domain, pipelineIds: domainPipelines });
            }
        }

        // Strategy 3: Fallback to general pipeline
        if (!selectedPipeline) {
            selectedPipeline = this.get('PIPELINE_GENERAL_V1');
            routingReason = 'Fallback to general pipeline';
        }

        // Determine if visual processing is needed
        const requiresVisual = routing?.requires_visual_analysis ||
                               this._inferVisualRequirement(documentType, quality_assessment);

        // Log routing decision for analytics (per ADR-005)
        logger.info({
            event: 'pipeline_routing',
            document_type: documentType,
            domain: domain,
            confidence: confidence,
            selected_pipeline: selectedPipeline.id,
            reason: routingReason,
            requires_visual: requiresVisual
        });

        return {
            pipeline: selectedPipeline,
            routingMetadata: {
                selectedPipelineId: selectedPipeline.id,
                routingReason: routingReason,
                classificationConfidence: confidence,
                requiresVisualAnalysis: requiresVisual,
                documentType: documentType,
                domain: domain,
                matchedConditions,
                evaluatedPipelines,
                timestamp: Date.now()
            }
        };
    }

    /**
     * Map domain string to DomainType enum
     */
    _mapDomainString(domainStr) {
        const mapping = {
            'medical': DomainType.MEDICAL,
            'financial': DomainType.FINANCIAL,
            'legal': DomainType.LEGAL,
            'general': DomainType.GENERAL
        };
        return mapping[domainStr.toLowerCase()] || DomainType.GENERAL;
    }

    /**
     * Infer if visual processing is needed based on document type
     */
    _inferVisualRequirement(documentType, qualityAssessment) {
        // Document types that typically benefit from visual analysis
        const visualTypes = [
            'xray', 'ct_scan', 'mri', 'ultrasound', 'mammogram',
            'invoice', 'receipt', 'form', 'check', 'id_card'
        ];

        if (visualTypes.includes(documentType)) {
            return true;
        }

        // Check if quality assessment suggests visual would help
        if (qualityAssessment?.text_legibility === 'low') {
            return true;
        }

        return false;
    }

    /**
     * Get all models required by a pipeline
     */
    getRequiredModels(pipelineId) {
        const pipeline = this.get(pipelineId);
        const models = new Set();

        for (const stage of pipeline.stages) {
            if (stage.model) {
                models.add(stage.model);
            }
        }

        return Array.from(models);
    }

    /**
     * Check if a pipeline can handle a specific document type
     */
    canHandle(pipelineId, documentType) {
        const pipeline = this.get(pipelineId);
        return pipeline.documentTypes.includes(documentType.toLowerCase());
    }

    /**
     * Get all pipelines that can handle a document type
     */
    getPipelinesForType(documentType) {
        const docTypeLower = documentType.toLowerCase();
        const results = [];

        for (const pipeline of this.pipelines.values()) {
            if (pipeline.documentTypes.includes(docTypeLower)) {
                results.push(pipeline);
            }
        }

        // Always include general as fallback
        if (results.length === 0) {
            results.push(this.get('PIPELINE_GENERAL_V1'));
        }

        return results;
    }

    /**
     * Get pipeline stages filtered by execution mode
     */
    getStagesByMode(pipelineId, mode) {
        const pipeline = this.get(pipelineId);
        return pipeline.stages.filter(s => s.executionMode === mode);
    }

    /**
     * List all registered pipelines
     */
    list() {
        return Array.from(this.pipelines.values()).map(p => ({
            id: p.id,
            name: p.name,
            domain: p.domain,
            version: p.version,
            stageCount: p.stages.length,
            documentTypes: p.documentTypes.length
        }));
    }

    /**
     * Get pipeline statistics
     */
    getStats() {
        const stats = {
            totalPipelines: this.pipelines.size,
            byDomain: {},
            totalDocumentTypes: this.documentTypeIndex.size,
            totalStages: 0
        };

        for (const pipeline of this.pipelines.values()) {
            // Count by domain
            const domain = pipeline.domain;
            stats.byDomain[domain] = (stats.byDomain[domain] || 0) + 1;

            // Count stages
            stats.totalStages += pipeline.stages.length;
        }

        return stats;
    }

    /**
     * Get high-level status for /api/experts/status compatibility
     */
    getStatus() {
        return {
            status: 'healthy',
            pipelines: {
                total: this.pipelines.size,
                list: this.list()
            },
            stats: this.getStats()
        };
    }
}


// Singleton instance
const expertRegistry = new ExpertRegistry();

module.exports = {
    expertRegistry,
    ExpertRegistry,
    StageType,
    ExecutionMode,
    MODEL_NAMES: ModelNames,
    // Export pipeline definitions for direct access
    MedicalPipeline,
    FinancialPipeline,
    LegalPipeline,
    GeneralPipeline
};
