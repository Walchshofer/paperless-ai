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
            id: 'legal_orchestrator',
            name: 'Legal Orchestrator',
            type: StageType.CLASSIFICATION,
            guidanceTemplate: 'legal_classifier',
            promptId: 'LEGAL_ORCHESTRATOR_V1',
            model: MODEL_NAMES.router,
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
        }
    ]
};

module.exports = { LegalPipeline };