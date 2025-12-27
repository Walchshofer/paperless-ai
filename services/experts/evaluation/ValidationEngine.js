/**
 * ValidationEngine
 *
 * Validates stage outputs against defined rules.
 *
 * Uses ConditionEvaluator to check each rule and collects
 * validation issues for reporting.
 */

const { ConditionEvaluator } = require('./ConditionEvaluator');

class ValidationEngine {
    /**
     * Run validation rules against context
     */
    static validate(rules, context) {
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
