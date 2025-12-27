/**
 * Financial Document Processing Pipeline
 *
 * Handles:
 * - Invoices and receipts
 * - Bank statements
 * - Tax documents
 * - Contracts with financial terms
 */

const { DomainType, ModelType } = require('../../prompts/PromptRegistry');
const { StageType, ExecutionMode } = require('./constants');
const { MODEL_NAMES } = require('./models');

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
                field: 'context.vat_complex',
                operator: 'equals',
                value: true
            },
            injectVatContext: true,
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

module.exports = { FinancialPipeline };
