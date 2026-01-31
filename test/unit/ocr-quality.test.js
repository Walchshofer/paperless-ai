
/**
 * OCR Quality Scoring Tests
 *
 * Tests for OCR quality scoring and selection logic per:
 * - EXPERT_PIPELINE_DECISION_TABLE.md Stage 4 (Visual OCR)
 *
 * Contracts:
 * - Visual OCR via direct Ollama vision model (NOT Visual RAG)
 * - OCR selection based on quality scoring (length ratio, structure, garbage detection)
 * - Visual RAG is NEVER used for OCR
 */

const assert = require('assert');
const {
    scoreOcrQuality,
    mergeOcrResults,
    calculateDetailedMetrics,
    QUALITY_THRESHOLDS
} = require('../../services/experts/utils/ocrQuality');

describe('OCR Quality Scoring', function() {
    this.timeout(5000);

    describe('scoreOcrQuality()', () => {
        it('should return 0 score for empty visual text', () => {
            const result = scoreOcrQuality('', 'Some Paperless OCR text');

            assert.strictEqual(result.score, 0);
            assert.strictEqual(result.passed, false);
        });

        it('should score higher for well-structured text with good length ratio', () => {
            const visualText = 'Invoice Number: INV-001\nDate: 2026-01-01\nTotal: $100.00\nVendor: ABC Corp';
            const paperlessText = 'Invoice Number: INV-001 Date: 2026-01-01 Total: $100.00';

            const result = scoreOcrQuality(visualText, paperlessText);

            assert.ok(result.score > 0.5, `Expected score > 0.5 but got ${result.score}`);
            assert.strictEqual(result.passed, true);
            assert.ok(result.breakdown.structure > 0, 'Should detect structure (newlines)');
        });

        it('should penalize garbage characters', () => {
            const cleanText = 'Invoice Number: INV-001\nDate: 2026-01-01';
            const garbageText = 'Invoice\x00Number\x01: INV\x02-001';

            const cleanResult = scoreOcrQuality(cleanText, cleanText);
            const garbageResult = scoreOcrQuality(garbageText, garbageText);

            assert.ok(
                cleanResult.breakdown.characterQuality > garbageResult.breakdown.characterQuality,
                'Clean text should have better character quality score'
            );
        });

        it('should score based on word count', () => {
            const fewWords = 'Hello world';
            const manyWords = 'This is a longer document with many words that should score higher for word count because it contains more meaningful content than just a few words';

            const fewResult = scoreOcrQuality(fewWords, '');
            const manyResult = scoreOcrQuality(manyWords, '');

            assert.ok(
                manyResult.breakdown.wordCount >= fewResult.breakdown.wordCount,
                'More words should score higher or equal'
            );
        });

        it('should include detailed breakdown metrics', () => {
            const visualText = 'Test document content\nWith multiple lines';
            const paperlessText = 'Test document content';

            const result = scoreOcrQuality(visualText, paperlessText);

            assert.ok(result.breakdown !== undefined);
            assert.ok(typeof result.breakdown.lengthRatio === 'number');
            assert.ok(typeof result.breakdown.wordCount === 'number');
            assert.ok(typeof result.breakdown.structure === 'number');
            assert.ok(typeof result.breakdown.characterQuality === 'number');
        });

        it('should detect alphanumeric content', () => {
            const alphanumericText = 'Invoice 12345 Amount $500';
            const symbolOnlyText = '!!!! @@@@ ####';

            const alphaResult = scoreOcrQuality(alphanumericText, '');
            const symbolResult = scoreOcrQuality(symbolOnlyText, '');

            assert.ok(alphaResult.metrics.hasAlphanumeric, 'Should detect alphanumeric');
            assert.strictEqual(symbolResult.metrics.hasAlphanumeric, false, 'Symbols only should not have alphanumeric');
        });
    });

    describe('mergeOcrResults()', () => {
        it('should select visual OCR when quality is acceptable', async () => {
            const visualText = 'Invoice Number: INV-001\nDate: 2026-01-01\nTotal: $100.00\nVendor: ABC Corp\nAdditional content here';
            const paperlessText = 'Invoice Number: INV-001 Date: 2026-01-01 Total: $100.00';

            const result = await mergeOcrResults(visualText, paperlessText, {
                minQuality: 0.5,
                logMetrics: false
            });

            assert.strictEqual(result.source, 'visual_ocr');
            assert.strictEqual(result.text, visualText);
            assert.ok(result.quality_score >= 0.5);
            assert.ok(result.metadata.passed_quality_check);
        });

        it('should fallback to paperless when visual quality is below threshold', async () => {
            const visualText = 'bad';  // Very short, low quality
            const paperlessText = 'Invoice Number: INV-001 Date: 2026-01-01 Total: $100.00 Vendor: ABC Corp';

            const result = await mergeOcrResults(visualText, paperlessText, {
                minQuality: 0.6,
                fallbackStrategy: 'paperless',
                logMetrics: false
            });

            assert.strictEqual(result.source, 'paperless_fallback');
            assert.strictEqual(result.text, paperlessText);
            assert.ok(result.quality_score < 0.6);
            assert.strictEqual(result.metadata.passed_quality_check, false);
        });

        it('should use fallbackStrategy=longer when configured', async () => {
            const shortVisual = 'Short';
            const longPaperless = 'This is a much longer paperless OCR text that should win';

            const result = await mergeOcrResults(shortVisual, longPaperless, {
                minQuality: 0.9,  // Force fallback
                fallbackStrategy: 'longer',
                logMetrics: false
            });

            assert.strictEqual(result.source, 'paperless_fallback_longer');
            assert.strictEqual(result.text, longPaperless);
        });

        it('should include quality breakdown in result', async () => {
            const visualText = 'Test content\nWith structure';
            const paperlessText = 'Test content';

            const result = await mergeOcrResults(visualText, paperlessText, { logMetrics: false });

            assert.ok(result.quality_breakdown !== undefined);
            assert.ok(typeof result.quality_breakdown.lengthRatio === 'number');
            assert.ok(typeof result.quality_breakdown.structure === 'number');
        });

        it('should include metadata with reason for selection', async () => {
            const visualText = 'Test content\nWith structure\nAnd more lines';
            const paperlessText = 'Test content';

            const result = await mergeOcrResults(visualText, paperlessText, { logMetrics: false });

            assert.ok(result.metadata.reason !== undefined);
            assert.ok(result.metadata.visual_length !== undefined);
            assert.ok(result.metadata.paperless_length !== undefined);
        });
    });

    describe('calculateDetailedMetrics()', () => {
        it('should calculate length ratio correctly', () => {
            const result = calculateDetailedMetrics('1234567890', '12345');

            assert.strictEqual(result.metrics.lengthRatio, 2);  // 10/5 = 2
        });

        it('should detect structure (newlines)', () => {
            const withStructure = calculateDetailedMetrics('Line 1\nLine 2\nLine 3', '');
            const noStructure = calculateDetailedMetrics('Single line of text', '');

            assert.strictEqual(withStructure.metrics.hasStructure, true);
            assert.strictEqual(noStructure.metrics.hasStructure, false);
        });

        it('should handle empty input gracefully', () => {
            const result = calculateDetailedMetrics('', 'Some text');

            assert.strictEqual(result.metrics.lengthRatio, 0);
            assert.strictEqual(result.metrics.wordCount, 0);
            assert.strictEqual(result.details.visualLength, 0);
        });

        it('should count words correctly', () => {
            const result = calculateDetailedMetrics('one two three four five', '');

            assert.strictEqual(result.metrics.wordCount, 5);
        });
    });

    describe('Contract: Visual RAG NOT used for OCR', () => {
        /**
         * This test documents the architectural invariant:
         * Visual RAG is for enrichment (Stage 8) only, never for OCR.
         *
         * The OCR quality functions operate purely on text comparison,
         * with no Visual RAG integration.
         */
        it('OCR functions should not reference Visual RAG modules', () => {
            // This is a structural verification - OCR quality module
            // should have no dependency on Visual RAG
            const ocrQualitySource = require('fs').readFileSync(
                require.resolve('../../services/experts/utils/ocrQuality.js'),
                'utf8'
            );

            assert.ok(
                !ocrQualitySource.includes('visual-rag'),
                'OCR quality module should not import visual-rag'
            );
            assert.ok(
                !ocrQualitySource.includes('VisualOverlay'),
                'OCR quality module should not reference VisualOverlay'
            );
        });
    });
});
