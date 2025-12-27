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

    confidenceThreshold: 0.8,  // Higher threshold for legal accuracy
    timeoutMs: 90000,

    stages: [
        {
            id: 'legal_orchestrator',
            name: 'Legal Orchestrator',
            type: StageType.CLASSIFICATION,
            promptId: 'LEGAL_ORCHESTRATOR_V1',
            model: MODEL_NAMES.router,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.ocr_text',
                filename: 'document.filename',
                source_system: 'document.source'
            },
            outputKey: 'legal_orchestration',
            timeout: 15000,
            retryCount: 1,
            unloadAfter: true
        },
        {
            id: 'legal_extraction',
            name: 'Legal Text Extraction',
            type: StageType.TEXT_EXTRACTION,
            promptId: 'LEGAL_EXTRACTOR_V1',
            model: MODEL_NAMES.legalExpert,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            injectLegalContext: true,
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

module.exports = { LegalPipeline };
