/**
 * General/Fallback Document Processing Pipeline
 * REFINED: Added guidanceTemplate strings for structured extraction.
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
            guidanceTemplate: 'general_extractor',
            promptId: 'GEN_FALLBACK_V1',
            model: MODEL_NAMES.general,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.enhanced_ocr_text',
                filename: 'document.filename'
            },
            outputKey: 'general_extraction',
            timeout: 45000,
            retryCount: 2
        },
        {
            id: 'cross_pipeline_router',
            name: 'Cross Pipeline Routing',
            type: StageType.REASONING,
            guidanceTemplate: 'cross_pipeline_router',
            model: MODEL_NAMES.general,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                doc_type: 'stages.general_extraction.output.typ',
                summary: 'stages.general_extraction.output.zusammenfassung'
            },
            outputKey: 'routing_recommendation',
            timeout: 30000
        }
    ]
};

module.exports = { GeneralPipeline };