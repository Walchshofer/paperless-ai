/* eslint-env mocha */

const assert = require('assert');
const {
    VisualQueryGenerator,
    QueryElementType
} = require('../../services/experts/VisualQueryGenerator');

const stubMappingService = {
    initialized: true,
    getRequiredFields(domain) {
        const table = {
            financial: [
                { fieldId: 'invoice_number', extractionPriority: 0.95 },
                { fieldId: 'invoice_amount', extractionPriority: 0.9 },
                { fieldId: 'document_date', extractionPriority: 0.85 }
            ],
            medical: [
                { fieldId: 'patient_name', extractionPriority: 0.95 },
                { fieldId: 'doctor_name', extractionPriority: 0.8 }
            ],
            legal: [
                { fieldId: 'contract_parties', extractionPriority: 0.95 },
                { fieldId: 'contract_start_date', extractionPriority: 0.9 }
            ],
            general: [
                { fieldId: 'title', extractionPriority: 0.95 },
                { fieldId: 'correspondent', extractionPriority: 0.9 }
            ]
        };
        return table[String(domain).toLowerCase()] || [];
    },
    getOptionalFields(domain) {
        const table = {
            financial: [{ fieldId: 'payment_due_date', extractionPriority: 0.6 }],
            medical: [{ fieldId: 'lab_values', extractionPriority: 0.7 }],
            legal: [{ fieldId: 'case_number', extractionPriority: 0.6 }],
            general: [{ fieldId: 'document_date', extractionPriority: 0.7 }]
        };
        return table[String(domain).toLowerCase()] || [];
    }
};

describe('VisualQueryGenerator', () => {
    let generator;

    beforeEach(() => {
        generator = new VisualQueryGenerator({
            fieldMappingService: stubMappingService
        });
    });

    afterEach(() => {
        generator.resetStats();
    });

    it('generates financial domain-specific query for missing invoice_number', async () => {
        const result = await generator.generateQueries({
            extractionResults: {
                fields: [
                    { name: 'invoice_amount', value: '123.45', confidence: 0.92 }
                ]
            },
            fieldTaxonomy: {
                fields: ['invoice_number', 'invoice_amount', 'payment_due_date']
            },
            documentMetadata: {
                id: 'doc-fin-1',
                documentType: 'financial'
            }
        });

        const invoiceQuery = result.visual_queries.find(
            query => query.field_target === 'invoice_number'
        );

        assert.ok(invoiceQuery, 'missing invoice_number query was not generated');
        assert.ok(
            invoiceQuery.question.toLowerCase().includes('rechnungsnummer') ||
            invoiceQuery.question.toLowerCase().includes('invoice number')
        );
        assert.strictEqual(
            invoiceQuery.expected_element_type,
            QueryElementType.FIELD_EXTRACTION
        );
    });

    it('generates medical domain-specific query for missing patient_name', async () => {
        const result = await generator.generateQueries({
            extractionResults: {
                fields: [
                    { name: 'doctor_name', value: 'Dr. Doe', confidence: 0.91 }
                ]
            },
            fieldTaxonomy: {
                fields: ['patient_name', 'doctor_name', 'lab_values']
            },
            documentMetadata: {
                id: 'doc-med-1',
                documentType: 'medical'
            }
        });

        const patientQuery = result.visual_queries.find(
            query => query.field_target === 'patient_name'
        );

        assert.ok(patientQuery, 'missing patient_name query was not generated');
        assert.ok(
            patientQuery.question.toLowerCase().includes('patient')
        );
        assert.strictEqual(
            patientQuery.expected_element_type,
            QueryElementType.FIELD_EXTRACTION
        );
    });

    it('gives required fields higher priority than optional fields', () => {
        const requiredPriority = generator._calculatePriority(
            {
                fieldId: 'invoice_number',
                extractionPriority: 0.5,
                isRequired: true,
                rarityBoost: 1.0
            },
            'financial',
            []
        );

        const optionalPriority = generator._calculatePriority(
            {
                fieldId: 'payment_due_date',
                extractionPriority: 0.5,
                isRequired: false,
                rarityBoost: 1.0
            },
            'financial',
            []
        );

        assert.ok(requiredPriority > optionalPriority);
    });

    it('applies rarity boost for missing fields', () => {
        const boostMissing = generator._calculateRarityFactor(
            { fieldId: 'invoice_number' },
            []
        );
        const boostSingle = generator._calculateRarityFactor(
            { fieldId: 'invoice_number' },
            [{ name: 'invoice_number' }]
        );

        assert.strictEqual(boostMissing, 1.5);
        assert.strictEqual(boostSingle, 1.2);
    });

    it('supports all four domains', async () => {
        const domains = ['financial', 'medical', 'legal', 'general'];

        for (const domain of domains) {
            const result = await generator.generateQueries({
                extractionResults: { fields: [] },
                fieldTaxonomy: { fields: ['title', 'document_date'] },
                documentMetadata: {
                    id: `doc-${domain}`,
                    documentType: domain
                }
            });

            assert.ok(
                result.visual_queries.length >= 3,
                `expected at least 3 queries for ${domain}`
            );
        }
    });

    it('returns required Stage 5.5 query schema fields', async () => {
        const result = await generator.generateQueries({
            extractionResults: { fields: [] },
            fieldTaxonomy: { fields: ['invoice_number', 'invoice_amount'] },
            documentMetadata: {
                id: 'doc-schema-1',
                documentType: 'financial'
            }
        });

        const query = result.visual_queries[0];
        assert.ok(query.question);
        assert.ok(query.field_target);
        assert.ok(query.expected_element_type);
        assert.strictEqual(typeof query.priority, 'number');
        assert.strictEqual(typeof query.confidence, 'number');
        assert.strictEqual(typeof query.rarity_factor, 'number');
        assert.strictEqual(query.logit_bias, undefined);
    });

    it('generates 10 queries in under 100ms', async () => {
        const perfGenerator = new VisualQueryGenerator({
            fieldMappingService: {
                initialized: true,
                getRequiredFields() {
                    return Array.from({ length: 10 }, (_, i) => ({
                        fieldId: `required_${i}`,
                        extractionPriority: 0.7
                    }));
                },
                getOptionalFields() {
                    return [];
                }
            },
            minQueriesPerDocument: 10
        });

        const startedAt = Date.now();
        const result = await perfGenerator.generateQueries({
            extractionResults: { fields: [] },
            fieldTaxonomy: {
                fields: Array.from({ length: 10 }, (_, i) => `required_${i}`)
            },
            documentMetadata: {
                id: 'perf-10',
                documentType: 'financial'
            }
        });
        const elapsed = Date.now() - startedAt;

        assert.ok(result.visual_queries.length >= 10);
        assert.ok(elapsed < 100, `expected <100ms, got ${elapsed}ms`);
    });
});
