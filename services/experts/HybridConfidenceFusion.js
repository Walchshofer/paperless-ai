/**
 * HybridConfidenceFusion.js
 *
 * Fuses visual and OCR confidence scores and applies deterministic
 * state-based adjustments:
 * - ocr-confirmed: visual + OCR values agree
 * - arbitrated: disagreement resolved by arbitration
 * - visual-only: OCR value missing, rely on visual only
 */

const DEFAULT_CONFIG = Object.freeze({
    visualWeight: 0.6,
    ocrWeight: 0.4,
    ocrConfirmedBoostMin: 0.15,
    ocrConfirmedBoostMax: 0.2,
    arbitratedBoostMin: 0.05,
    arbitratedBoostMax: 0.1,
    visualOnlyPenalty: 0.1,
    numericAgreementTolerance: 0.01
});

class HybridConfidenceFusion {
    constructor(options = {}) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...options
        };
    }

    fuseField(input = {}) {
        const visualConfidence = this._normalizeConfidence(input.visualConfidence);
        const ocrConfidence = this._normalizeConfidence(input.ocrConfidence);
        const visualValue = this._sanitizeValue(input.visualValue);
        const ocrValue = this._sanitizeValue(input.ocrValue);

        const baseConfidence =
            (visualConfidence * this.config.visualWeight) +
            (ocrConfidence * this.config.ocrWeight);

        const hasVisualValue = this._hasValue(visualValue);
        const hasOcrValue = this._hasValue(ocrValue);
        const comparison = this._compareValues(visualValue, ocrValue);

        let fusionState = 'arbitrated';
        let adjustment = 0;
        let resolvedValue = ocrValue ?? visualValue ?? null;
        let arbitrationSource = null;

        if (!hasOcrValue) {
            fusionState = 'visual-only';
            adjustment = -Math.abs(this.config.visualOnlyPenalty);
            resolvedValue = visualValue ?? null;
        } else if (hasVisualValue && comparison.isMatch) {
            fusionState = 'ocr-confirmed';
            const agreementStrength = Math.max(
                comparison.score,
                1 - Math.abs(visualConfidence - ocrConfidence)
            );
            adjustment = this._interpolate(
                this.config.ocrConfirmedBoostMin,
                this.config.ocrConfirmedBoostMax,
                agreementStrength
            );
        } else {
            const arbitration = this._arbitrate({
                visualValue,
                ocrValue,
                visualConfidence,
                ocrConfidence
            });
            resolvedValue = arbitration.value;
            arbitrationSource = arbitration.source;
            const arbitrationStrength = Math.max(visualConfidence, ocrConfidence);
            adjustment = this._interpolate(
                this.config.arbitratedBoostMin,
                this.config.arbitratedBoostMax,
                arbitrationStrength
            );
        }

        return {
            field_name: input.fieldName || null,
            confidence: this._clamp(baseConfidence + adjustment),
            base_confidence: this._clamp(baseConfidence),
            confidence_adjustment: adjustment,
            fusion_state: fusionState,
            resolved_value: resolvedValue,
            arbitration_source: arbitrationSource,
            agreement_detected: comparison.isMatch,
            agreement_score: comparison.score,
            visual_confidence: visualConfidence,
            ocr_confidence: ocrConfidence
        };
    }

    summarize(results) {
        const list = Array.isArray(results) ? results : [];
        const summary = {
            total_fused_fields: 0,
            states: {
                'ocr-confirmed': 0,
                arbitrated: 0,
                'visual-only': 0
            },
            average_confidence: 0,
            average_adjustment: 0
        };

        let confidenceSum = 0;
        let adjustmentSum = 0;
        for (const item of list) {
            const state = item?.fusion_state;
            if (!Object.prototype.hasOwnProperty.call(summary.states, state)) {
                continue;
            }
            summary.total_fused_fields += 1;
            summary.states[state] += 1;
            confidenceSum += this._normalizeConfidence(item.confidence);
            adjustmentSum += Number.isFinite(item.confidence_adjustment)
                ? item.confidence_adjustment
                : 0;
        }

        if (summary.total_fused_fields > 0) {
            summary.average_confidence =
                confidenceSum / summary.total_fused_fields;
            summary.average_adjustment =
                adjustmentSum / summary.total_fused_fields;
        }

        return summary;
    }

    _arbitrate({ visualValue, ocrValue, visualConfidence, ocrConfidence }) {
        if (!this._hasValue(visualValue) && this._hasValue(ocrValue)) {
            return { value: ocrValue, source: 'ocr' };
        }
        if (this._hasValue(visualValue) && !this._hasValue(ocrValue)) {
            return { value: visualValue, source: 'visual' };
        }

        const visualScore = visualConfidence * this.config.visualWeight;
        const ocrScore = ocrConfidence * this.config.ocrWeight;

        if (visualScore > ocrScore) {
            return { value: visualValue, source: 'visual' };
        }

        return { value: ocrValue, source: 'ocr' };
    }

    _compareValues(visualValue, ocrValue) {
        if (!this._hasValue(visualValue) || !this._hasValue(ocrValue)) {
            return { isMatch: false, score: 0 };
        }

        const visualNumber = this._toNumericValue(visualValue);
        const ocrNumber = this._toNumericValue(ocrValue);
        if (visualNumber !== null && ocrNumber !== null) {
            const maxRef = Math.max(
                Math.abs(visualNumber),
                Math.abs(ocrNumber),
                1
            );
            const diff = Math.abs(visualNumber - ocrNumber);
            const score = 1 - Math.min(1, diff / maxRef);
            const tolerance = Math.max(
                this.config.numericAgreementTolerance,
                maxRef * this.config.numericAgreementTolerance
            );
            return {
                isMatch: diff <= tolerance,
                score
            };
        }

        const normalizedVisual = this._normalizeTextValue(visualValue);
        const normalizedOcr = this._normalizeTextValue(ocrValue);
        const isMatch = normalizedVisual === normalizedOcr;
        return {
            isMatch,
            score: isMatch ? 1 : 0
        };
    }

    _sanitizeValue(value) {
        if (value === undefined || value === null) {
            return null;
        }
        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        }
        return value;
    }

    _normalizeTextValue(value) {
        const text = String(value).toLowerCase();
        return text.replace(/\s+/g, ' ').trim();
    }

    _toNumericValue(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value !== 'string') {
            return null;
        }

        const raw = value.trim();
        if (!raw || /[a-zA-Z]/.test(raw)) {
            return null;
        }

        if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(raw)) {
            return null;
        }

        let normalized = raw.replace(/[^\d,.-]/g, '');
        if (!normalized || normalized === '.' || normalized === '-') {
            return null;
        }

        const isNegative = normalized.startsWith('-');
        normalized = normalized.replace(/-/g, '');
        if (!normalized) {
            return null;
        }

        const lastDot = normalized.lastIndexOf('.');
        const lastComma = normalized.lastIndexOf(',');
        const decimalIndex = Math.max(lastDot, lastComma);

        if (decimalIndex >= 0) {
            const integerPart = normalized
                .slice(0, decimalIndex)
                .replace(/[.,]/g, '');
            const fractionPart = normalized
                .slice(decimalIndex + 1)
                .replace(/[.,]/g, '');
            normalized = `${integerPart}.${fractionPart}`;
        } else {
            normalized = normalized.replace(/[.,]/g, '');
        }

        if (isNegative) {
            normalized = `-${normalized}`;
        }

        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    _hasValue(value) {
        return value !== null && value !== undefined && value !== '';
    }

    _normalizeConfidence(value) {
        const number = Number(value);
        if (!Number.isFinite(number)) {
            return 0;
        }
        return this._clamp(number);
    }

    _interpolate(min, max, ratio) {
        const normalizedRatio = this._clamp(ratio);
        const low = Number.isFinite(min) ? min : 0;
        const high = Number.isFinite(max) ? max : low;
        return low + ((high - low) * normalizedRatio);
    }

    _clamp(value) {
        return Math.max(0, Math.min(1, value));
    }
}

module.exports = {
    HybridConfidenceFusion,
    DEFAULT_CONFIG
};
