/* eslint-env mocha */
const assert = require('assert');

const { OcrGuidedVisualSearch } = require('../../services/experts/OcrGuidedVisualSearch');

describe('OcrGuidedVisualSearch', () => {
    it('should fetch OCR text from Paperless API', async () => {
        let called = false;
        const mockPaperless = {
            getDocumentContent: async () => {
                called = true;
                return 'Invoice INV-001 total $45.00';
            }
        };

        const searcher = new OcrGuidedVisualSearch({
            paperlessService: mockPaperless,
            crossValidationEnabled: false
        });

        const visualResult = {
            fields: [
                { name: 'invoice_number', value: 'INV-001', confidence: 0.65 }
            ],
            execution_metadata: { visual_confidence: 0.5 }
        };

        const result = await searcher.searchWithOcrGuidance(
            visualResult,
            'doc-1',
            'financial',
            {
                documentImage: 'dGVzdA==',
                visualQueries: [
                    {
                        question: 'Find invoice number',
                        field_target: 'invoice_number',
                        expected_element_type: 'validation',
                        confidence: 0.4,
                        rarity_factor: 0.1
                    }
                ],
                executeQueries: async () => [],
                mergeResults: () => visualResult.fields,
                calculateOverlays: () => [],
                buildMetadata: () => ({ visual_confidence: 0.5 }),
                extractNewlyDiscovered: () => []
            }
        );

        assert.ok(called, 'Expected Paperless OCR fetch to be called');
        assert.ok(
            result.execution_metadata.ocr_text_sample.includes('Invoice'),
            'Expected OCR text to be included in metadata'
        );
    });

    it('should extract key terms from OCR text', () => {
        const searcher = new OcrGuidedVisualSearch({ crossValidationEnabled: false });
        const terms = searcher._extractKeyTerms(
            'Invoice Total $1,234.56 Due Date'
        );

        assert.ok(terms.includes('Invoice'));
        assert.ok(terms.includes('Total'));
        assert.ok(terms.includes('$1,234.56'));
    });

    it('should extract numeric key terms from OCR text', () => {
        const searcher = new OcrGuidedVisualSearch({ crossValidationEnabled: false });
        const terms = searcher._extractKeyTerms(
            'Invoice 2024-01-15 Ref 12345 Total 89.50'
        );

        assert.ok(terms.includes('2024-01-15'));
        assert.ok(terms.includes('12345'));
        assert.ok(terms.includes('89.50'));
    });

    it('should find invoice_number in OCR text', () => {
        const searcher = new OcrGuidedVisualSearch({ crossValidationEnabled: false });
        const match = searcher._findFieldInOcr(
            'invoice_number',
            'Invoice # INV-001 issued on 01/02/2024'
        );
        assert.strictEqual(match, 'INV-001');
    });

    it('should cross-validate and correct OCR errors', async () => {
        const mockClient = {
            post: async () => ({
                data: {
                    message: {
                        content: '[{"name":"invoice_number","value":"INV-001","confidence":0.88}]'
                    }
                }
            })
        };

        const searcher = new OcrGuidedVisualSearch({
            crossValidationEnabled: true,
            ollamaClient: mockClient
        });

        const fields = [
            { name: 'invoice_number', value: 'INV-OO1', confidence: 0.65 }
        ];

        const result = await searcher._crossValidate(
            'Invoice INV-OO1 total $45.00',
            fields,
            [],
            'financial'
        );

        assert.ok(result.used, 'Expected cross-validation to be used');
        assert.strictEqual(result.fields[0].value, 'INV-001');
        assert.strictEqual(result.fields[0].confidence, 0.88);
    });

    it('should skip cross-validation when timeout is exceeded', async () => {
        const mockClient = {
            post: async () => new Promise((resolve) => {
                setTimeout(() => resolve({
                    data: {
                        message: {
                            content:
                                '[{"name":"invoice_number","value":"INV-001","confidence":0.88}]'
                        }
                    }
                }), 120);
            })
        };
        const mockPaperless = {
            getDocumentContent: async () => 'Invoice INV-001 total $45.00'
        };
        const searcher = new OcrGuidedVisualSearch({
            paperlessService: mockPaperless,
            crossValidationEnabled: true,
            crossValidationTimeoutMs: 20,
            ollamaClient: mockClient
        });
        const visualResult = {
            fields: [
                { name: 'invoice_number', value: 'INV-OO1', confidence: 0.65 }
            ],
            execution_metadata: { visual_confidence: 0.5 }
        };

        const result = await searcher.searchWithOcrGuidance(
            visualResult,
            'doc-timeout',
            'financial',
            {
                documentImage: 'dGVzdA==',
                visualQueries: [
                    {
                        question: 'Find invoice number',
                        field_target: 'invoice_number',
                        expected_element_type: 'validation',
                        confidence: 0.5,
                        rarity_factor: 0.1
                    }
                ],
                executeQueries: async () => [],
                mergeResults: () => visualResult.fields,
                calculateOverlays: () => [],
                buildMetadata: () => ({ visual_confidence: 0.5 }),
                extractNewlyDiscovered: () => []
            }
        );

        assert.strictEqual(result.execution_metadata.ocr_fallback_used, true);
        assert.strictEqual(result.execution_metadata.ocr_cross_validation_used, false);
        assert.strictEqual(result.fields[0].value, 'INV-OO1');
    });

    it('records ocr_guided_fallback_total when OCR guidance is skipped', async () => {
        const calls = [];
        const metricsCollector = {
            recordOcrGuidedFallback: (documentType, outcome) => {
                calls.push({ documentType, outcome });
            }
        };
        const mockPaperless = {
            getDocumentContent: async () => 'short'
        };

        const searcher = new OcrGuidedVisualSearch({
            paperlessService: mockPaperless,
            metricsCollector,
            crossValidationEnabled: false
        });

        const visualResult = {
            fields: [
                { name: 'invoice_number', value: 'INV-001', confidence: 0.65 }
            ],
            execution_metadata: { visual_confidence: 0.5 }
        };

        await searcher.searchWithOcrGuidance(
            visualResult,
            'doc-1',
            'financial',
            {
                documentImage: 'dGVzdA==',
                visualQueries: [],
                executeQueries: async () => []
            }
        );

        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].documentType, 'financial');
        assert.strictEqual(calls[0].outcome, 'skipped');
    });
});
