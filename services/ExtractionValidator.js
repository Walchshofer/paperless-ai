/**
 * Evaluates extraction completeness and confidence to decide on fallback.
 */
class ExtractionValidator {
    validateExtraction(result, expectedFields = [], minConfidence = 0.7) {
        const missingFields = [];
        const lowConfidenceFields = [];

        const data = result && typeof result === 'object' ? result : {};
        const expected = Array.isArray(expectedFields) ? expectedFields : [];

        for (const field of expected) {
            const value = data[field];
            if (value === undefined || value === null) {
                missingFields.push(field);
            }
        }

        const confidenceMap = data._field_confidence || data._fieldConfidences || data._fieldConfidence || null;
        if (confidenceMap && typeof confidenceMap === 'object') {
            for (const [field, score] of Object.entries(confidenceMap)) {
                if (typeof score === 'number' && score < minConfidence) {
                    lowConfidenceFields.push(field);
                }
            }
        }

        const expectedCount = expected.length;
        const coverageScore = expectedCount > 0
            ? (expectedCount - missingFields.length) / expectedCount
            : 1;
        const confidenceScore = confidenceMap
            ? Math.max(0, 1 - (lowConfidenceFields.length / Math.max(1, Object.keys(confidenceMap).length)))
            : 1;
        const score = Math.max(0, Math.min(coverageScore, confidenceScore));

        const shouldFallback = missingFields.length > 0
            || lowConfidenceFields.length > 0
            || score < minConfidence;

        return {
            isValid: !shouldFallback,
            missingFields,
            lowConfidenceFields,
            score,
            shouldFallback
        };
    }
}

module.exports = ExtractionValidator;
