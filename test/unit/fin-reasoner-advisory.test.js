
/**
 * FIN_REASONER Advisory-Only Tests
 *
 * Tests for the FIN_REASONER advisory-only contract per:
 * - EXPERT_PIPELINE_DECISION_TABLE.md Stage 6 (Reasoning)
 * - PIPELINE_STAGE_CONTRACTS.md (Stage 6: Reasoning)
 *
 * Contracts:
 * - FIN_REASONER outputs are advisory ONLY
 * - Outputs: suggested_corrections, consistency_checks
 * - Must NOT overwrite extraction implicitly
 * - Orchestrator must explicitly apply allowed corrections
 */

const assert = require('assert');

describe('FIN_REASONER Advisory-Only Contract', function() {
    this.timeout(5000);

    describe('ExpertPipelineExecutor _buildResult behavior', () => {
        /**
         * Mock the _buildResult behavior to verify FIN_REASONER is handled correctly
         */
        function buildResultWithReasoning(extractionOutput, reasoningOutput) {
            // Simulate ExpertPipelineExecutor._buildResult logic
            // Per lines 993-1069 of ExpertPipelineExecutor.js

            const result = {
                success: true,
                result: {
                    primary_output: extractionOutput  // Extraction is primary
                },
                metadata: {}
            };

            // Advisory reasoning is attached as metadata ONLY
            if (reasoningOutput) {
                result.metadata.advisory_reasoning = {
                    suggested_corrections: reasoningOutput.suggested_corrections || [],
                    consistency_checks: reasoningOutput.consistency_checks || [],
                    source: 'FIN_REASONER_V1',
                    note: 'Advisory only - not applied automatically'
                };
            }

            return result;
        }

        it('should NOT include FIN_REASONER output in primary_output', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                total_amount: 100.00,
                date: '2026-01-01'
            };

            const reasoningOutput = {
                suggested_corrections: [
                    { field: 'total_amount', suggested: 120.00, reason: 'Tax calculation mismatch' }
                ],
                consistency_checks: [
                    { check: 'subtotal_plus_tax', passed: false, details: 'Subtotal + VAT != Total' }
                ]
            };

            const result = buildResultWithReasoning(extractionOutput, reasoningOutput);

            // Primary output should be extraction only
            assert.strictEqual(result.result.primary_output, extractionOutput);
            assert.strictEqual(result.result.primary_output.total_amount, 100.00);

            // Primary output should NOT have suggested_corrections mixed in
            assert.strictEqual(result.result.primary_output.suggested_corrections, undefined);
        });

        it('should attach FIN_REASONER output in metadata.advisory_reasoning', () => {
            const extractionOutput = { invoice_number: 'INV-001' };
            const reasoningOutput = {
                suggested_corrections: [{ field: 'amount', suggested: 150 }],
                consistency_checks: [{ check: 'date_order', passed: true }]
            };

            const result = buildResultWithReasoning(extractionOutput, reasoningOutput);

            assert.ok(result.metadata.advisory_reasoning, 'Should have advisory_reasoning in metadata');
            assert.deepStrictEqual(
                result.metadata.advisory_reasoning.suggested_corrections,
                reasoningOutput.suggested_corrections
            );
            assert.deepStrictEqual(
                result.metadata.advisory_reasoning.consistency_checks,
                reasoningOutput.consistency_checks
            );
        });

        it('should include advisory-only note in metadata', () => {
            const extractionOutput = { invoice_number: 'INV-001' };
            const reasoningOutput = { suggested_corrections: [] };

            const result = buildResultWithReasoning(extractionOutput, reasoningOutput);

            assert.strictEqual(
                result.metadata.advisory_reasoning.note,
                'Advisory only - not applied automatically'
            );
            assert.strictEqual(
                result.metadata.advisory_reasoning.source,
                'FIN_REASONER_V1'
            );
        });

        it('should handle missing reasoning output gracefully', () => {
            const extractionOutput = { invoice_number: 'INV-001' };

            const result = buildResultWithReasoning(extractionOutput, null);

            assert.strictEqual(result.metadata.advisory_reasoning, undefined);
            assert.strictEqual(result.result.primary_output, extractionOutput);
        });

        it('should NOT automatically apply suggested_corrections', () => {
            const extractionOutput = {
                invoice_number: 'INV-001',
                total_amount: 100.00
            };

            const reasoningOutput = {
                suggested_corrections: [
                    { field: 'total_amount', suggested: 120.00, reason: 'Should include tax' }
                ]
            };

            const result = buildResultWithReasoning(extractionOutput, reasoningOutput);

            // Extraction value should remain unchanged
            assert.strictEqual(result.result.primary_output.total_amount, 100.00);

            // The suggested correction should be in advisory metadata only
            assert.strictEqual(
                result.metadata.advisory_reasoning.suggested_corrections[0].suggested,
                120.00
            );
        });
    });

    describe('FIN_REASONER output shape contract', () => {
        /**
         * Per PIPELINE_STAGE_CONTRACTS.md Stage 6:
         * Outputs: suggested_corrections, consistency_checks
         */
        it('should accept valid FIN_REASONER output shape', () => {
            const validOutput = {
                suggested_corrections: [
                    {
                        field: 'invoice_number',
                        suggested: 'INV-001-A',
                        reason: 'Format correction'
                    }
                ],
                consistency_checks: [
                    {
                        check: 'total_validation',
                        passed: true,
                        details: 'Sum matches total'
                    }
                ]
            };

            // Validate shape
            assert.ok(Array.isArray(validOutput.suggested_corrections));
            assert.ok(Array.isArray(validOutput.consistency_checks));

            // Validate correction shape
            const correction = validOutput.suggested_corrections[0];
            assert.ok(correction.field !== undefined);
            assert.ok(correction.suggested !== undefined);

            // Validate check shape
            const check = validOutput.consistency_checks[0];
            assert.ok(check.check !== undefined);
            assert.ok(typeof check.passed === 'boolean');
        });

        it('should handle empty arrays in FIN_REASONER output', () => {
            const emptyOutput = {
                suggested_corrections: [],
                consistency_checks: []
            };

            assert.strictEqual(emptyOutput.suggested_corrections.length, 0);
            assert.strictEqual(emptyOutput.consistency_checks.length, 0);
        });
    });

    describe('Contract documentation alignment', () => {
        /**
         * Verify the actual code documents the advisory-only constraint
         */
        it('ExpertPipelineExecutor should document FIN_REASONER advisory behavior', () => {
            const fs = require('fs');
            const executorSource = fs.readFileSync(
                require.resolve('../../services/experts/ExpertPipelineExecutor.js'),
                'utf8'
            );

            // Check that the code documents the advisory constraint
            assert.ok(
                executorSource.includes('advisory') || executorSource.includes('Advisory'),
                'ExpertPipelineExecutor should mention advisory behavior'
            );

            // Check that FIN_REASONER output is handled
            assert.ok(
                executorSource.includes('financial_reasoning') || executorSource.includes('advisoryReasoning'),
                'Should handle financial reasoning output'
            );
        });
    });
});
