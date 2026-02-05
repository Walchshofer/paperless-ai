/* eslint-env mocha */

const assert = require('assert');
const {
    HybridConfidenceFusion
} = require('../../services/experts/HybridConfidenceFusion');

describe('HybridConfidenceFusion', () => {
    it('uses visual=0.6 and OCR=0.4 weighted base confidence', () => {
        const fusion = new HybridConfidenceFusion({
            ocrConfirmedBoostMin: 0,
            ocrConfirmedBoostMax: 0,
            arbitratedBoostMin: 0,
            arbitratedBoostMax: 0,
            visualOnlyPenalty: 0
        });

        const result = fusion.fuseField({
            fieldName: 'invoice_total',
            visualConfidence: 0.9,
            ocrConfidence: 0.5,
            visualValue: '100.00',
            ocrValue: '100.00'
        });

        assert.strictEqual(result.fusion_state, 'ocr-confirmed');
        assert.ok(result.confidence > 0.73 && result.confidence < 0.75);
    });

    it('detects agreement and applies ocr-confirmed boost', () => {
        const fusion = new HybridConfidenceFusion();
        const result = fusion.fuseField({
            fieldName: 'invoice_number',
            visualConfidence: 0.8,
            ocrConfidence: 0.7,
            visualValue: 'INV-001',
            ocrValue: 'INV-001'
        });

        assert.strictEqual(result.fusion_state, 'ocr-confirmed');
        assert.ok(result.confidence_adjustment >= 0.15);
        assert.ok(result.confidence_adjustment <= 0.2);
        assert.strictEqual(result.agreement_detected, true);
    });

    it('arbitrates disagreements and applies arbitration boost', () => {
        const fusion = new HybridConfidenceFusion();
        const result = fusion.fuseField({
            fieldName: 'invoice_date',
            visualConfidence: 0.9,
            ocrConfidence: 0.6,
            visualValue: '2025-01-04',
            ocrValue: '2025-01-05'
        });

        assert.strictEqual(result.fusion_state, 'arbitrated');
        assert.ok(result.confidence_adjustment >= 0.05);
        assert.ok(result.confidence_adjustment <= 0.1);
        assert.strictEqual(result.arbitration_source, 'visual');
        assert.strictEqual(result.resolved_value, '2025-01-04');
    });

    it('marks visual-only when OCR value is missing and applies penalty', () => {
        const fusion = new HybridConfidenceFusion();
        const result = fusion.fuseField({
            fieldName: 'vendor_name',
            visualConfidence: 0.8,
            ocrConfidence: 0,
            visualValue: 'ACME GmbH',
            ocrValue: null
        });

        assert.strictEqual(result.fusion_state, 'visual-only');
        assert.ok(result.confidence_adjustment < 0);
        assert.ok(result.confidence > 0.37 && result.confidence < 0.39);
    });

    it('treats numerically equivalent values as agreement', () => {
        const fusion = new HybridConfidenceFusion();
        const result = fusion.fuseField({
            fieldName: 'amount',
            visualConfidence: 0.7,
            ocrConfidence: 0.7,
            visualValue: '€1,234.56',
            ocrValue: '1234.56'
        });

        assert.strictEqual(result.fusion_state, 'ocr-confirmed');
        assert.strictEqual(result.agreement_detected, true);
    });

    it('summarizes fusion states and confidence', () => {
        const fusion = new HybridConfidenceFusion();
        const summary = fusion.summarize([
            { fusion_state: 'ocr-confirmed', confidence: 0.9, confidence_adjustment: 0.2 },
            { fusion_state: 'arbitrated', confidence: 0.8, confidence_adjustment: 0.05 },
            { fusion_state: 'visual-only', confidence: 0.3, confidence_adjustment: -0.1 },
            { fusion_state: 'ignored', confidence: 1.0, confidence_adjustment: 0.0 }
        ]);

        assert.strictEqual(summary.total_fused_fields, 3);
        assert.strictEqual(summary.states['ocr-confirmed'], 1);
        assert.strictEqual(summary.states.arbitrated, 1);
        assert.strictEqual(summary.states['visual-only'], 1);
        assert.ok(summary.average_confidence > 0.65 && summary.average_confidence < 0.67);
    });
});
