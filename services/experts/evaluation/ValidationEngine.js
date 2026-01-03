/**
 * ValidationEngine
 *
 * Validates stage outputs against defined rules and extraction confidence.
 *
 * Output contract matches VALIDATION_AND_RETRY_POLICY.md specification.
 */

const { ConditionEvaluator } = require('./ConditionEvaluator');
const logger = require('../../logger');

class ValidationEngine {
    /**
     * Validate extraction output against rules and confidence thresholds
     * 
     * @param {Array} rules - Validation rules to check
     * @param {Object} extractionOutput - The output from extraction stage
     * @param {Object} context - Execution context
     * @param {Object} options - Validation options
     * @param {number} options.confidenceThreshold - Minimum confidence (default: 0.7)
     * @param {Array<string>} options.requiredFields - Required field names
     * @returns {Object} Validation result matching documented contract
     */
    static validate(rules, extractionOutput, context, options = {}) {
        const confidenceThreshold = options.confidenceThreshold ?? 0.7;
        const requiredFields = options.requiredFields || [];
        
        const missingFields = [];
        const lowConfidenceFields = [];
        const fieldSeverities = {};  // Per-field severity tracking
        let score = 1.0;  // Start at perfect

        // Check required fields from rules
        for (const rule of rules) {
            const fieldValue = context.resolvePath(rule.field);
            
            if (fieldValue === undefined || fieldValue === null || fieldValue === '' || fieldValue === 'N/A') {
                missingFields.push(rule.field);
                fieldSeverities[rule.field] = 'critical';
                score -= 0.2;  // High severity deduction
            }
        }

        // Check explicit required fields list
        for (const fieldName of requiredFields) {
            if (!extractionOutput || extractionOutput[fieldName] === undefined || 
                extractionOutput[fieldName] === null || extractionOutput[fieldName] === '') {
                if (!missingFields.includes(fieldName)) {
                    missingFields.push(fieldName);
                    fieldSeverities[fieldName] = 'critical';
                    score -= 0.2;
                }
            }
        }

        // Check field-level confidence from _field_confidence
        if (extractionOutput && extractionOutput._field_confidence) {
            for (const [field, confidence] of Object.entries(extractionOutput._field_confidence)) {
                if (typeof confidence === 'number' && confidence < confidenceThreshold) {
                    lowConfidenceFields.push(field);
                    fieldSeverities[field] = confidence < 0.5 ? 'high' : 'medium';
                    score -= 0.1;  // Medium severity deduction
                }
            }
        }

        // Clamp score to [0, 1]
        score = Math.max(0, Math.min(1, score));

        const isValid = missingFields.length === 0 && lowConfidenceFields.length === 0;
        const shouldFallback = missingFields.length > 0 || score < 0.5;

        // Determine overall severity
        const severity = missingFields.length > 0 ? 'critical' :
                         lowConfidenceFields.length > 0 ? 'warning' : 'none';

        // Build retry hint for validations with issues (actionable suggestions)
        // Provide hint when: shouldFallback OR low confidence fields exist
        const hasIssues = shouldFallback || lowConfidenceFields.length > 0;
        const retryHint = hasIssues ? {
            suggestedAction: missingFields.length > 0 ? 'visual_ocr' : 'lower_threshold',
            targetFields: [...missingFields, ...lowConfidenceFields].slice(0, 3),
            reason: missingFields.length > 0 
                ? `Missing critical fields: ${missingFields.join(', ')}`
                : `Low confidence on: ${lowConfidenceFields.join(', ')}`
        } : null;

        const result = {
            isValid,
            missingFields,
            lowConfidenceFields,
            score,
            shouldFallback,
            severity,
            fieldSeverities,
            retryHint
        };

        logger.debug({
            event: 'validation_complete',
            isValid,
            missingFieldsCount: missingFields.length,
            lowConfidenceFieldsCount: lowConfidenceFields.length,
            score,
            shouldFallback,
            severity
        });

        return result;
    }

    /**
     * Legacy validate method for backward compatibility
     * Wraps new validate() and converts to old format
     * @deprecated Use validate() with new signature
     */
    static validateLegacy(rules, context) {
        const issues = [];
        let allPassed = true;

        for (const rule of rules) {
            const result = ConditionEvaluator.evaluateSingle(rule, context);

            if (!result) {
                allPassed = false;
                issues.push({
                    field: rule.field,
                    operator: rule.operator,
                    expected: rule.value,
                    actual: context.resolvePath(rule.field),
                    message: rule.errorMessage || `Validation failed for ${rule.field}`
                });
            }
        }

        return {
            valid: allPassed,
            issues: issues,
            checkedRules: rules.length
        };
    }
}

module.exports = { ValidationEngine };
