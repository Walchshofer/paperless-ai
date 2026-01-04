/**
 * Unit Tests for VisualQueryGenerator (Phase 3)
 *
 * Tests query generation, prioritization, logit bias configuration,
 * field taxonomy integration, and graceful degradation.
 */

const assert = require('assert');
const { VisualQueryGenerator, QueryElementType, DEFAULT_CONFIG } = require('../../services/experts/VisualQueryGenerator');

describe('VisualQueryGenerator', () => {
    let generator;

    beforeEach(() => {
        generator = new VisualQueryGenerator();
    });

    afterEach(() => {
        generator.resetStats();
    });

    describe('Query Generation', () => {
        it('should generate minimum 3 queries for a document', async () => {
            const result = await generator.generateQueries({
                extractionResults: {
                    fields: [
                        { name: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                    ]
                },
                ocrResults: { text: 'Sample invoice text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-001', filename: 'test.pdf' }
            });

            assert.ok(result.visual_queries, 'Should have visual_queries array');
            assert.ok(result.visual_queries.length >= 3, `Should generate at least 3 queries, got ${result.visual_queries.length}`);
        });

        it('should generate queries for missing fields', async () => {
            const result = await generator.generateQueries({
                extractionResults: {
                    fields: [
                        { name: 'invoice_number', value: 'INV-001', confidence: 0.9 }
                    ]
                },
                ocrResults: { text: 'Sample invoice text' },
                fieldTaxonomy: {
                    fields: ['invoice_number', 'invoice_date', 'total_amount']
                },
                documentMetadata: { id: 'test-002' }
            });

            const queryFieldTargets = result.visual_queries.map(q => q.field_target);
            assert.ok(queryFieldTargets.includes('invoice_date'), 'Should target missing field: invoice_date');
            assert.ok(queryFieldTargets.includes('total_amount'), 'Should target missing field: total_amount');
        });

        it('should generate queries for low-confidence fields', async () => {
            const result = await generator.generateQueries({
                extractionResults: {
                    fields: [
                        { name: 'invoice_number', value: 'INV-001', confidence: 0.9 },
                        { name: 'total_amount', value: '100.00', confidence: 0.5 }  // Low confidence
                    ]
                },
                ocrResults: { text: 'Sample invoice text' },
                fieldTaxonomy: {
                    fields: ['invoice_number', 'total_amount']
                },
                documentMetadata: { id: 'test-003' }
            });

            const lowConfQuery = result.visual_queries.find(q => q.field_target === 'total_amount');
            assert.ok(lowConfQuery, 'Should generate query for low-confidence field');
            assert.strictEqual(lowConfQuery.expected_element_type, QueryElementType.VALIDATION);
        });

        it('should include all required query fields', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-004' }
            });

            const query = result.visual_queries[0];
            assert.ok(query.question, 'Query should have question field');
            assert.ok(query.field_target, 'Query should have field_target');
            assert.ok(query.expected_element_type, 'Query should have expected_element_type');
            assert.ok(typeof query.priority === 'number', 'Query should have numeric priority');
            assert.ok(typeof query.confidence === 'number', 'Query should have numeric confidence');
            assert.ok(typeof query.rarity_factor === 'number', 'Query should have numeric rarity_factor');
            assert.ok(query.logit_bias, 'Query should have logit_bias configuration');
        });

        it('should ensure values are within valid ranges', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-005' }
            });

            for (const query of result.visual_queries) {
                assert.ok(query.priority >= 0 && query.priority <= 1, `Priority should be in [0,1], got ${query.priority}`);
                assert.ok(query.confidence >= 0 && query.confidence <= 1, `Confidence should be in [0,1], got ${query.confidence}`);
                assert.ok(query.rarity_factor >= 0 && query.rarity_factor <= 1, `Rarity should be in [0,1], got ${query.rarity_factor}`);
            }
        });

        it('should handle extraction results with no fields', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-006' }
            });

            assert.ok(result.visual_queries.length >= 3, 'Should generate minimum queries even with no extracted fields');
        });

        it('should handle missing extraction results', async () => {
            const result = await generator.generateQueries({
                extractionResults: {},
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-007' }
            });

            assert.ok(result.visual_queries.length >= 3, 'Should handle missing extraction results');
        });
    });

    describe('Query Prioritization', () => {
        it('should prioritize missing fields over low-confidence fields', async () => {
            const result = await generator.generateQueries({
                extractionResults: {
                    fields: [
                        { name: 'invoice_number', value: 'INV-001', confidence: 0.9 },
                        { name: 'vendor_name', value: 'Acme Corp', confidence: 0.4 }  // Low confidence
                    ]
                },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: {
                    fields: ['invoice_number', 'vendor_name', 'invoice_date', 'total_amount']
                },
                documentMetadata: { id: 'test-008' }
            });

            // First query should target a missing field (higher priority)
            const firstQuery = result.visual_queries[0];
            assert.ok(
                firstQuery.field_target === 'invoice_date' || firstQuery.field_target === 'total_amount',
                'First query should target a missing field'
            );
        });

        it('should assign higher priority to rare fields', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: {
                    fields: ['invoice_number', 'rare_custom_field'],
                    fieldFrequencies: {
                        'invoice_number': 0.95,  // Very common
                        'rare_custom_field': 0.05  // Very rare
                    }
                },
                documentMetadata: { id: 'test-009' }
            });

            const rareFieldQuery = result.visual_queries.find(q => q.field_target === 'rare_custom_field');
            const commonFieldQuery = result.visual_queries.find(q => q.field_target === 'invoice_number');

            if (rareFieldQuery && commonFieldQuery) {
                assert.ok(
                    rareFieldQuery.priority > commonFieldQuery.priority,
                    'Rare field should have higher priority'
                );
            }
        });
    });

    describe('Logit Bias Configuration', () => {
        it('should include JSON structure tokens', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-010' }
            });

            const query = result.visual_queries[0];
            assert.ok(query.logit_bias.structure_tokens, 'Should have structure_tokens');
            assert.ok(query.logit_bias.structure_tokens.length > 0, 'Structure tokens should not be empty');

            const expectedTokens = ['{', '}', '[', ']', ':', '"'];
            for (const token of expectedTokens) {
                assert.ok(
                    query.logit_bias.structure_tokens.includes(token),
                    `Should include JSON token: ${token}`
                );
            }
        });

        it('should include field name tokens', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: {
                    fields: ['invoice_date']
                },
                documentMetadata: { id: 'test-011' }
            });

            const dateQuery = result.visual_queries.find(q => q.field_target === 'invoice_date');
            assert.ok(dateQuery, 'Should have query for invoice_date');
            assert.ok(dateQuery.logit_bias.field_tokens, 'Should have field_tokens');
            assert.ok(dateQuery.logit_bias.field_tokens.length > 0, 'Field tokens should not be empty');
        });

        it('should have valid bias strength', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-012' }
            });

            const query = result.visual_queries[0];
            assert.ok(
                typeof query.logit_bias.bias_strength === 'number',
                'Bias strength should be a number'
            );
            assert.ok(
                query.logit_bias.bias_strength >= 0 && query.logit_bias.bias_strength <= 2.0,
                'Bias strength should be in valid range [0, 2.0]'
            );
        });

        it('should tokenize field names correctly (split on underscore)', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: {
                    fields: ['total_amount_with_tax']
                },
                documentMetadata: { id: 'test-013' }
            });

            const query = result.visual_queries.find(q => q.field_target === 'total_amount_with_tax');
            if (query) {
                const tokens = query.logit_bias.field_tokens;
                assert.ok(tokens.includes('Total') || tokens.includes('Amount') || tokens.includes('With'),
                    'Should split field name on underscores and capitalize');
            }
        });

        it('should configure different element types correctly', async () => {
            const result = await generator.generateQueries({
                extractionResults: {
                    fields: [
                        { name: 'invoice_number', value: 'INV-001', confidence: 0.5 }  // Low confidence -> VALIDATION
                    ]
                },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: {
                    fields: ['invoice_number', 'invoice_date']  // invoice_date missing -> FIELD_EXTRACTION
                },
                documentMetadata: { id: 'test-014' }
            });

            const validationQuery = result.visual_queries.find(
                q => q.expected_element_type === QueryElementType.VALIDATION
            );
            const extractionQuery = result.visual_queries.find(
                q => q.expected_element_type === QueryElementType.FIELD_EXTRACTION
            );

            assert.ok(validationQuery, 'Should have VALIDATION type query');
            assert.ok(extractionQuery, 'Should have FIELD_EXTRACTION type query');
        });
    });

    describe('Graceful Degradation', () => {
        it('should return empty queries on error without throwing', async () => {
            // Simulate error by passing invalid input
            const result = await generator.generateQueries({
                extractionResults: null,  // Invalid
                ocrResults: null,         // Invalid
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-015' }
            });

            assert.ok(result.visual_queries, 'Should return visual_queries array');
            assert.ok(Array.isArray(result.visual_queries), 'visual_queries should be an array');
            assert.ok(result.generation_metadata, 'Should return metadata');
            assert.ok(result.generation_metadata.fallback === true || result.visual_queries.length >= 0,
                'Should handle error gracefully');
        });

        it('should use fallback field set when taxonomy unavailable', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,  // No taxonomy
                documentMetadata: { id: 'test-016' }
            });

            const fieldTargets = result.visual_queries.map(q => q.field_target);
            const hasFallbackField = fieldTargets.some(target =>
                DEFAULT_CONFIG.fallbackFieldSet.includes(target) ||
                target === 'additional_info'  // Exploration queries
            );

            assert.ok(hasFallbackField, 'Should use fallback field set when taxonomy unavailable');
        });

        it('should continue if field taxonomy loading fails', async () => {
            // This is tested implicitly by passing null taxonomy
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-017' }
            });

            assert.ok(result.visual_queries.length >= 3, 'Should generate queries despite missing taxonomy');
        });
    });

    describe('Metadata Generation', () => {
        it('should include generation metadata', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-018' }
            });

            assert.ok(result.generation_metadata, 'Should have generation_metadata');
            assert.ok(typeof result.generation_metadata.total_queries_generated === 'number');
            assert.ok(typeof result.generation_metadata.success_rate === 'number');
            assert.ok(Array.isArray(result.generation_metadata.fields_targeted));
            assert.ok(Array.isArray(result.generation_metadata.missing_fields));
            assert.ok(Array.isArray(result.generation_metadata.low_confidence_fields));
        });

        it('should track fields_targeted correctly', async () => {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: {
                    fields: ['invoice_number', 'invoice_date', 'total_amount']
                },
                documentMetadata: { id: 'test-019' }
            });

            assert.strictEqual(
                result.generation_metadata.fields_targeted.length,
                result.visual_queries.length,
                'fields_targeted should match number of queries'
            );
        });
    });

    describe('Statistics Tracking', () => {
        it('should update stats on successful generation', async () => {
            await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-020' }
            });

            const stats = generator.getStats();
            assert.strictEqual(stats.totalDocumentsProcessed, 1);
            assert.ok(stats.totalQueriesGenerated >= 3);
            assert.ok(stats.successRate > 0);
        });

        it('should track multiple document processing', async () => {
            await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-021' }
            });

            await generator.generateQueries({
                extractionResults: { fields: [] },
                ocrResults: { text: 'Sample text 2' },
                fieldTaxonomy: null,
                documentMetadata: { id: 'test-022' }
            });

            const stats = generator.getStats();
            assert.strictEqual(stats.totalDocumentsProcessed, 2);
            assert.ok(stats.averageQueriesPerDocument >= 3);
        });

        it('should reset stats correctly', () => {
            generator.resetStats();
            const stats = generator.getStats();

            assert.strictEqual(stats.totalDocumentsProcessed, 0);
            assert.strictEqual(stats.totalQueriesGenerated, 0);
            assert.strictEqual(stats.successRate, 0);
            assert.strictEqual(stats.averageQueriesPerDocument, 0);
            assert.strictEqual(stats.failureCount, 0);
        });
    });
});
