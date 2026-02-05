/* eslint-env mocha */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const logger = require('../../services/logger');
const {
    FieldMappingService
} = require('../../services/experts/FieldMappingService');

function pickSamples(service, count, predicate = () => true) {
    const raw = [];
    const domains = new Set(['financial', 'medical', 'legal', 'general']);

    for (const [fieldId, fieldDef] of Object.entries(service.fieldRegistry)) {
        if (!domains.has(fieldDef.domain)) {
            continue;
        }

        const labels = Array.isArray(fieldDef.visualLabels)
            ? fieldDef.visualLabels.filter(Boolean)
            : [];

        if (!labels.length || !predicate(fieldDef, labels[0])) {
            continue;
        }

        raw.push({
            fieldId,
            domain: fieldDef.domain,
            label: labels[0]
        });
    }

    const samples = [];
    for (let i = 0; i < count; i += 1) {
        samples.push(raw[i % raw.length]);
    }

    return samples;
}

function mutateLabel(label) {
    const normalized = String(label || '').trim();
    if (normalized.length < 4) {
        return `${normalized}X`;
    }

    const firstAlphaNum = normalized.search(/[A-Za-z0-9]/);
    if (firstAlphaNum === -1 || firstAlphaNum >= normalized.length - 1) {
        return `${normalized}X`;
    }

    return (
        normalized.slice(0, firstAlphaNum) +
        normalized.slice(firstAlphaNum + 1)
    );
}

describe('FieldMappingService - Initialization and Indexes', () => {
    let service;

    before(() => {
        service = new FieldMappingService({ logMatches: false });
    });

    it('loads registry and builds indexes', () => {
        assert.ok(service.initialized, 'service not initialized');
        assert.ok(service.visualLabelIndex.size > 0, 'visual index empty');
        assert.ok(service.paperlessFieldIndex.size > 0, 'paperless index empty');
        assert.ok(service.domainFieldIndex.size > 0, 'domain index empty');
    });

    it('normalizes labels and caches normalized values', () => {
        const first = service._normalizeLabel('  Réchnüngs Nummer  ');
        const second = service._normalizeLabel('  Réchnüngs Nummer  ');

        assert.strictEqual(first, 'rechnungsnummer');
        assert.strictEqual(second, 'rechnungsnummer');
        assert.strictEqual(
            service._normalizedLabelCache.get('  Réchnüngs Nummer  '),
            'rechnungsnummer'
        );
    });

    it('normalizes domain names in a case-insensitive way', () => {
        assert.strictEqual(service._normalizeDomain('FiNaNcIaL'), 'financial');
        assert.strictEqual(service._normalizeDomain(''), '');
        assert.strictEqual(service._normalizeDomain(null), '');
    });

    it('returns no match for empty or null visual labels', () => {
        const empty = service.mapVisualToPaperless('', 'financial', 0.8);
        const nil = service.mapVisualToPaperless(null, 'financial', 0.8);

        assert.strictEqual(empty.matchType, 'none');
        assert.strictEqual(nil.matchType, 'none');
        assert.strictEqual(empty.fieldId, null);
        assert.strictEqual(nil.fieldId, null);
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

        assert.strictEqual(missing.initialized, false);
        assert.strictEqual(missing.initializationError, 'field_registry_unavailable');
        assert.strictEqual(result.matchType, 'none');
    });
});

describe('FieldMappingService - Exact Matching', () => {
    let service;

    before(() => {
        service = new FieldMappingService({ logMatches: false });
    });

    it('maps exact label to paperless field with boost', () => {
        const result = service.mapVisualToPaperless(
            'Invoice Number',
            'financial',
            0.85
        );

        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.strictEqual(result.paperlessField, 'custom_field:invoice_number');
        assert.strictEqual(result.matchType, 'exact');
        assert.ok(result.confidence > 0.85, 'confidence not boosted');
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

    it('handles case-insensitive matching', () => {
        const result = service.mapVisualToPaperless('INVOICE NUMBER', 'financial', 0.8);
        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.strictEqual(result.matchType, 'exact');
    });

    it('caps boosted confidence at 1.0', () => {
        const result = service.mapVisualToPaperless(
            'Invoice Number',
            'financial',
            0.97
        );
        assert.strictEqual(result.confidence, 1);
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
});

describe('FieldMappingService - Fuzzy Matching', () => {
    let service;

    before(() => {
        service = new FieldMappingService({ logMatches: false });
    });

    it('handles typos with Levenshtein distance', () => {
        const result = service.mapVisualToPaperless(
            'Rechnungn Nr.',
            'financial',
            0.85
        );

        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.strictEqual(result.matchType, 'fuzzy');
        assert.ok(result.confidence < 0.85);
        assert.ok(result.confidence > 0.75);
    });

    it('matches abbreviated variants with fuzzy logic', () => {
        const result = service.mapVisualToPaperless(
            'Invoice Nbr',
            'financial',
            0.8
        );

        assert.strictEqual(result.fieldId, 'invoice_number');
        assert.strictEqual(result.matchType, 'fuzzy');
    });

    it('rejects low similarity matches', () => {
        const result = service.mapVisualToPaperless('XYZ123', 'financial', 0.8);
        assert.strictEqual(result.fieldId, null);
        assert.strictEqual(result.matchType, 'none');
        assert.strictEqual(result.confidence, 0);
    });

    it('obeys custom similarity threshold', () => {
        const strict = new FieldMappingService({
            logMatches: false,
            similarityThreshold: 0.95
        });
        const result = strict.mapVisualToPaperless(
            'Rechnungn Nr.',
            'financial',
            0.9
        );
        assert.strictEqual(result.matchType, 'none');
    });

    it('returns sorted fuzzy matches by similarity', () => {
        const matches = service._fuzzyMatchLabel('invoicenumberr', 'financial');
        assert.ok(matches.length > 0);
        for (let i = 1; i < matches.length; i += 1) {
            assert.ok(matches[i - 1].similarity >= matches[i].similarity);
        }
    });

    it('returns empty fuzzy matches for blank normalized labels', () => {
        assert.deepStrictEqual(service._fuzzyMatchLabel('', 'financial'), []);
    });
});

describe('FieldMappingService - Domain Filtering', () => {
    let service;

    before(() => {
        service = new FieldMappingService({ logMatches: false });
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

    it('returns required fields for domain', () => {
        const fields = service.getRequiredFields('financial');

        assert.ok(fields.length >= 3);
        assert.ok(fields.some((field) => field.fieldId === 'invoice_number'));
        assert.ok(fields.some((field) => field.fieldId === 'invoice_amount'));
        assert.ok(fields.every((field) => field.isMandatory === true));
    });

    it('returns optional fields for domain', () => {
        const fields = service.getOptionalFields('financial');
        assert.ok(fields.length > 0);
        assert.ok(fields.some((field) => field.fieldId === 'currency'));
        assert.ok(fields.every((field) => field.isMandatory === false));
    });

    it('combines required and optional fields in getAllFields', () => {
        const required = service.getRequiredFields('medical').length;
        const optional = service.getOptionalFields('medical').length;
        const all = service.getAllFields('medical').length;
        assert.strictEqual(all, required + optional);
    });

    it('returns empty field sets for unknown domains', () => {
        assert.deepStrictEqual(service.getRequiredFields('unknown-domain'), []);
        assert.deepStrictEqual(service.getOptionalFields('unknown-domain'), []);
        assert.deepStrictEqual(service.getAllFields('unknown-domain'), []);
    });

    it('applies domain normalization for uppercase domain names', () => {
        const result = service.mapVisualToPaperless(
            'Invoice Number',
            'FINANCIAL',
            0.9
        );
        assert.strictEqual(result.fieldId, 'invoice_number');
    });

    it('returns allowed field ids only for known domains', () => {
        const financial = service._getAllowedFieldIds('financial');
        const unknown = service._getAllowedFieldIds('unknown-domain');
        assert.ok(financial instanceof Set);
        assert.strictEqual(unknown, null);
    });

    it('passes through unfiltered results when domain is unknown', () => {
        const fieldIds = ['invoice_number', 'patient_name'];
        const result = service._filterByDomain(fieldIds, 'unknown-domain');
        assert.deepStrictEqual(result, fieldIds);
    });

    it('returns empty mapping for missing paperless fields', () => {
        const empty = service.mapPaperlessToVisual('', 'financial');
        const unknown = service.mapPaperlessToVisual(
            'custom_field:missing',
            'financial'
        );

        assert.strictEqual(empty.fieldId, null);
        assert.deepStrictEqual(empty.visualLabels, []);
        assert.strictEqual(unknown.fieldId, null);
        assert.deepStrictEqual(unknown.visualLabels, []);
    });
});

describe('FieldMappingService - Validation', () => {
    let service;

    before(() => {
        service = new FieldMappingService({ logMatches: false });
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

    it('validates unknown field ids and null values', () => {
        const unknown = service.validateField('does_not_exist', 'foo');
        const nullValue = service.validateField('invoice_number', null);

        assert.strictEqual(unknown.valid, false);
        assert.strictEqual(unknown.error, 'Unknown field');
        assert.strictEqual(nullValue.valid, false);
        assert.strictEqual(nullValue.error, 'Value is required');
    });

    it('validates enum fields', () => {
        const validCurrency = service.validateField('currency', 'EUR');
        const invalidCurrency = service.validateField('currency', 'AAA');
        const invalidLanguage = service.validateField('language', 'xx');

        assert.strictEqual(validCurrency.valid, true);
        assert.strictEqual(invalidCurrency.valid, false);
        assert.ok(invalidCurrency.error.includes('enum'));
        assert.strictEqual(invalidLanguage.valid, false);
    });

    it('validates string min/max length constraints', () => {
        const short = service.validateField('invoice_number', '');
        const long = service.validateField('invoice_number', 'A'.repeat(129));

        assert.strictEqual(short.valid, false);
        assert.ok(short.error.includes('pattern'));
        assert.strictEqual(long.valid, false);
        assert.ok(long.error.includes('max'));
    });

    it('validates array min/max item constraints', () => {
        const valid = service.validateField('contract_parties', ['A', 'B']);
        const tooFew = service.validateField('contract_parties', ['A']);
        const tooMany = service.validateField(
            'tags',
            Array.from({ length: 51 }, (_, index) => `tag-${index}`)
        );

        assert.strictEqual(valid.valid, true);
        assert.strictEqual(tooFew.valid, false);
        assert.ok(tooFew.error.includes('min'));
        assert.strictEqual(tooMany.valid, false);
        assert.ok(tooMany.error.includes('max'));
    });

    it('validates numeric min/max constraints', () => {
        const tooSmall = service.validateField('invoice_amount', -1);
        const tooLarge = service.validateField('invoice_amount', 100000001);
        const valid = service.validateField('invoice_amount', 1234.56);

        assert.strictEqual(tooSmall.valid, false);
        assert.ok(tooSmall.error.includes('min'));
        assert.strictEqual(tooLarge.valid, false);
        assert.ok(tooLarge.error.includes('max'));
        assert.strictEqual(valid.valid, true);
    });

    it('validates type mismatches for string, number, and array fields', () => {
        const wrongString = service.validateField('invoice_number', 42);
        const wrongNumber = service.validateField('invoice_amount', '12.30');
        const wrongArray = service.validateField('tags', 'not-an-array');

        assert.strictEqual(wrongString.valid, false);
        assert.ok(wrongString.error.includes('string'));
        assert.strictEqual(wrongNumber.valid, false);
        assert.ok(wrongNumber.error.includes('number'));
        assert.strictEqual(wrongArray.valid, false);
        assert.ok(wrongArray.error.includes('array'));
    });

    it('validates date format checks', () => {
        const valid = service.validateField('document_date', '2024-01-15');
        const invalid = service.validateField('document_date', '15-01-2024');

        assert.strictEqual(valid.valid, true);
        assert.strictEqual(invalid.valid, false);
        assert.ok(invalid.error.includes('pattern'));
    });

    it('handles unsupported format checks as permissive', () => {
        assert.strictEqual(service._validateFormat('uuid', 'ABC-123'), true);
    });

    it('levenshtein helpers handle edge cases', () => {
        assert.strictEqual(service._levenshteinDistance('kitten', 'sitting'), 3);
        assert.strictEqual(service._levenshteinDistance('', 'abc'), 3);
        assert.strictEqual(service._levenshteinDistance('abc', ''), 3);
        assert.strictEqual(service._levenshteinSimilarity('a', 'a'), 1);
        assert.strictEqual(service._levenshteinSimilarity('', ''), 1);
    });
});

describe('FieldMappingService - Performance and Accuracy Benchmarks', () => {
    let service;

    before(() => {
        service = new FieldMappingService({ logMatches: false });
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

        const samples = pickSamples(service, 100);
        assert.ok(samples.length === 100, 'failed to build 100-sample dataset');

        const startMs = Date.now();
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
        const durationMs = Date.now() - startMs;

        assert.ok(
            durationMs < maxBatchMs,
            `batch mapping ${durationMs}ms exceeds ${maxBatchMs}ms`
        );
        assert.ok(
            hits / samples.length >= 0.9,
            `accuracy ${(hits / samples.length) * 100}% below target`
        );
        assert.ok(
            durationMs / samples.length < 15,
            `avg latency ${(durationMs / samples.length).toFixed(2)}ms >= 15ms`
        );
    });

    it('achieves >90% fuzzy matching accuracy on a 100-sample set', () => {
        const maxBatchMs = Number(process.env.FIELD_MAPPING_BATCH_MS || 1500);
        const fuzzySamples = pickSamples(
            service,
            100,
            (_, label) => String(label).replace(/\s+/g, '').length >= 6
        ).map((sample) => ({
            ...sample,
            fuzzyLabel: mutateLabel(sample.label)
        }));

        const startMs = Date.now();
        let hits = 0;
        for (const sample of fuzzySamples) {
            const result = service.mapVisualToPaperless(
                sample.fuzzyLabel,
                sample.domain,
                0.85
            );
            if (result.fieldId === sample.fieldId) {
                hits += 1;
            }
        }
        const durationMs = Date.now() - startMs;
        const accuracy = hits / fuzzySamples.length;

        assert.ok(durationMs < maxBatchMs);
        assert.ok(accuracy >= 0.9, `fuzzy accuracy ${accuracy} below 0.9`);
    });

    it('keeps validation under 5ms average for 100 checks', () => {
        const startMs = Date.now();

        for (let i = 0; i < 100; i += 1) {
            service.validateField('invoice_number', `INV-2024-${String(i).padStart(3, '0')}`);
            service.validateField('invoice_amount', i * 5 + 100);
            service.validateField('document_date', '2024-01-15');
        }

        const durationMs = Date.now() - startMs;
        const avgMs = durationMs / 300;
        assert.ok(avgMs < 5, `validation avg ${avgMs.toFixed(2)}ms >= 5ms`);
    });
});

describe('FieldMappingService - Edge Cases and Logging', () => {
    let service;
    let originalLoggerInfo;
    let originalLoggerWarn;
    let tempRegistryPath;
    let logRecords;

    before(() => {
        service = new FieldMappingService({ logMatches: false });

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'field-mapping-'));
        tempRegistryPath = path.join(tempDir, 'registry.json');
        fs.writeFileSync(tempRegistryPath, JSON.stringify({
            fields: {
                alpha: {
                    type: 'string',
                    domain: 'financial',
                    paperlessField: 'custom_field:alpha',
                    visualLabels: ['Alpha Label'],
                    validationRules: {
                        minLength: 1,
                        maxLength: 32
                    }
                },
                beta: {
                    type: 'string',
                    domain: 'financial',
                    visualLabels: 'Beta Label'
                },
                gamma: {
                    type: 'array',
                    domain: 'financial',
                    paperlessField: 'custom_field:gamma',
                    visualLabels: ['Gamma'],
                    validationRules: {
                        minItems: 2,
                        maxItems: 3
                    }
                }
            },
            domainMappings: {
                financial: {
                    requiredFields: ['alpha', 'missing_field'],
                    optionalFields: ['beta', 'gamma']
                }
            }
        }), 'utf8');
    });

    beforeEach(() => {
        logRecords = [];
        originalLoggerInfo = logger.info;
        originalLoggerWarn = logger.warn;

        logger.info = (message, meta) => {
            logRecords.push({ level: 'info', message, meta });
        };
        logger.warn = (message, meta) => {
            logRecords.push({ level: 'warn', message, meta });
        };
    });

    afterEach(() => {
        logger.info = originalLoggerInfo;
        logger.warn = originalLoggerWarn;
    });

    it('normalizes Unicode/diacritics for matching', () => {
        const result = service.mapVisualToPaperless('Médication', 'medical', 0.9);
        assert.strictEqual(result.fieldId, 'medication');
    });

    it('normalizes whitespace and punctuation for matching', () => {
        const result = service.mapVisualToPaperless(
            '  Invoice   Number!!! ',
            'financial',
            0.9
        );
        assert.strictEqual(result.fieldId, 'invoice_number');
    });

    it('exposes no-match object shape through private helper', () => {
        const result = service._noMatch('financial', 'unknown-label', 0.8);
        assert.deepStrictEqual(result, {
            fieldId: null,
            paperlessField: null,
            confidence: 0,
            matchType: 'none',
            domain: 'financial'
        });
    });

    it('handles custom registry with missing mappings and logs both match paths', () => {
        const custom = new FieldMappingService({
            registryPath: tempRegistryPath,
            logMatches: true
        });

        const required = custom.getRequiredFields('financial');
        assert.strictEqual(required.length, 1);
        assert.strictEqual(required[0].fieldId, 'alpha');

        const exact = custom.mapVisualToPaperless('Alpha Label', 'financial', 0.9);
        assert.strictEqual(exact.fieldId, 'alpha');
        assert.strictEqual(exact.matchType, 'exact');

        const none = custom.mapVisualToPaperless('Nope Label', 'financial', 0.9);
        assert.strictEqual(none.matchType, 'none');

        const infoEvent = logRecords.find((log) => (
            log.level === 'info' &&
            String(log.message).includes('Mapping match')
        ));
        const warnEvent = logRecords.find((log) => (
            log.level === 'warn' &&
            String(log.message).includes('No mapping found')
        ));
        const missingFieldWarn = logRecords.find((log) => (
            log.level === 'warn' &&
            String(log.message).includes('Missing field in registry')
        ));

        assert.ok(infoEvent, 'expected info mapping log event');
        assert.ok(warnEvent, 'expected warn no-match log event');
        assert.ok(missingFieldWarn, 'expected missing field warning');
    });

    it('skips non-array visual labels in custom registry index build', () => {
        const custom = new FieldMappingService({
            registryPath: tempRegistryPath,
            logMatches: false
        });
        const betaNormalized = custom._normalizeLabel('Beta Label');
        assert.strictEqual(custom.visualLabelIndex.has(betaNormalized), false);
    });

    it('validates custom array min/max item rules', () => {
        const custom = new FieldMappingService({
            registryPath: tempRegistryPath,
            logMatches: false
        });
        const tooFew = custom.validateField('gamma', ['A']);
        const valid = custom.validateField('gamma', ['A', 'B']);
        const tooMany = custom.validateField('gamma', ['A', 'B', 'C', 'D']);

        assert.strictEqual(tooFew.valid, false);
        assert.strictEqual(valid.valid, true);
        assert.strictEqual(tooMany.valid, false);
    });

    it('returns empty mapping for uninitialized service in reverse mapping', () => {
        const missing = new FieldMappingService({
            logMatches: false,
            registryPath: path.join(
                __dirname,
                '..',
                'fixtures',
                'missing-registry.json'
            )
        });
        const reverse = missing.mapPaperlessToVisual(
            'custom_field:invoice_number',
            'financial'
        );

        assert.strictEqual(reverse.fieldId, null);
        assert.deepStrictEqual(reverse.visualLabels, []);
    });
});
