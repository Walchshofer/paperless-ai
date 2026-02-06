/**
 * Legal Document Processing Pipeline
 * REFINED: Added guidanceTemplate strings for structured extraction.
 */

const { DomainType, ModelType } = require('../../prompts/PromptRegistry');
const { StageType, ExecutionMode } = require('./constants');
const { MODEL_NAMES } = require('./models');

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

    confidenceThreshold: 0.8,
    timeoutMs: 90000,

    stages: [
        {
            id: 'parallel_ocr',
            name: 'Parallel OCR',
            type: StageType.TEXT_EXTRACTION,
            useParallelOcr: true,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {},
            outputKey: 'ocr',
            timeout: 30000,
            retryCount: 1
        },
        {
            id: 'legal_orchestrator',
            name: 'Legal Orchestrator',
            type: StageType.CLASSIFICATION,
            guidanceTemplate: 'legal_classifier',
            promptId: 'LEGAL_ORCHESTRATOR_V1',
            model: MODEL_NAMES.orchestrator || MODEL_NAMES.router,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.enhanced_ocr_text'
            },
            outputKey: 'legal_orchestration'
        },
        {
            id: 'legal_extraction',
            name: 'Legal Extraction',
            type: StageType.TEXT_EXTRACTION,
            guidanceTemplate: 'legal_extractor',
            promptId: 'LEGAL_EXTRACTOR_V1',
            model: MODEL_NAMES.legalExpert,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            injectLegalContext: true,
            inputMapping: {
                text_chunk: 'document.enhanced_ocr_text'
            },
            outputKey: 'legal_extraction',
            timeout: 60000
        },
        {
            id: 'legal_validation',
            name: 'Legal Validation',
            type: StageType.VALIDATION,
            guidanceTemplate: 'legal_validator',
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
        },
        {
            id: 'visual_query_generation',
            name: 'Visual Query Generation',
            type: StageType.VISUAL_QUERY_GENERATION,
            guidanceTemplate: 'legal_extractor',
            promptId: 'VISUAL_QUERY_GENERATOR_V1',
            model: MODEL_NAMES.legalExpert,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                extraction: 'stages.legal_extraction.output',
                ocr: 'stages.ocr.output',
                validation: 'stages.validation_result.output'
            },
            outputKey: 'visual_queries',
            timeout: 10000,
            retryCount: 2
        },
        {
            id: 'visual_query_execution',
            name: 'Visual Query Execution',
            type: StageType.VISUAL_QUERY_EXECUTION,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                visual_queries: 'stages.visual_queries.output',
                extraction: 'stages.legal_extraction.output'
            },
            outputKey: 'visual_execution',
            timeout: 30000,
            retryCount: 1,
            executorConfig: {
                timeoutBudget: 500,
                hardTimeout: 1000,
                maxConcurrentQueries: 5,
                ocrFallbackEnabled: true,
                ocrFallbackConfidenceThreshold: 0.7,
                ocrCrossValidationEnabled: true
            }
        }
    ]
};

module.exports = { LegalPipeline };
