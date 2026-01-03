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


    describe('Phase 5: severity field', () => {
        it('should return severity "none" when validation passes', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', { title: 'Test Document' });
            
            const rules = [{ field: 'stages.extractor.output.title' }];
            const extractionOutput = {
                title: 'Test Document',
                _field_confidence: { title: 0.95 }
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.strictEqual(result.severity, 'none');
            assert.strictEqual(result.isValid, true);
        });

        it('should return severity "critical" when required fields are missing', () => {
            // Arrange
            const context = new MockExecutionContext();
            const rules = [
                { field: 'stages.extractor.output.invoice_number' },
                { field: 'stages.extractor.output.amount' }
            ];
            const extractionOutput = { description: 'Some text' };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.strictEqual(result.severity, 'critical');
            assert.ok(result.missingFields.includes('stages.extractor.output.invoice_number'));
            assert.ok(result.missingFields.includes('stages.extractor.output.amount'));
        });

        it('should return severity "warning" when only low confidence fields exist', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', { title: 'Test' });
            
            const rules = [{ field: 'stages.extractor.output.title' }];
            const extractionOutput = {
                title: 'Test',
                _field_confidence: { title: 0.5 }  // Below default 0.7 threshold
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.strictEqual(result.severity, 'warning');
            assert.ok(result.lowConfidenceFields.includes('title'));
        });
    });

    describe('Phase 5: fieldSeverities object', () => {
        it('should track "critical" severity for missing required fields', () => {
            // Arrange
            const context = new MockExecutionContext();
            const rules = [
                { field: 'stages.extractor.output.uid' },
                { field: 'stages.extractor.output.date' }
            ];
            const extractionOutput = {};

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.ok(result.fieldSeverities);
            assert.strictEqual(
                result.fieldSeverities['stages.extractor.output.uid'],
                'critical'
            );
            assert.strictEqual(
                result.fieldSeverities['stages.extractor.output.date'],
                'critical'
            );
        });

        it('should track "high" severity for very low confidence fields (< 0.5)', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', { amount: '100.00' });
            
            const rules = [];
            const extractionOutput = {
                amount: '100.00',
                _field_confidence: { amount: 0.3 }  // Very low
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.strictEqual(result.fieldSeverities.amount, 'high');
        });

        it('should track "medium" severity for moderately low confidence (0.5-0.7)', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', { vendor: 'ACME Corp' });
            
            const rules = [];
            const extractionOutput = {
                vendor: 'ACME Corp',
                _field_confidence: { vendor: 0.6 }  // Below 0.7 but above 0.5
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.strictEqual(result.fieldSeverities.vendor, 'medium');
        });

        it('should be empty object when all fields are valid', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', { title: 'Valid Title' });
            
            const rules = [{ field: 'stages.extractor.output.title' }];
            const extractionOutput = {
                title: 'Valid Title',
                _field_confidence: { title: 0.95 }
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.deepStrictEqual(result.fieldSeverities, {});
        });
    });

    describe('Phase 5: retryHint object', () => {
        it('should be null when validation passes (no fallback needed)', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', { title: 'Test' });
            
            const rules = [{ field: 'stages.extractor.output.title' }];
            const extractionOutput = {
                title: 'Test',
                _field_confidence: { title: 0.9 }
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.strictEqual(result.retryHint, null);
            assert.strictEqual(result.shouldFallback, false);
        });

        it('should suggest "visual_ocr" when fields are missing', () => {
            // Arrange
            const context = new MockExecutionContext();
            const rules = [{ field: 'stages.extractor.output.invoice_date' }];
            const extractionOutput = {};

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.ok(result.retryHint);
            assert.strictEqual(result.retryHint.suggestedAction, 'visual_ocr');
            assert.ok(result.retryHint.targetFields.includes(
                'stages.extractor.output.invoice_date'
            ));
            assert.ok(result.retryHint.reason.includes('Missing critical fields'));
        });

        it('should suggest "lower_threshold" when only low confidence exists', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', {
                amount: '50.00',
                date: '2024-01-01',
                vendor: 'Test'
            });
            
            const rules = [];
            const extractionOutput = {
                amount: '50.00',
                date: '2024-01-01',
                vendor: 'Test',
                _field_confidence: {
                    amount: 0.4,
                    date: 0.5,
                    vendor: 0.6
                }
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.ok(result.retryHint);
            assert.strictEqual(result.retryHint.suggestedAction, 'lower_threshold');
            assert.ok(result.retryHint.reason.includes('Low confidence'));
        });

        it('should limit targetFields to first 3 fields', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', {
                f1: 'a', f2: 'b', f3: 'c', f4: 'd', f5: 'e'
            });
            
            const rules = [];
            const extractionOutput = {
                f1: 'a', f2: 'b', f3: 'c', f4: 'd', f5: 'e',
                _field_confidence: {
                    f1: 0.3, f2: 0.3, f3: 0.3, f4: 0.3, f5: 0.3
                }
            };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert
            assert.ok(result.retryHint);
            assert.ok(
                result.retryHint.targetFields.length <= 3,
                `Expected at most 3 targetFields, got ${result.retryHint.targetFields.length}`
            );
        });
    });

    describe('Phase 5: backward compatibility', () => {
        it('should return all original fields plus new Phase 5 fields', () => {
            // Arrange
            const context = new MockExecutionContext();
            context.setStageOutput('extractor', { title: 'Test' });
            
            const rules = [{ field: 'stages.extractor.output.title' }];
            const extractionOutput = { title: 'Test' };

            // Act
            const result = ValidationEngine.validate(rules, extractionOutput, context);

            // Assert - original fields
            assert.ok('isValid' in result, 'Missing isValid field');
            assert.ok('missingFields' in result, 'Missing missingFields field');
            assert.ok('lowConfidenceFields' in result, 'Missing lowConfidenceFields field');
            assert.ok('score' in result, 'Missing score field');
            assert.ok('shouldFallback' in result, 'Missing shouldFallback field');

            // Assert - new Phase 5 fields
            assert.ok('severity' in result, 'Missing severity field');
            assert.ok('fieldSeverities' in result, 'Missing fieldSeverities field');
            assert.ok('retryHint' in result, 'Missing retryHint field');
        });
    });
});
