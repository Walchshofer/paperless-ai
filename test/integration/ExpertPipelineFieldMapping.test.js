/* eslint-env mocha */
const assert = require('assert');

const { ExpertPipelineExecutor } = require('../../services/experts/ExpertPipelineExecutor');
const { FieldMappingService } = require('../../services/experts/FieldMappingService');
const { MockOllamaService } = require('../fixtures/mocks');

describe('Expert Pipeline Field Mapping Integration', () => {
    let executor;
    let mappingService;

    before(() => {
        executor = new ExpertPipelineExecutor(new MockOllamaService(), {});
        mappingService = new FieldMappingService({ logMatches: false });
    });

    it('maps financial fields and detects missing required fields', () => {
        const extractionResults = {
            fields: [
                { name: 'Rechnungsnr.', value: 'INV-001', confidence: 0.8 },
                { name: 'Rechnungsbetrag', value: 120.5, confidence: 0.75 }
            ]
        };

        const mapping = executor._applyFieldMapping(
            extractionResults,
            'financial',
            mappingService
        );

        const fieldIds = mapping.mappedFields.map(field => field.fieldId);
        assert.ok(fieldIds.includes('invoice_number'));
        assert.ok(fieldIds.includes('invoice_amount'));
        assert.ok(mapping.missingFields.some(field => field.fieldId === 'document_date'));

        const queries = executor._buildMissingFieldQueries(
            mapping.missingFields,
            'financial'
        );
        assert.ok(queries.some(query => query.field_target === 'document_date'));
    });

    it('maps medical fields and generates domain-specific queries', () => {
        const extractionResults = {
            fields: [
                { name: 'Patientenname', value: 'Max Mustermann', confidence: 0.7 },
                { name: 'Arzt', value: 'Dr. Schmidt', confidence: 0.7 }
            ]
        };

        const mapping = executor._applyFieldMapping(
            extractionResults,
            'medical',
            mappingService
        );

        assert.ok(mapping.mappedFields.some(field => field.fieldId === 'patient_name'));
        assert.ok(mapping.missingFields.some(field => field.fieldId === 'report_date'));

        const queries = executor._buildMissingFieldQueries(
            mapping.missingFields,
            'medical'
        );
        const reportQuery = queries.find(query => query.field_target === 'report_date');
        assert.ok(reportQuery, 'Expected report_date query');
        assert.ok(
            reportQuery.question.toLowerCase().includes('medical document'),
            'Expected domain-specific template'
        );
    });

    it('tracks mapping confidence for exact matches', () => {
        const extractionResults = {
            fields: [
                { name: 'Invoice Number', value: 'INV-009', confidence: 0.6 }
            ]
        };

        const mapping = executor._applyFieldMapping(
            extractionResults,
            'financial',
            mappingService
        );
        const invoiceField = mapping.mappedFields.find(field => field.fieldId === 'invoice_number');

        assert.ok(invoiceField, 'Expected invoice_number mapping');
        assert.ok(invoiceField.mappingConfidence > 0.6);
    });

    it('validates mapped fields and rejects invalid values', () => {
        const extractionResults = {
            fields: [
                { name: 'Invoice Number', value: 'INV 001', confidence: 0.9 },
                { name: 'Invoice Amount', value: -5, confidence: 0.9 }
            ]
        };

        const mapping = executor._applyFieldMapping(
            extractionResults,
            'financial',
            mappingService
        );

        const invoiceNumber = mapping.mappedFields.find(field => field.fieldId === 'invoice_number');
        const invoiceAmount = mapping.mappedFields.find(field => field.fieldId === 'invoice_amount');

        assert.strictEqual(invoiceNumber.validation_valid, false);
        assert.ok(invoiceNumber.validation_error);
        assert.strictEqual(invoiceNumber.value, null);

        assert.strictEqual(invoiceAmount.validation_valid, false);
        assert.ok(invoiceAmount.validation_error);
        assert.strictEqual(invoiceAmount.value, null);

        assert.ok(
            mapping.missingFields.some(field => field.fieldId === 'invoice_number'),
            'Invalid fields should be treated as missing'
        );
    });
});
