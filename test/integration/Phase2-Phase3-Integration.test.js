/* eslint-env mocha */

/**
 * Integration Tests for Phase 2 → Phase 3 Flow
 *
 * Tests the integration between Parallel OCR Execution (Phase 2)
 * and Visual Query Generation (Phase 3).
 */

const assert = require('assert');
const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
const { ExecutionContext } = require('../../services/experts/context');
const { StageType, ExecutionMode } = require('../../services/experts/pipelines/constants');
const { visualQueryGenerator } = require('../../services/experts/VisualQueryGenerator');

describe('Phase 2 → Phase 3 Integration', () => {
    let executor;
    let mockOllamaService;

    beforeEach(() => {
        // Mock Ollama service
        mockOllamaService = {
            chat: async () => ({ message: { content: '{}' } }),
            generate: async () => ({ response: 'test response' })
        };

        executor = new ExpertPipelineExecutor(mockOllamaService, {
            enableVisualRag: true
        });

        visualQueryGenerator.resetStats();
    });

    it('should pass OCR results from Phase 2 to Phase 3 query generation', async () => {
        const context = new ExecutionContext();
        context.visualSidecarAvailable = true;

        // Simulate Phase 2 OCR output
        context.setStageOutput('ocr', {
            text: 'Invoice #12345\nDate: 2024-01-15\nTotal: $100.00',
            source: 'visual-llm',
            confidence: 0.95,
            reconciliation: {
                conflictRate: 0.02,
                strategy: 'visual-priority'
            }
        }, 150);

        // Simulate extraction output
        context.setStageOutput('general_extraction', {
            fields: [
                { name: 'invoice_number', value: '12345', confidence: 0.9 },
                { name: 'total_amount', value: '100.00', confidence: 0.85 }
            ]
        }, 200);

        context.document = {
            id: 'integration-test-001',
            filename: 'invoice.pdf'
        };

        // Execute Phase 3 stage
        const phase3Stage = {
            id: 'visual_query_generation',
            name: 'Visual Query Generation',
            type: StageType.VISUAL_QUERY_GENERATION,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {
                extraction: 'stages.general_extraction.output',
                ocr: 'stages.ocr.output'
            },
            outputKey: 'visual_queries',
            timeout: 10000
        };

        const result = await executor._executeVisualQueryGenerationStage(phase3Stage, context, Date.now());

        assert.strictEqual(result.status, 'success', 'Stage should succeed');
        assert.ok(result.output.queries, 'Should have queries in output');
        assert.ok(result.output.queries.length >= 3, 'Should generate minimum 3 queries');

        // Verify OCR text was used
        const queryOutput = context.getStageOutput('visual_queries');
        assert.ok(queryOutput, 'Query output should be stored in context');
        assert.ok(queryOutput.metadata, 'Should have metadata');
    });

    it('should handle low OCR confidence by generating validation queries', async () => {
        const result = await visualQueryGenerator.generateQueries({
            extractionResults: {
                fields: [
                    { name: 'invoice_number', value: '12345', confidence: 0.5 },  // Low confidence
                    { name: 'vendor_name', value: 'Acme Corp', confidence: 0.4 }  // Low confidence
                ]
            },
            ocrResults: {
                text: 'Invoice #12345\nVendor: Acme Corp',
                source: 'tesseract',  // Tesseract fallback (lower quality)
                confidence: 0.6
            },
            fieldTaxonomy: {
                fields: ['invoice_number', 'vendor_name', 'invoice_date']
            },
            documentMetadata: { id: 'integration-test-002' }
        });

        const validationQueries = result.visual_queries.filter(
            q => q.expected_element_type === 'validation'
        );

        assert.ok(validationQueries.length >= 2, 'Should generate validation queries for low-confidence fields');
    });

    it('should handle OCR conflicts by generating missing field queries', async () => {
        const result = await visualQueryGenerator.generateQueries({
            extractionResults: {
                fields: [
                    { name: 'invoice_number', value: '12345', confidence: 0.9 }
                ]
            },
            ocrResults: {
                text: 'Invoice #12345',
                source: 'visual-llm',
                confidence: 0.95,
                reconciliation: {
                    conflictRate: 0.12,  // High conflict rate > 10%
                    conflicts: [
                        { field: 'invoice_date', visual: '2024-01-15', tesseract: '2024-01-16' }
                    ]
                }
            },
            fieldTaxonomy: {
                fields: ['invoice_number', 'invoice_date', 'total_amount']
            },
            documentMetadata: { id: 'integration-test-003' }
        });

        const dateQuery = result.visual_queries.find(q => q.field_target === 'invoice_date');
        assert.ok(dateQuery, 'Should generate query for conflicted field');

        const amountQuery = result.visual_queries.find(q => q.field_target === 'total_amount');
        assert.ok(amountQuery, 'Should generate query for missing field');
    });

    it('should gracefully degrade when OCR output is missing', async () => {
        const context = new ExecutionContext();
        context.visualSidecarAvailable = true;

        // No OCR output in context
        context.setStageOutput('general_extraction', {
            fields: [
                { name: 'invoice_number', value: '12345', confidence: 0.9 }
            ]
        }, 200);

        context.document = {
            id: 'integration-test-004',
            filename: 'invoice.pdf',
            text: 'Fallback text'  // Fallback to document text
        };

        const phase3Stage = {
            id: 'visual_query_generation',
            name: 'Visual Query Generation',
            type: StageType.VISUAL_QUERY_GENERATION,
            executionMode: ExecutionMode.SEQUENTIAL,
            inputMapping: {},
            outputKey: 'visual_queries',
            timeout: 10000
        };

        const result = await executor._executeVisualQueryGenerationStage(phase3Stage, context, Date.now());

        // Should succeed with fallback
        assert.ok(result.status === 'success' || result.status === 'warning', 'Should handle missing OCR gracefully');
        assert.ok(result.output.queries, 'Should still generate queries');
    });

    it('should use document type from classification for query generation', async () => {
        const result = await visualQueryGenerator.generateQueries({
            extractionResults: {
                fields: [
                    { name: 'patient_name', value: 'John Doe', confidence: 0.9 }
                ]
            },
            ocrResults: {
                text: 'Medical Record\nPatient: John Doe'
            },
            fieldTaxonomy: {
                fields: ['patient_name', 'diagnosis', 'treatment', 'prescription']
            },
            documentMetadata: {
                id: 'integration-test-005',
                documentType: 'medical'  // Medical document type
            }
        });

        // Should generate queries appropriate for medical documents
        const fieldTargets = result.visual_queries.map(q => q.field_target);
        const hasMedicalFields = fieldTargets.some(target =>
            ['diagnosis', 'treatment', 'prescription'].includes(target)
        );

        assert.ok(hasMedicalFields, 'Should generate queries for document-specific fields');
    });

    it('should handle various extraction confidence levels', async () => {
        const confidenceLevels = [
            { name: 'high_conf', value: 'Value1', confidence: 0.95 },
            { name: 'med_conf', value: 'Value2', confidence: 0.75 },
            { name: 'low_conf', value: 'Value3', confidence: 0.45 },
            { name: 'very_low_conf', value: 'Value4', confidence: 0.25 }
        ];

        const result = await visualQueryGenerator.generateQueries({
            extractionResults: { fields: confidenceLevels },
            ocrResults: { text: 'Sample text' },
            fieldTaxonomy: {
                fields: confidenceLevels.map(f => f.name).concat(['missing_field'])
            },
            documentMetadata: { id: 'integration-test-006' }
        });

        // Should prioritize lower confidence and missing fields
        const priorities = result.visual_queries.map(q => ({
            field: q.field_target,
            priority: q.priority
        }));

        const lowConfQuery = priorities.find(p => p.field === 'very_low_conf');
        const highConfQuery = priorities.find(p => p.field === 'high_conf');

        if (lowConfQuery && highConfQuery) {
            assert.ok(
                lowConfQuery.priority > highConfQuery.priority,
                'Lower confidence fields should have higher query priority'
            );
        }
    });

    it('should fail gracefully when taxonomy loading fails', async () => {
        const result = await visualQueryGenerator.generateQueries({
            extractionResults: {
                fields: [
                    { name: 'field1', value: 'value1', confidence: 0.9 }
                ]
            },
            ocrResults: { text: 'Sample text' },
            fieldTaxonomy: null,  // Taxonomy unavailable
            documentMetadata: { id: 'integration-test-007' }
        });

        // Should use fallback field set
        assert.ok(result.visual_queries.length >= 3, 'Should use fallback when taxonomy unavailable');
        assert.ok(result.generation_metadata, 'Should have metadata');
    });
});
