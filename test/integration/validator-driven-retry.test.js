/* eslint-env mocha */
/**
 * Validator-Driven Retry Integration Test
 *
 * Tests the implementation of VALIDATION_AND_RETRY_POLICY.md
 * severity-based retry orchestration
 */

const assert = require('assert');

// Mock ExecutionContext for testing
class MockExecutionContext {
    constructor(document = {}, classification = {}, options = {}) {
        this.document = document;
        this.classification = classification;
        this.options = options;
        this.stages = {};
        this.errors = [];
        this.warnings = [];
    }

    setStageOutput(key, output, timing = 0) {
        this.stages[key] = { output, timing };
    }

    getStageOutput(key) {
        return this.stages[key]?.output;
    }

    addError(stageId, error) {
        this.errors.push({ stageId, error: error.message || error });
    }

    addWarning(stageId, message) {
        this.warnings.push({ stageId, message });
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

// Mock ValidationEngine
const { ValidationEngine } = require('../../services/experts/evaluation/ValidationEngine');

describe('Validator-Driven Retry Orchestration', function() {
    this.timeout(10000);

    // Standalone test for _executeWithValidation logic
    describe('Validation Loop Logic', () => {
        
        /**
         * Simulates the _executeWithValidation logic for testing
         * without requiring the full ExpertPipelineExecutor
         */
        async function executeWithValidation(stage, context, pipeline, extractionFn) {
            const maxValidationRetries = 2;
            let attempt = 0;
            let lastValidationResult = null;
            let extractionOutput = null;

            const requiredFields = pipeline.requiredFields || 
                                   stage.requiredFields || 
                                   [];

            while (attempt < maxValidationRetries) {
                attempt++;

                extractionOutput = await extractionFn();

                const validationResult = ValidationEngine.validate(
                    stage.validationRules || [],
                    extractionOutput,
                    context,
                    {
                        requiredFields,
                        confidenceThreshold: pipeline.confidenceThreshold || 0.7
                    }
                );

                lastValidationResult = validationResult;
                context.setStageOutput(`${stage.outputKey}_validation`, validationResult);

                if (validationResult.isValid) {
                    break;
                }

                if (validationResult.shouldFallback) {
                    if (attempt === 1) {
                        continue;
                    }
                } else if (validationResult.lowConfidenceFields.length > 0) {
                    if (attempt === 1) {
                        continue;
                    } else {
                        context.addWarning(stage.id, 
                            `Low confidence fields: ${validationResult.lowConfidenceFields.join(', ')}`
                        );
                        break;
                    }
                }
            }

            let terminalState = 'success';
            if (!lastValidationResult.isValid) {
                if (lastValidationResult.missingFields.length > 0) {
                    terminalState = 'manual_review_required';
                    context.addError(stage.id, new Error(
                        `Validation failed after ${attempt} attempts: missing required fields ${lastValidationResult.missingFields.join(', ')}`
                    ));
                } else {
                    terminalState = 'accepted_with_warnings';
                    context.addWarning(stage.id,
                        `Accepted with low confidence after ${attempt} attempts`
                    );
                }
            }

            return {
                output: extractionOutput,
                validation: lastValidationResult,
                terminalState,
                attempts: attempt
            };
        }

        it('should succeed on first attempt with valid extraction', async () => {
            let attemptCount = 0;

            const extractionFn = async () => {
                attemptCount++;
                return {
                    invoice_number: 'INV-001',
                    date: '2026-01-01',
                    total_amount: 100.00,
                    _field_confidence: {
                        invoice_number: 0.95,
                        date: 0.92,
                        total_amount: 0.88
                    }
                };
            };

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number', 'date', 'total_amount']
            };

            const result = await executeWithValidation(stage, context, pipeline, extractionFn);

            assert.strictEqual(attemptCount, 1);
            assert.strictEqual(result.terminalState, 'success');
            assert.strictEqual(result.validation.isValid, true);
            assert.strictEqual(result.attempts, 1);
        });

        it('should retry once for low confidence fields and improve', async () => {
            let attemptCount = 0;

            const extractionFn = async () => {
                attemptCount++;
                
                if (attemptCount === 1) {
                    return {
                        invoice_number: 'INV-001',
                        date: '2026-01-01',
                        _field_confidence: {
                            invoice_number: 0.95,
                            date: 0.55
                        }
                    };
                } else {
                    return {
                        invoice_number: 'INV-001',
                        date: '2026-01-01',
                        _field_confidence: {
                            invoice_number: 0.95,
                            date: 0.85
                        }
                    };
                }
            };

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number', 'date']
            };

            const result = await executeWithValidation(stage, context, pipeline, extractionFn);

            assert.strictEqual(attemptCount, 2);
            assert.strictEqual(result.terminalState, 'success');
            assert.strictEqual(result.attempts, 2);
        });

        it('should trigger manual review for persistent missing fields', async () => {
            let attemptCount = 0;

            const extractionFn = async () => {
                attemptCount++;
                return {
                    invoice_number: 'INV-001',
                    _field_confidence: {
                        invoice_number: 0.95
                    }
                };
            };

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number', 'date']
            };

            const result = await executeWithValidation(stage, context, pipeline, extractionFn);

            assert.strictEqual(attemptCount, 2);
            assert.strictEqual(result.terminalState, 'manual_review_required');
            assert.strictEqual(result.validation.isValid, false);
            assert.ok(result.validation.missingFields.includes('date'));
            assert.strictEqual(context.errors.length, 1);
        });

        it('should accept with warnings after one retry for persistent low confidence', async () => {
            let attemptCount = 0;

            const extractionFn = async () => {
                attemptCount++;
                return {
                    invoice_number: 'INV-001',
                    date: '2026-01-01',
                    _field_confidence: {
                        invoice_number: 0.95,
                        date: 0.55
                    }
                };
            };

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number', 'date']
            };

            const result = await executeWithValidation(stage, context, pipeline, extractionFn);

            assert.strictEqual(attemptCount, 2);
            assert.strictEqual(result.terminalState, 'accepted_with_warnings');
            assert.strictEqual(result.validation.isValid, false);
            assert.ok(result.validation.lowConfidenceFields.includes('date'));
            assert.strictEqual(result.validation.missingFields.length, 0);
            assert.ok(context.warnings.length > 0);
        });

        it('should handle extraction function throwing error', async () => {
            const extractionFn = async () => {
                throw new Error('LLM timeout');
            };

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number']
            };

            await assert.rejects(
                async () => executeWithValidation(stage, context, pipeline, extractionFn),
                { message: 'LLM timeout' }
            );
        });

        it('should use custom confidence threshold from pipeline', async () => {
            let attemptCount = 0;

            const extractionFn = async () => {
                attemptCount++;
                return {
                    invoice_number: 'INV-001',
                    _field_confidence: {
                        invoice_number: 0.75  // Above 0.7, below 0.8
                    }
                };
            };

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number'],
                confidenceThreshold: 0.8  // Stricter threshold
            };

            const result = await executeWithValidation(stage, context, pipeline, extractionFn);

            // Should retry because confidence below threshold
            assert.strictEqual(attemptCount, 2);
            assert.strictEqual(result.terminalState, 'accepted_with_warnings');
            assert.ok(result.validation.lowConfidenceFields.includes('invoice_number'));
        });

        it('should not retry more than maxValidationRetries times', async () => {
            let attemptCount = 0;

            const extractionFn = async () => {
                attemptCount++;
                return {
                    // Always missing required field
                    _field_confidence: {}
                };
            };

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number', 'date', 'total']
            };

            const result = await executeWithValidation(stage, context, pipeline, extractionFn);

            // Should stop after 2 attempts (maxValidationRetries)
            assert.strictEqual(attemptCount, 2);
            assert.strictEqual(result.terminalState, 'manual_review_required');
        });

        it('should store validation result in context', async () => {
            const extractionFn = async () => ({
                invoice_number: 'INV-001',
                _field_confidence: { invoice_number: 0.95 }
            });

            const context = new MockExecutionContext({}, {}, {});
            const stage = {
                id: 'test_extraction',
                outputKey: 'extraction'
            };
            const pipeline = {
                requiredFields: ['invoice_number']
            };

            await executeWithValidation(stage, context, pipeline, extractionFn);

            const storedValidation = context.getStageOutput('extraction_validation');
            assert.ok(storedValidation);
            assert.strictEqual(storedValidation.isValid, true);
        });
    });
});
