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

const { DomainType, ModelType } = require('../../prompts/PromptRegistry');
const { StageType, ExecutionMode } = require('./constants');
const { MODEL_NAMES } = require('./models');

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
            guidanceTemplate: 'medical_classifier',
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
            guidanceTemplate: 'medical_extractor',
            promptId: 'MED_DOCTOR_V1',
            model: MODEL_NAMES.medicalText,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.enhanced_ocr_text',
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
            guidanceTemplate: 'medical_integrator',
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
                text_chunk: 'document.enhanced_ocr_text',
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

module.exports = { MedicalPipeline };
