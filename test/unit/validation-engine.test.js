/* eslint-env mocha */
/**
 * ValidationEngine Tests
 *
 * Tests for the updated ValidationEngine contract matching
 * VALIDATION_AND_RETRY_POLICY.md specification
 */

const assert = require('assert');
const { ValidationEngine } = require('../../services/experts/evaluation/ValidationEngine');

// Mock ExecutionContext for testing
class MockExecutionContext {
    constructor() {
        this.stages = {};
    }

    setStageOutput(key, output) {
        this.stages[key] = { output };
    }

    resolvePath(path) {
        const parts = path.split('.');
        let current = this;
        
        for (const part of parts) {
            if (current === undefined || current === null) {
                return undefined;
            }
            current = current[part];
        }
        
        return current;
    }
}

describe('ValidationEngine', function() {
    this.timeout(5000);

    describe('validate() - New Contract', () => {
        it('should return valid result when all fields present with high confidence', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                date: '2026-01-01',
                total_amount: 100.00,
                _field_confidence: {
                    invoice_number: 0.95,
                    date: 0.92,
                    total_amount: 0.88
                }
            };

            const context = new MockExecutionContext();
            context.setStageOutput('extraction', extractionOutput);

            const rules = [
                { field: 'stages.extraction.output.invoice_number', operator: 'exists' },
                { field: 'stages.extraction.output.date', operator: 'exists' }
            ];

            const result = ValidationEngine.validate(rules, extractionOutput, context);

            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.missingFields.length, 0);
            assert.strictEqual(result.lowConfidenceFields.length, 0);
            assert.strictEqual(result.score, 1.0);
            assert.strictEqual(result.shouldFallback, false);
        });

        it('should detect missing required fields', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                // date missing
                _field_confidence: {
                    invoice_number: 0.95
                }
            };

            const context = new MockExecutionContext();
            context.setStageOutput('extraction', extractionOutput);

            const rules = [];
            const options = {
                requiredFields: ['invoice_number', 'date', 'total_amount']
            };

            const result = ValidationEngine.validate(rules, extractionOutput, context, options);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.missingFields.includes('date'));
            assert.ok(result.missingFields.includes('total_amount'));
            assert.strictEqual(result.missingFields.length, 2);
            assert.strictEqual(result.shouldFallback, true);
            assert.ok(result.score < 1.0);
        });

        it('should detect low confidence fields', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                date: '2026-01-01',
                total_amount: 100.00,
                _field_confidence: {
                    invoice_number: 0.95,
                    date: 0.65,  // Below default 0.7 threshold
                    total_amount: 0.55  // Below threshold
                }
            };

            const context = new MockExecutionContext();
            context.setStageOutput('extraction', extractionOutput);

            const rules = [];

            const result = ValidationEngine.validate(rules, extractionOutput, context);

            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.missingFields.length, 0);
            assert.ok(result.lowConfidenceFields.includes('date'));
            assert.ok(result.lowConfidenceFields.includes('total_amount'));
            assert.strictEqual(result.lowConfidenceFields.length, 2);
            assert.ok(result.score < 1.0);
            assert.strictEqual(result.shouldFallback, false);  // No missing fields, just low confidence
        });

        it('should calculate score correctly with mixed severity', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                // date missing (high severity: -0.2)
                total_amount: 100.00,
                _field_confidence: {
                    invoice_number: 0.95,
                    total_amount: 0.65  // Low confidence (medium severity: -0.1)
                }
            };

            const context = new MockExecutionContext();
            context.setStageOutput('extraction', extractionOutput);

            const rules = [];
            const options = {
                requiredFields: ['invoice_number', 'date', 'total_amount']
            };

            const result = ValidationEngine.validate(rules, extractionOutput, context, options);

            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.missingFields.length, 1);
            assert.strictEqual(result.lowConfidenceFields.length, 1);
            // Score = 1.0 - 0.2 (missing) - 0.1 (low conf) = 0.7
            // Use approximate comparison for floating-point
            assert.ok(Math.abs(result.score - 0.7) < 0.001, `Expected score ~0.7 but got ${result.score}`);
            // shouldFallback is true because there ARE missing fields (high severity)
            // Per VALIDATION_AND_RETRY_POLICY.md: missing fields = high severity = fallback
            assert.strictEqual(result.shouldFallback, true);
        });

        it('should trigger shouldFallback when score < 0.5', () => {
            const extractionOutput = {
                // Multiple missing fields
                _field_confidence: {}
            };

            const context = new MockExecutionContext();
            context.setStageOutput('extraction', extractionOutput);

            const rules = [];
            const options = {
                requiredFields: ['invoice_number', 'date', 'total_amount']
            };

            const result = ValidationEngine.validate(rules, extractionOutput, context, options);

            assert.strictEqual(result.isValid, false);
            assert.strictEqual(result.missingFields.length, 3);
            // Score = 1.0 - 0.6 = 0.4
            // Use approximate comparison for floating-point
            assert.ok(Math.abs(result.score - 0.4) < 0.001, `Expected score ~0.4 but got ${result.score}`);
            assert.strictEqual(result.shouldFallback, true);
        });

        it('should use custom confidence threshold', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                _field_confidence: {
                    invoice_number: 0.75  // Above 0.7, below 0.8
                }
            };

            const context = new MockExecutionContext();
            context.setStageOutput('extraction', extractionOutput);

            const rules = [];
            const options = {
                confidenceThreshold: 0.8  // Stricter threshold
            };

            const result = ValidationEngine.validate(rules, extractionOutput, context, options);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.lowConfidenceFields.includes('invoice_number'));
        });

        it('should handle extraction output without _field_confidence', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                date: '2026-01-01'
                // No _field_confidence field
            };

            const context = new MockExecutionContext();
            context.setStageOutput('extraction', extractionOutput);

            const rules = [];

            const result = ValidationEngine.validate(rules, extractionOutput, context);

            assert.strictEqual(result.isValid, true);
            assert.strictEqual(result.lowConfidenceFields.length, 0);
            assert.strictEqual(result.score, 1.0);
        });

        it('should handle null extraction output', () => {
            const context = new MockExecutionContext();
            const rules = [];
            const options = {
                requiredFields: ['invoice_number']
            };

            const result = ValidationEngine.validate(rules, null, context, options);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.missingFields.includes('invoice_number'));
        });

        it('should handle empty string as missing field', () => {
            const extractionOutput = {
                invoice_number: '',  // Empty string should be treated as missing
                date: '2026-01-01'
            };

            const context = new MockExecutionContext();
            const rules = [];
            const options = {
                requiredFields: ['invoice_number', 'date']
            };

            const result = ValidationEngine.validate(rules, extractionOutput, context, options);

            assert.strictEqual(result.isValid, false);
            assert.ok(result.missingFields.includes('invoice_number'));
            assert.ok(!result.missingFields.includes('date'));
        });
    });

    describe('validateLegacy() - Backward Compatibility', () => {
        it('should maintain old output format with valid field', () => {
            const context = new MockExecutionContext();
            context.setStageOutput('test', { value: 'foo' });

            const rules = [
                { field: 'stages.test.output.value', operator: 'equals', value: 'foo' }
            ];

            const result = ValidationEngine.validateLegacy(rules, context);

            assert.strictEqual(result.valid, true);
            assert.strictEqual(result.issues.length, 0);
            assert.strictEqual(result.checkedRules, 1);
        });

        it('should report issues with old format', () => {
            const context = new MockExecutionContext();
            context.setStageOutput('test', { value: 'bar' });

            const rules = [
                { field: 'stages.test.output.value', operator: 'equals', value: 'foo', errorMessage: 'Value mismatch' }
            ];

            const result = ValidationEngine.validateLegacy(rules, context);

            assert.strictEqual(result.valid, false);
            assert.strictEqual(result.issues.length, 1);
            assert.strictEqual(result.issues[0].message, 'Value mismatch');
            assert.strictEqual(result.checkedRules, 1);
        });
    });
});
