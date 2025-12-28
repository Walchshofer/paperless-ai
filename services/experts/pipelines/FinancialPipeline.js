/**
 * Financial Document Processing Pipeline
 * REFINED: Added guidanceTemplate strings for structured extraction.
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
            guidanceTemplate: 'financial_extractor',
            promptId: 'SYS_ROUTER_V1',
            model: MODEL_NAMES.router,
            modelType: ModelType.MULTIMODAL,
            executionMode: ExecutionMode.CONDITIONAL,
            condition: { field: 'routing.requires_visual_analysis', operator: 'equals', value: true },
            inputMapping: {
                text_chunk: 'document.enhanced_ocr_text',
                filename: 'document.filename'
            },
            outputKey: 'imaging_analysis',
            timeout: 45000
        },
        {
            id: 'financial_extraction',
            name: 'Financial Extraction',
            type: StageType.TEXT_EXTRACTION,
            guidanceTemplate: 'financial_extractor',
            promptId: 'FIN_EXTRACT_V1',
            model: MODEL_NAMES.financeGeneral,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                text_chunk: 'document.enhanced_ocr_text',
                filename: 'document.filename'
            },
            outputKey: 'financial_extraction',
            timeout: 60000,
            retryCount: 2
        },
        {
            id: 'financial_reasoning',
            name: 'Financial Reasoning',
            type: StageType.REASONING,
            guidanceTemplate: 'financial_reasoner',
            promptId: 'FIN_REASONER_V1',
            model: MODEL_NAMES.financeReasoning,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                extracted_data: 'stages.financial_extraction.output'
            },
            outputKey: 'financial_reasoning',
            timeout: 45000
        },
        {
            id: 'financial_vat_analysis',
            name: 'VAT Expert Analysis',
            type: StageType.REASONING,
            guidanceTemplate: 'vat_expert_analyzer',
            promptId: 'FIN_VAT_EXPERT_V1',
            model: MODEL_NAMES.vatExpert,
            modelType: ModelType.TEXT_ONLY,
            executionMode: ExecutionMode.SEQUENTIAL,
            injectVatContext: true,
            inputMapping: {
                vat_context: 'context.vat_context',
                text_chunk: 'document.enhanced_ocr_text'
            },
            outputKey: 'financial_vat_analysis',
            timeout: 45000
        }
    ]
};

module.exports = { FinancialPipeline };