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
 * - Medical Imaging: llava-med-v1.5:latest (multimodal)
 * - Medical Text: medtext-llama3:latest (text-only)
 * - Finance Reasoning: fino1-8b (text-only)
 * - Finance General: llm-pro-finance-8b (text-only)
 * - General Fallback: sauerkraut-llama3.1:8b (text-only)
 */

const logger = require('../logger');
const config = require('../../config/config');
const { DomainType, ModelType } = require('../prompts/PromptRegistry');

const MODEL_NAMES = Object.freeze({
    router: process.env.ROUTER_MODEL || config.ollama?.visionModel || 'qwen3-vl:8b',
    medicalImaging: process.env.MEDICAL_IMAGING_MODEL || config.expertModels?.medical?.radiology || 'llava-med-v1.5',
    medicalText: process.env.MEDICAL_TEXT_MODEL || config.expertModels?.medical?.analysis || 'medtext-llama3',
    general: process.env.GENERAL_MODEL || config.ollama?.model || 'sauerkraut-llama3.1:8b',
    financeReasoning: process.env.FINANCE_REASONING_MODEL || 'fino1-8b',
    financeGeneral: process.env.FINANCE_GENERAL_MODEL || 'llm-pro-finance-8b',
    vatExpert: process.env.VAT_EXPERT_MODEL || process.env.FINANCE_GENERAL_MODEL || 'llm-pro-finance-8b'
});

// ============================================================================
// PIPELINE STAGE DEFINITIONS
// ============================================================================

/**
 * Pipeline stage types - ordered execution within a pipeline
 */
const StageType = Object.freeze({
    CLASSIFICATION: 'classification',    // Initial document routing
    VISUAL_ANALYSIS: 'visual_analysis',  // Image/visual processing
    TEXT_EXTRACTION: 'text_extraction',  // Text content extraction
    ENTITY_RECOGNITION: 'entity_recognition', // NER for domain entities
    REASONING: 'reasoning',              // Domain-specific inference
    INTEGRATION: 'integration',          // Multi-source data fusion
    VALIDATION: 'validation',            // Output quality checks
    RECOVERY: 'recovery'                 // Error recovery attempts
});

/**
 * Execution modes for pipeline stages
 */
const ExecutionMode = Object.freeze({
    SEQUENTIAL: 'sequential',   // Stages run in order, output feeds next
    PARALLEL: 'parallel',       // Stages run concurrently where possible
    CONDITIONAL: 'conditional', // Stage runs based on prior stage output
    FALLBACK: 'fallback'        // Stage runs only if prior stage fails
});

// ============================================================================
// PIPELINE DEFINITIONS
// ============================================================================

/**
 * Medical Document Processing Pipeline
 * 
 * Handles:
 * - Medical imaging (X-rays, CT, MRI, ultrasound)
 * - Clinical documents (notes, reports, prescriptions)
 * - Lab results and pathology reports
 * - Insurance/billing documents with medical content
 * 
 * Pipeline Flow:
 * 1. Visual Analysis (if imaging) → llava-med-v1.5:latest
 * 2. Text Extraction → medtext-llama3:latest
 * 3. Integration → medtext-llama3:latest
 * 4. Validation → confidence checks
 * 5. Recovery (if needed) → fallback extraction
 */
const MedicalPipeline = {
    id: 'PIPELINE_MEDICAL_V1',
    name: 'Medical Document Pipeline',
    version: '1.0.0',
    domain: DomainType.MEDICAL,
    description: 'Comprehensive medical document analysis including imaging and clinical text',
    
    // Document types this pipeline handles
    documentTypes: [
        'xray', 'ct_scan', 'mri', 'ultrasound', 'mammogram',
        'clinical_note', 'progress_note', 'discharge_summary',
        'prescription', 'medication_list', 'lab_report',
        'pathology_report', 'radiology_report', 'operative_note',
        'referral', 'consultation', 'insurance_claim', 'eob'
    ],
    
    // Confidence threshold for accepting results
    confidenceThreshold: 0.7,
    
    // Maximum execution time (ms) before timeout
    timeoutMs: 120000,
    
    // Pipeline stages in execution order
    stages: [
        {
            id: 'medical_visual',
            name: 'Medical Visual Analysis',
            type: StageType.VISUAL_ANALYSIS,
            promptId: 'MED_RADIOLOGY_V1',
            model: MODEL_NAMES.medicalImaging,
            modelType: ModelType.MULTIMODAL,
            executionMode: ExecutionMode.CONDITIONAL,
            condition: {
                // Only run if document has visual component
                field: 'routing.requires_visual_analysis',
                operator: 'equals',
                value: true
            },
            inputMapping: {
                image: 'document.image_data',
                modality: 'classification.document_type',
                body_region: 'classification.metadata_hints.body_region',
                clinical_indication: 'context.clinical_indication'
            },
            outputKey: 'imaging_analysis',
            timeout: 60000,
            retryCount: 1
        },
        {
            id: 'medical_text',
            name: 'Medical Text Extraction',
            type: StageType.TEXT_EXTRACTION,
            promptId: 'MED_DOCTOR_V1',
            model: MODEL_NAMES.medicalText,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.ocr_text',
                document_type: 'classification.document_type',
                source_system: 'document.source',
                document_date: 'classification.metadata_hints.detected_date'
            },
            outputKey: 'text_extraction',
            timeout: 45000,
            retryCount: 2
        },
        {
            id: 'medical_integration',
            name: 'Medical Data Integration',
            type: StageType.INTEGRATION,
            promptId: 'MED_INTEGRATOR_V1',
            model: MODEL_NAMES.medicalText,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                imaging_analysis: 'stages.medical_visual.output',
                text_extraction: 'stages.medical_text.output',
                prior_context: 'context.prior_records'
            },
            outputKey: 'integrated_record',
            timeout: 30000,
            retryCount: 1
        },
        {
            id: 'medical_validation',
            name: 'Output Validation',
            type: StageType.VALIDATION,
            promptId: null,  // Uses built-in validation logic
            model: null,
            executionMode: ExecutionMode.SEQUENTIAL,
            validationRules: [
                {
                    field: 'integrated_record.confidence_summary.overall_confidence',
                    operator: 'gte',
                    value: 0.7,
                    errorMessage: 'Overall confidence below threshold'
                },
                {
                    field: 'integrated_record.unified_record.conditions',
                    operator: 'not_empty',
                    errorMessage: 'No conditions extracted from medical document'
                }
            ],
            outputKey: 'validation_result',
            timeout: 5000
        },
        {
            id: 'medical_recovery',
            name: 'Error Recovery',
            type: StageType.RECOVERY,
            promptId: 'GEN_FALLBACK_V1',
            model: MODEL_NAMES.general,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.FALLBACK,
            triggerCondition: {
                // Run if validation failed or confidence too low
                anyOf: [
                    { field: 'validation_result.valid', operator: 'equals', value: false },
                    { field: 'integrated_record.confidence_summary.overall_confidence', operator: 'lt', value: 0.5 }
                ]
            },
            inputMapping: {
                text_chunk: 'document.ocr_text',
                filename: 'document.filename',
                source_system: 'document.source',
                ocr_quality: 'document.ocr_quality'
            },
            outputKey: 'recovery_extraction',
            timeout: 30000,
            retryCount: 1
        }
    ],
    
    // Output schema for pipeline result
    outputSchema: {
        type: 'object',
        required: ['pipeline_id', 'status', 'result', 'metadata'],
        properties: {
            pipeline_id: { type: 'string' },
            status: { type: 'string', enum: ['success', 'partial', 'failed'] },
            result: { type: 'object' },
            metadata: {
                type: 'object',
                properties: {
                    execution_time_ms: { type: 'number' },
                    stages_executed: { type: 'array' },
                    confidence: { type: 'number' }
                }
            }
        }
    }
};

/**
 * Financial Document Processing Pipeline
 *
 * Handles:
 * - Invoices and receipts
 * - Bank statements
 * - Tax documents
 * - Contracts with financial terms
 */
const FinancialPipeline = {
    id: 'PIPELINE_FINANCIAL_V1',
    name: 'Financial Document Pipeline',
    version: '1.0.0',
    domain: DomainType.FINANCIAL,
    description: 'Financial document analysis for invoices, statements, and fiscal documents',
    
    documentTypes: [
        'invoice', 'receipt', 'bank_statement', 'credit_card_statement',
        'tax_form', 'w2', '1099', 'pay_stub', 'expense_report',
        'purchase_order', 'quote', 'contract_financial'
    ],
    
    confidenceThreshold: 0.75,
    timeoutMs: 90000,
    
    stages: [
        {
            id: 'financial_visual',
            name: 'Financial Document Visual Analysis',
            type: StageType.VISUAL_ANALYSIS,
            promptId: 'SYS_ROUTER_V1',  // Reuse router for visual extraction
            model: MODEL_NAMES.router,
            modelType: ModelType.MULTIMODAL,
            executionMode: ExecutionMode.CONDITIONAL,
            condition: {
                field: 'routing.requires_visual_analysis',
                operator: 'equals',
                value: true
            },
            inputMapping: {
                image: 'document.image_data',
                source_system: 'document.source',
                filename: 'document.filename'
            },
            outputKey: 'visual_analysis',
            timeout: 45000,
            retryCount: 1
        },
        {
            id: 'financial_extraction',
            name: 'Financial Data Extraction',
            type: StageType.TEXT_EXTRACTION,
            promptId: 'FIN_EXTRACT_V1',
            model: MODEL_NAMES.financeGeneral,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.ocr_text',
                filename: 'document.filename',
                source_system: 'document.source',
                ocr_quality: 'document.ocr_quality',
                document_type: 'classification.document_type'
            },
            outputKey: 'financial_extraction',
            timeout: 45000,
            retryCount: 2
        },
        {
            id: 'financial_reasoning',
            name: 'Financial Reasoning & Consistency',
            type: StageType.REASONING,
            promptId: 'FIN_REASONER_V1',
            model: MODEL_NAMES.financeReasoning,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                extracted_data: 'stages.financial_extraction.output',
                text_chunk: 'document.ocr_text'
            },
            outputKey: 'financial_reasoning',
            timeout: 45000,
            retryCount: 1
        },
        {
            id: 'financial_vat_expert',
            name: 'VAT Expert Review',
            type: StageType.REASONING,
            promptId: 'FIN_VAT_EXPERT_V1',
            model: MODEL_NAMES.vatExpert,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.CONDITIONAL,
            condition: {
                field: 'context.vat_context',
                operator: 'not_empty'
            },
            inputMapping: {
                vat_context: 'context.vat_context',
                text_chunk: 'document.ocr_text'
            },
            outputKey: 'financial_vat_analysis',
            timeout: 45000,
            retryCount: 1
        },
        {
            id: 'financial_validation',
            name: 'Financial Validation',
            type: StageType.VALIDATION,
            promptId: null,
            model: null,
            executionMode: ExecutionMode.SEQUENTIAL,
            validationRules: [
                {
                    field: 'financial_extraction.confidence.overall',
                    operator: 'gte',
                    value: 0.75,
                    errorMessage: 'Extraction confidence below threshold'
                },
                {
                    field: 'financial_extraction.amounts.total',
                    operator: 'exists',
                    errorMessage: 'No total amount extracted'
                }
            ],
            outputKey: 'validation_result',
            timeout: 5000
        }
    ],
    
    outputSchema: {
        type: 'object',
        required: ['pipeline_id', 'status', 'result'],
        properties: {
            pipeline_id: { type: 'string' },
            status: { type: 'string', enum: ['success', 'partial', 'failed'] },
            result: { type: 'object' }
        }
    }
};

/**
 * Legal Document Processing Pipeline
 * 
 * Handles:
 * - Contracts and agreements
 * - Legal correspondence
 * - Court documents
 * - Regulatory filings
 * 
 * Note: Uses general-purpose models until specialized legal models added
 */
const LegalPipeline = {
    id: 'PIPELINE_LEGAL_V1',
    name: 'Legal Document Pipeline',
    version: '1.0.0',
    domain: DomainType.LEGAL,
    description: 'Legal document analysis for contracts, agreements, and legal correspondence',
    
    documentTypes: [
        'contract', 'agreement', 'nda', 'lease', 'employment_agreement',
        'legal_letter', 'demand_letter', 'court_filing', 'subpoena',
        'power_of_attorney', 'will', 'trust', 'regulatory_filing'
    ],
    
    confidenceThreshold: 0.8,  // Higher threshold for legal accuracy
    timeoutMs: 90000,
    
    stages: [
        {
            id: 'legal_extraction',
            name: 'Legal Text Extraction',
            type: StageType.TEXT_EXTRACTION,
            promptId: 'GEN_FALLBACK_V1',  // TODO: Replace with LEGAL_EXTRACTOR_V1
            model: MODEL_NAMES.general,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.ocr_text',
                filename: 'document.filename',
                source_system: 'document.source',
                ocr_quality: 'document.ocr_quality'
            },
            outputKey: 'legal_extraction',
            timeout: 60000,
            retryCount: 2
        },
        {
            id: 'legal_validation',
            name: 'Legal Validation',
            type: StageType.VALIDATION,
            promptId: null,
            model: null,
            executionMode: ExecutionMode.SEQUENTIAL,
            validationRules: [
                {
                    field: 'legal_extraction.confidence.overall',
                    operator: 'gte',
                    value: 0.8,
                    errorMessage: 'Extraction confidence below legal threshold'
                }
            ],
            outputKey: 'validation_result',
            timeout: 5000
        }
    ],
    
    outputSchema: {
        type: 'object',
        required: ['pipeline_id', 'status', 'result'],
        properties: {
            pipeline_id: { type: 'string' },
            status: { type: 'string', enum: ['success', 'partial', 'failed'] },
            result: { type: 'object' }
        }
    }
};

/**
 * General/Fallback Document Processing Pipeline
 * 
 * Handles:
 * - Unclassified documents
 * - Personal correspondence
 * - Mixed-content documents
 * - Any document that doesn't match specialized pipelines
 */
const GeneralPipeline = {
    id: 'PIPELINE_GENERAL_V1',
    name: 'General Document Pipeline',
    version: '1.0.0',
    domain: DomainType.GENERAL,
    description: 'General-purpose document analysis for unclassified or mixed documents',
    
    documentTypes: [
        'letter', 'memo', 'email', 'note', 'form',
        'report', 'presentation', 'spreadsheet', 'unknown'
    ],
    
    confidenceThreshold: 0.6,
    timeoutMs: 60000,
    
    stages: [
        {
            id: 'general_extraction',
            name: 'General Extraction',
            type: StageType.TEXT_EXTRACTION,
            promptId: 'GEN_FALLBACK_V1',
            model: MODEL_NAMES.general,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.ocr_text',
                filename: 'document.filename',
                source_system: 'document.source',
                ocr_quality: 'document.ocr_quality'
            },
            outputKey: 'general_extraction',
            timeout: 45000,
            retryCount: 2
        },
        {
            id: 'general_validation',
            name: 'General Validation',
            type: StageType.VALIDATION,
            promptId: null,
            model: null,
            executionMode: ExecutionMode.SEQUENTIAL,
            validationRules: [
                {
                    field: 'general_extraction.confidence.overall',
                    operator: 'gte',
                    value: 0.6,
                    errorMessage: 'Extraction confidence below minimum threshold'
                }
            ],
            outputKey: 'validation_result',
            timeout: 5000
        }
    ],
    
    outputSchema: {
        type: 'object',
        required: ['pipeline_id', 'status', 'result'],
        properties: {
            pipeline_id: { type: 'string' },
            status: { type: 'string', enum: ['success', 'partial', 'failed'] },
            result: { type: 'object' }
        }
    }
};

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
        
        // Register built-in pipelines
        this._registerBuiltinPipelines();
    }
    
    _registerBuiltinPipelines() {
        this.register(MedicalPipeline);
        this.register(FinancialPipeline);
        this.register(LegalPipeline);
        this.register(GeneralPipeline);
        
        logger.info(`ExpertRegistry initialized with ${this.pipelines.size} pipelines`);
    }
    
    /**
     * Register a pipeline
     */
    register(pipeline) {
        if (!pipeline.id || !pipeline.domain || !pipeline.stages) {
            throw new Error('Invalid pipeline registration: missing required fields');
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
        
        // Index by domain
        const domainPipelines = this.domainIndex.get(pipeline.domain) || [];
        domainPipelines.push(pipeline.id);
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
        const { classification, routing, quality_assessment } = classificationResult;
        
        // Extract routing signals
        const domain = classification?.primary_domain || 'General';
        const documentType = classification?.document_type?.toLowerCase() || 'unknown';
        const confidence = classification?.confidence || 0;
        
        let selectedPipeline = null;
        let routingReason = '';
        
        // Strategy 1: Direct document type match
        if (this.documentTypeIndex.has(documentType)) {
            const pipelineId = this.documentTypeIndex.get(documentType);
            selectedPipeline = this.get(pipelineId);
            routingReason = `Direct document type match: ${documentType}`;
        }
        
        // Strategy 2: Domain-based routing
        if (!selectedPipeline) {
            const domainEnum = this._mapDomainString(domain);
            const domainPipelines = this.domainIndex.get(domainEnum) || [];
            
            if (domainPipelines.length > 0) {
                // Select first matching domain pipeline
                selectedPipeline = this.get(domainPipelines[0]);
                routingReason = `Domain-based routing: ${domain}`;
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
}

// Singleton instance
const expertRegistry = new ExpertRegistry();

module.exports = {
    expertRegistry,
    ExpertRegistry,
    StageType,
    ExecutionMode,
    // Export pipeline definitions for direct access
    MedicalPipeline,
    FinancialPipeline,
    LegalPipeline,
    GeneralPipeline
};
