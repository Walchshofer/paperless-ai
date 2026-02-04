/* eslint-env mocha */
const assert = require('assert');
const path = require('path');

const {
    FieldMappingService
} = require('../../services/experts/FieldMappingService');

describe('FieldMappingService', () => {
    let service;

    before(() => {
        service = new FieldMappingService({ logMatches: false });
    });

    it('loads registry and builds indexes', () => {
        assert.ok(service.initialized, 'service not initialized');
        assert.ok(service.visualLabelIndex.size > 0, 'visual index empty');
        assert.ok(service.paperlessFieldIndex.size > 0, 'paperless index empty');
    });

    it('maps exact label to paperless field with boost', () => {
        const result = service.mapVisualToPaperless(
            'Invoice Number',
            'financial',
            0.9
        );

        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.strictEqual(result.matchType, 'exact');
        assert.ok(result.confidence > 0.9, 'confidence not boosted');
    });

    it('maps German labels in financial domain', () => {
        const result = service.mapVisualToPaperless(
            'Rechnung Nr.',
            'financial',
            0.9
        );

        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.strictEqual(result.matchType, 'exact');
    });

    it('fuzzy matches typo variants', () => {
        const result = service.mapVisualToPaperless(
            'Invoice Nuber',
            'financial',
            0.9
        );

        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.strictEqual(result.matchType, 'fuzzy');
        assert.ok(result.confidence > 0.8, 'confidence too low');
    });

    it('respects domain filtering', () => {
        const financial = service.mapVisualToPaperless(
            'Total Amount',
            'financial',
            0.9
        );
        assert.strictEqual(financial.fieldId, 'invoice_amount');

        const medical = service.mapVisualToPaperless(
            'Total Amount',
            'medical',
            0.9
        );
        assert.strictEqual(medical.fieldId, null);
        assert.strictEqual(medical.matchType, 'none');
    });

    it('maps paperless fields to visual metadata', () => {
        const result = service.mapPaperlessToVisual(
            'custom_field:invoice_number',
            'financial'
        );

        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.ok(result.visualLabels.includes('Invoice #'));
        assert.ok(result.validationRules.pattern);
        assert.ok(result.displayName && result.displayName.en);
    });

    it('validates values against rules', () => {
        const ok = service.validateField('invoice_number', 'INV-2024-001');
        assert.strictEqual(ok.valid, true);

        const badPattern = service.validateField('invoice_number', 'inv-123');
        assert.strictEqual(badPattern.valid, false);

        const badAmount = service.validateField('invoice_amount', -100);
        assert.strictEqual(badAmount.valid, false);

        const badDate = service.validateField('document_date', '2024/01/01');
        assert.strictEqual(badDate.valid, false);
    });

    it('levenshtein distance matches known cases', () => {
        assert.strictEqual(service._levenshteinDistance('kitten', 'sitting'), 3);
        assert.strictEqual(service._levenshteinSimilarity('a', 'a'), 1);
    });

    it('meets performance targets for load and batch mapping', () => {
        const maxLoadMs = Number(process.env.FIELD_MAPPING_LOAD_MS || 50);
        const maxIndexMs = Number(process.env.FIELD_MAPPING_INDEX_MS || 100);
        const maxBatchMs = Number(process.env.FIELD_MAPPING_BATCH_MS || 1500);

        assert.ok(
            service.metrics.loadTimeMs < maxLoadMs,
            `load time ${service.metrics.loadTimeMs}ms exceeds ${maxLoadMs}ms`
        );
        assert.ok(
            service.metrics.indexBuildTimeMs < maxIndexMs,
            `index time ${service.metrics.indexBuildTimeMs}ms exceeds ${maxIndexMs}ms`
        );

        const samples = [];
        for (const [fieldId, fieldDef] of Object.entries(service.fieldRegistry)) {
            const labels = Array.isArray(fieldDef.visualLabels)
                ? fieldDef.visualLabels
                : [];
            for (const label of labels) {
                samples.push({
                    label,
                    fieldId,
                    domain: fieldDef.domain
                });
                if (samples.length >= 100) break;
            }
            if (samples.length >= 100) break;
        }

        assert.ok(samples.length >= 20, 'insufficient sample labels');

        const start = Date.now();
        let hits = 0;
        for (const sample of samples) {
            const result = service.mapVisualToPaperless(
                sample.label,
                sample.domain,
                0.9
            );
            if (result.fieldId === sample.fieldId) {
                hits += 1;
            }
        }
        const duration = Date.now() - start;

        assert.ok(
            duration < maxBatchMs,
            `batch mapping ${duration}ms exceeds ${maxBatchMs}ms`
        );
        assert.ok(
            hits / samples.length >= 0.9,
            `accuracy ${(hits / samples.length) * 100}% below target`
        );
    });

    it('handles missing registry gracefully', () => {
        const missing = new FieldMappingService({
            logMatches: false,
            registryPath: path.join(
                __dirname,
                '..',
                'fixtures',
                'missing-registry.json'
            )
        });

        const result = missing.mapVisualToPaperless(
            'Invoice Number',
            'financial',
            0.9
        );

        assert.strictEqual(result.matchType, 'none');
    });
});
