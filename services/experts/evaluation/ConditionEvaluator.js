/**
 * ConditionEvaluator
 *
 * Evaluates stage conditions to determine if a stage should execute.
 *
 * Supports:
 * - Single conditions with operators (equals, gt, gte, lt, lte, etc.)
 * - anyOf (OR) conditions
 * - allOf (AND) conditions
 */

const logger = require('../../logger');

class ConditionEvaluator {
    /**
     * Evaluate a condition against the execution context
     */
    static evaluate(condition, context) {
        if (!condition) {
            return true;  // No condition means always execute
        }

        // Handle 'anyOf' conditions
        if (condition.anyOf) {
            return condition.anyOf.some(c => this.evaluateSingle(c, context));
        }

        // Handle 'allOf' conditions
        if (condition.allOf) {
            return condition.allOf.every(c => this.evaluateSingle(c, context));
        }

        // Single condition
        return this.evaluateSingle(condition, context);
    }

    /**
     * Evaluate a single condition
     */
    static evaluateSingle(condition, context) {
        const { field, operator, value } = condition;
        const actualValue = context.resolvePath(field);

        switch (operator) {
            case 'equals':
                return actualValue === value;
            case 'not_equals':
                return actualValue !== value;
            case 'gt':
                return actualValue > value;
            case 'gte':
                return actualValue >= value;
            case 'lt':
                return actualValue < value;
            case 'lte':
                return actualValue <= value;
            case 'not_empty':
                return actualValue &&
                       (Array.isArray(actualValue) ? actualValue.length > 0 : true);
            case 'is_empty':
                return !actualValue ||
                       (Array.isArray(actualValue) && actualValue.length === 0);
            case 'contains':
                return Array.isArray(actualValue) && actualValue.includes(value);
            case 'exists':
                return actualValue !== null && actualValue !== undefined;
            default:
                logger.warn(`Unknown condition operator: ${operator}`);
                return false;
        }
    }
}

module.exports = { ConditionEvaluator };
