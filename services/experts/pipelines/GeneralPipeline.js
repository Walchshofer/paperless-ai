/**
 * General/Fallback Document Processing Pipeline
 *
 * Handles:
 * - Unclassified documents
 * - Personal correspondence
 * - Mixed-content documents
 * - Any document that doesn't match specialized pipelines
 */

const { DomainType, ModelType } = require('../../prompts/PromptRegistry');
const { StageType, ExecutionMode } = require('./constants');
const { MODEL_NAMES } = require('./models');

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

module.exports = { GeneralPipeline };
