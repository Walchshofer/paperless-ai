/**
 * CircuitBreaker Unit Tests
 *
 * Comprehensive test suite for CircuitBreaker state machine
 * Covers all state transitions and failure scenarios
 *
 * Test Categories:
 * 1. State Transitions (CLOSED → OPEN → HALF_OPEN)
 * 2. Failure Threshold Behavior
 * 3. Cooldown Period and Recovery
 * 4. Timeout Handling
 * 5. Exponential Backoff
 * 6. Graceful Degradation
 * 7. Metrics Collection
 */

const assert = require('assert');
const { CircuitBreaker, CircuitState } = require('../../services/experts/CircuitBreaker');

describe('CircuitBreaker', function() {
    describe('Initialization', function() {
        it('should initialize in CLOSED state', function() {
            const breaker = new CircuitBreaker('test-service');
            assert.strictEqual(breaker.getState(), CircuitState.CLOSED);
        });

        it('should accept custom configuration', function() {
            const config = {
                failureThreshold: 5,
                cooldownPeriod: 60000,
                timeout: 1000
            };
            const breaker = new CircuitBreaker('test-service', config);
            assert.strictEqual(breaker.config.failureThreshold, 5);
            assert.strictEqual(breaker.config.cooldownPeriod, 60000);
            assert.strictEqual(breaker.config.timeout, 1000);
        });

        it('should use default configuration when not provided', function() {
            const breaker = new CircuitBreaker('test-service');
            assert.strictEqual(breaker.config.failureThreshold, 3);
            assert.strictEqual(breaker.config.cooldownPeriod, 30000);
            assert.strictEqual(breaker.config.timeout, 500);
        });
    });

    describe('State Transitions', function() {
        it('should transition CLOSED → OPEN after failure threshold', async function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 3,
                timeout: 100,
                maxRetries: 0,
                enableAdaptiveThreshold: false  // Test fixed threshold behavior
            });

            // Create operation that always fails
            const failingOperation = async () => {
                throw new Error('Test failure');
            };

            // Execute 3 times to exceed threshold
            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.CLOSED, 'Should remain CLOSED after 1st failure');

            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.CLOSED, 'Should remain CLOSED after 2nd failure');

            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.OPEN, 'Should transition to OPEN after 3rd failure');

            // Verify stats
            const stats = breaker.getStats();
            assert.strictEqual(stats.failedCalls, 3);
            assert.strictEqual(stats.stateTransitions.CLOSED_TO_OPEN, 1);
        });

        it('should transition OPEN → HALF_OPEN after cooldown period', async function() {
            this.timeout(5000); // Extend timeout for cooldown test

            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1,
                cooldownPeriod: 500, // Short cooldown for testing
                timeout: 100,
                maxRetries: 0
            });

            // Trigger OPEN state
            const failingOperation = async () => {
                throw new Error('Test failure');
            };
            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);

            // Wait for cooldown
            await sleep(600);

            // Track state transitions to verify we entered HALF_OPEN
            let transitionedToHalfOpen = false;
            const originalTransition = breaker._transitionTo.bind(breaker);
            breaker._transitionTo = function(newState) {
                if (newState === CircuitState.HALF_OPEN) {
                    transitionedToHalfOpen = true;
                }
                originalTransition(newState);
            };

            // Next call should attempt recovery (transition to HALF_OPEN, then back to OPEN on failure)
            await breaker.execute(failingOperation);
            assert.strictEqual(transitionedToHalfOpen, true, 'Should have transitioned to HALF_OPEN to test recovery');
            assert.strictEqual(breaker.getState(), CircuitState.OPEN, 'Should return to OPEN after failed recovery test');
        });

        it('should transition HALF_OPEN → CLOSED on successful recovery', async function() {
            this.timeout(5000);

            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1,
                cooldownPeriod: 500,
                timeout: 100,
                maxRetries: 0
            });

            // Open circuit
            const failingOperation = async () => {
                throw new Error('Test failure');
            };
            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);

            // Wait for cooldown
            await sleep(600);

            // Successful operation should close circuit
            const successOperation = async () => {
                return 'success';
            };
            const result = await breaker.execute(successOperation);

            assert.strictEqual(result.success, true);
            assert.strictEqual(breaker.getState(), CircuitState.CLOSED);
            assert.strictEqual(breaker.getStats().stateTransitions.HALF_OPEN_TO_CLOSED, 1);
        });

        it('should transition HALF_OPEN → OPEN on failed recovery', async function() {
            this.timeout(5000);

            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1,
                cooldownPeriod: 500,
                timeout: 100,
                maxRetries: 0
            });

            // Open circuit
            const failingOperation = async () => {
                throw new Error('Test failure');
            };
            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);

            // Wait for cooldown
            await sleep(600);

            // Failed operation should return to OPEN
            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);
            assert.strictEqual(breaker.getStats().stateTransitions.HALF_OPEN_TO_OPEN, 1);
        });
    });

    describe('Graceful Degradation', function() {
        it('should reject operations gracefully when circuit is OPEN', async function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1,
                cooldownPeriod: 60000, // Long cooldown to keep circuit open
                timeout: 100,
                maxRetries: 0
            });

            // Open circuit
            const failingOperation = async () => {
                throw new Error('Test failure');
            };
            await breaker.execute(failingOperation);
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);

            // Attempt operation while circuit is open
            const result = await breaker.execute(async () => 'should not execute');

            assert.strictEqual(result.success, false);
            assert.strictEqual(result.fallback, true);
            assert.strictEqual(result.circuitState, CircuitState.OPEN);
            assert.ok(result.error.message.includes('Circuit breaker OPEN'));

            // Verify rejected call was tracked
            const stats = breaker.getStats();
            assert.ok(stats.rejectedCalls >= 1);
        });

        it('should not fail pipeline when circuit is OPEN', async function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1,
                cooldownPeriod: 60000,
                timeout: 100,
                maxRetries: 0
            });

            // Open circuit
            await breaker.execute(async () => {
                throw new Error('Test failure');
            });

            // Pipeline continues with fallback
            const result = await breaker.execute(async () => 'critical operation');

            // Should not throw, should return fallback indicator
            assert.strictEqual(result.fallback, true);
            assert.strictEqual(result.success, false);
        });
    });

    describe('Timeout Handling', function() {
        it('should timeout operations exceeding timeout budget', async function() {
            this.timeout(5000);

            const breaker = new CircuitBreaker('test-service', {
                timeout: 200,
                maxRetries: 0
            });

            const slowOperation = async () => {
                await sleep(500); // Exceeds 200ms timeout
                return 'should not complete';
            };

            const result = await breaker.execute(slowOperation);

            assert.strictEqual(result.success, false);
            assert.ok(result.error.message.includes('timeout'));
            assert.strictEqual(breaker.getStats().timeoutCalls, 1);
        });

        it('should complete fast operations within timeout', async function() {
            const breaker = new CircuitBreaker('test-service', {
                timeout: 500
            });

            const fastOperation = async () => {
                await sleep(50); // Well under timeout
                return 'completed';
            };

            const result = await breaker.execute(fastOperation);

            assert.strictEqual(result.success, true);
            assert.strictEqual(result.data, 'completed');
        });
    });

    describe('Exponential Backoff', function() {
        it('should apply exponential backoff for retries', async function() {
            this.timeout(10000);

            const breaker = new CircuitBreaker('test-service', {
                initialBackoff: 100,
                backoffMultiplier: 2,
                maxRetries: 3,
                timeout: 500
            });

            let attemptTimestamps = [];
            const operation = async () => {
                attemptTimestamps.push(Date.now());
                throw new Error('Test failure');
            };

            await breaker.execute(operation);

            // Verify exponential backoff intervals
            // Expected: 0ms, 100ms, 200ms, 400ms
            assert.strictEqual(attemptTimestamps.length, 4); // Initial + 3 retries

            if (attemptTimestamps.length >= 2) {
                const interval1 = attemptTimestamps[1] - attemptTimestamps[0];
                assert.ok(interval1 >= 90 && interval1 <= 150, `First backoff should be ~100ms, was ${interval1}ms`);
            }

            if (attemptTimestamps.length >= 3) {
                const interval2 = attemptTimestamps[2] - attemptTimestamps[1];
                assert.ok(interval2 >= 180 && interval2 <= 250, `Second backoff should be ~200ms, was ${interval2}ms`);
            }

            if (attemptTimestamps.length >= 4) {
                const interval3 = attemptTimestamps[3] - attemptTimestamps[2];
                assert.ok(interval3 >= 380 && interval3 <= 450, `Third backoff should be ~400ms, was ${interval3}ms`);
            }
        });
    });

    describe('Success Behavior', function() {
        it('should reset failure count on success', async function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 3,
                maxRetries: 0
            });

            // Two failures
            await breaker.execute(async () => {
                throw new Error('Failure 1');
            });
            await breaker.execute(async () => {
                throw new Error('Failure 2');
            });

            assert.strictEqual(breaker.failureCount, 2);

            // Success should reset counter
            await breaker.execute(async () => 'success');

            assert.strictEqual(breaker.failureCount, 0);
            assert.strictEqual(breaker.getState(), CircuitState.CLOSED);
        });

        it('should track successful operations', async function() {
            const breaker = new CircuitBreaker('test-service');

            await breaker.execute(async () => 'success 1');
            await breaker.execute(async () => 'success 2');
            await breaker.execute(async () => 'success 3');

            const stats = breaker.getStats();
            assert.strictEqual(stats.successfulCalls, 3);
            assert.strictEqual(stats.totalCalls, 3);
        });
    });

    describe('Statistics and Monitoring', function() {
        it('should track comprehensive statistics', async function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 2,
                maxRetries: 0
            });

            // Mix of success and failure
            await breaker.execute(async () => 'success');
            await breaker.execute(async () => {
                throw new Error('failure');
            });
            await breaker.execute(async () => 'success');

            const stats = breaker.getStats();
            assert.strictEqual(stats.totalCalls, 3);
            assert.strictEqual(stats.successfulCalls, 2);
            assert.strictEqual(stats.failedCalls, 1);
        });

        it('should provide state information', async function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1  // Open circuit after 1 failure
            });

            assert.strictEqual(breaker.isHealthy(), true);
            assert.strictEqual(breaker.isOpen(), false);
            assert.strictEqual(breaker.isTesting(), false);

            // Open circuit (with failureThreshold: 1, one failure opens the circuit)
            await breaker.execute(async () => {
                throw new Error('failure');
            });

            assert.strictEqual(breaker.isHealthy(), false);
            assert.strictEqual(breaker.isOpen(), true);
        });
    });

    describe('Reset Functionality', function() {
        it('should reset circuit breaker to initial state', async function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1
            });

            // Open circuit
            await breaker.execute(async () => {
                throw new Error('failure');
            });
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);

            // Reset
            breaker.reset();

            assert.strictEqual(breaker.getState(), CircuitState.CLOSED);
            assert.strictEqual(breaker.failureCount, 0);
            assert.strictEqual(breaker.successCount, 0);
            assert.strictEqual(breaker.isHealthy(), true);
        });
    });

    describe('Metrics Collection Integration', function() {
        it('should call metrics collector when provided', async function() {
            let operationCalls = [];
            let transitionCalls = [];

            const mockMetrics = {
                recordCircuitBreakerOperation: (service, type, state) => {
                    operationCalls.push({ service, type, state });
                },
                recordCircuitBreakerStateTransition: (service, from, to) => {
                    transitionCalls.push({ service, from, to });
                }
            };

            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 1,
                maxRetries: 0
            }, mockMetrics);

            // Success
            await breaker.execute(async () => 'success');
            assert.ok(operationCalls.some(c => c.type === 'success'));

            // Failure to trigger state transition
            await breaker.execute(async () => {
                throw new Error('failure');
            });

            assert.ok(operationCalls.some(c => c.type === 'failure'));
            assert.ok(transitionCalls.some(c => c.from === 'CLOSED' && c.to === 'OPEN'));
        });
    });
});

/**
 * Helper function to sleep
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


describe('Adaptive Threshold', function() {
    describe('Configuration', function() {
        it('should enable adaptive threshold by default', function() {
            const breaker = new CircuitBreaker('test-service');
            assert.strictEqual(breaker.config.enableAdaptiveThreshold, true);
            assert.strictEqual(breaker.config.baseThreshold, 3);
            assert.strictEqual(breaker.config.windowSize, 20);
        });

        it('should allow disabling adaptive threshold', function() {
            const breaker = new CircuitBreaker('test-service', {
                enableAdaptiveThreshold: false
            });
            assert.strictEqual(breaker.config.enableAdaptiveThreshold, false);
        });

        it('should support backward compatibility with failureThreshold', function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 5
            });
            // failureThreshold should be used as baseThreshold
            assert.strictEqual(breaker.config.baseThreshold, 5);
        });

        it('should prefer baseThreshold over failureThreshold', function() {
            const breaker = new CircuitBreaker('test-service', {
                failureThreshold: 5,
                baseThreshold: 7
            });
            assert.strictEqual(breaker.config.baseThreshold, 7);
        });
    });

    describe('Error Rate Calculation', function() {
        it('should calculate error rate correctly with mixed operations', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 10,
                maxRetries: 0
            });

            // Execute 10 operations: 3 failures, 7 successes
            await breaker.execute(async () => { throw new Error('fail'); }); // fail
            await breaker.execute(async () => 'success'); // success
            await breaker.execute(async () => 'success'); // success
            await breaker.execute(async () => { throw new Error('fail'); }); // fail
            await breaker.execute(async () => 'success'); // success
            await breaker.execute(async () => 'success'); // success
            await breaker.execute(async () => 'success'); // success
            await breaker.execute(async () => { throw new Error('fail'); }); // fail
            await breaker.execute(async () => 'success'); // success
            await breaker.execute(async () => 'success'); // success

            const stats = breaker.getStats();
            // Error rate should be 3/10 = 0.3 (30%)
            assert.strictEqual(stats.errorRate, 0.3);
            assert.strictEqual(stats.windowSize, 10);
        });

        it('should maintain sliding window size', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 5,
                maxRetries: 0
            });

            // Execute more operations than window size
            for (let i = 0; i < 10; i++) {
                await breaker.execute(async () => 'success');
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.windowSize, 5); // Should not exceed window size
            assert.strictEqual(stats.maxWindowSize, 5);
        });

        it('should return 0 error rate for all successes', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 10,
                maxRetries: 0
            });

            // Execute 5 successful operations
            for (let i = 0; i < 5; i++) {
                await breaker.execute(async () => 'success');
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.errorRate, 0);
        });

        it('should return 1.0 error rate for all failures', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 10, // High threshold to prevent circuit opening
                windowSize: 5,
                maxRetries: 0
            });

            // Execute 5 failed operations
            for (let i = 0; i < 5; i++) {
                await breaker.execute(async () => { throw new Error('fail'); });
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.errorRate, 1.0);
        });
    });

    describe('Adaptive Threshold Formula', function() {
        it('should apply formula: threshold = baseThreshold × (1 + errorRate)', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 10,
                maxRetries: 0
            });

            // Create 10% error rate: 1 failure, 9 successes
            await breaker.execute(async () => { throw new Error('fail'); });
            for (let i = 0; i < 9; i++) {
                await breaker.execute(async () => 'success');
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.errorRate, 0.1);
            // threshold = 3 × (1 + 0.1) = 3.3 → ceil(3.3) = 4
            assert.strictEqual(stats.currentThreshold, 4);
        });

        it('should increase threshold with 50% error rate', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 10,
                maxRetries: 0
            });

            // Create 50% error rate: 5 failures, 5 successes (interleaved to prevent circuit opening)
            for (let i = 0; i < 5; i++) {
                await breaker.execute(async () => { throw new Error('fail'); });
                await breaker.execute(async () => 'success');
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.errorRate, 0.5);
            // threshold = 3 × (1 + 0.5) = 4.5 → ceil(4.5) = 5
            assert.strictEqual(stats.currentThreshold, 5);
        });

        it('should maintain base threshold with 0% error rate', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 10,
                maxRetries: 0
            });

            // All successes
            for (let i = 0; i < 10; i++) {
                await breaker.execute(async () => 'success');
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.errorRate, 0);
            // threshold = 3 × (1 + 0) = 3
            assert.strictEqual(stats.currentThreshold, 3);
            assert.strictEqual(stats.currentThreshold, stats.baseThreshold);
        });

        it('should round up threshold to nearest integer', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 10,
                maxRetries: 0
            });

            // Create 20% error rate: 2 failures, 8 successes
            await breaker.execute(async () => { throw new Error('fail'); });
            await breaker.execute(async () => { throw new Error('fail'); });
            for (let i = 0; i < 8; i++) {
                await breaker.execute(async () => 'success');
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.errorRate, 0.2);
            // threshold = 3 × (1 + 0.2) = 3.6 → ceil(3.6) = 4
            assert.strictEqual(stats.currentThreshold, 4);
        });
    });

    describe('Adaptive Threshold Behavior', function() {
        it('should prevent circuit opening when threshold increases', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 10,
                maxRetries: 0
            });

            // Build error rate history: 5 failures, 5 successes
            for (let i = 0; i < 5; i++) {
                await breaker.execute(async () => { throw new Error('fail'); });
                await breaker.execute(async () => 'success');
            }

            // Current threshold should be higher due to 50% error rate
            // threshold = 3 × (1 + 0.5) = 4.5 → ceil(4.5) = 5
            const stats = breaker.getStats();
            assert.strictEqual(stats.currentThreshold, 5);

            // Circuit should still be CLOSED (failureCount is reset after each success)
            assert.strictEqual(breaker.getState(), CircuitState.CLOSED);
        });

        it('should open circuit when consecutive failures exceed adaptive threshold', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 20,  // Larger window to maintain stable threshold
                maxRetries: 0
            });

            // Build history with many successes to keep error rate low
            for (let i = 0; i < 15; i++) {
                await breaker.execute(async () => 'success');
            }

            // Now cause consecutive failures to open circuit
            // With 15 successes in window, error rate will be: 3/18 = 0.167 (16.7%)
            // Adaptive threshold: 3 × (1 + 0.167) = 3.5 → ceil = 4
            await breaker.execute(async () => { throw new Error('fail'); }); // failureCount = 1, window: 15S + 1F
            await breaker.execute(async () => { throw new Error('fail'); }); // failureCount = 2, window: 15S + 2F
            await breaker.execute(async () => { throw new Error('fail'); }); // failureCount = 3, window: 15S + 3F
            
            // At this point: errorRate = 3/18 = 0.167, threshold = 4
            // Need one more failure to reach threshold of 4
            await breaker.execute(async () => { throw new Error('fail'); }); // failureCount = 4, window: 15S + 4F

            // Circuit should open after 4 consecutive failures (meeting adaptive threshold of 4)
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);
            
            // Verify the adaptive threshold was indeed 4
            const stats = breaker.getStats();
            assert.strictEqual(stats.currentThreshold, 4);
        });

        it('should track threshold adjustments in stats', async function() {
            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 5,
                maxRetries: 0
            });

            // Start with successes
            for (let i = 0; i < 3; i++) {
                await breaker.execute(async () => 'success');
            }

            let initialStats = breaker.getStats();
            let initialAdjustments = initialStats.thresholdAdjustments || 0;

            // Add failures to change error rate and trigger threshold adjustment
            await breaker.execute(async () => { throw new Error('fail'); });
            await breaker.execute(async () => { throw new Error('fail'); });

            let finalStats = breaker.getStats();
            // Threshold should have changed, incrementing adjustment count
            assert.ok(finalStats.thresholdAdjustments > initialAdjustments);
        });
    });

    describe('Backward Compatibility', function() {
        it('should use fixed threshold when adaptive is disabled', async function() {
            const breaker = new CircuitBreaker('test-service', {
                enableAdaptiveThreshold: false,
                failureThreshold: 3,
                maxRetries: 0
            });

            // Create high error rate
            for (let i = 0; i < 5; i++) {
                await breaker.execute(async () => { throw new Error('fail'); });
                await breaker.execute(async () => 'success');
            }

            const stats = breaker.getStats();
            assert.strictEqual(stats.adaptiveThresholdEnabled, false);
            // Should maintain base threshold regardless of error rate
            assert.strictEqual(stats.currentThreshold, 3);
        });

        it('should open circuit with fixed threshold when adaptive disabled', async function() {
            const breaker = new CircuitBreaker('test-service', {
                enableAdaptiveThreshold: false,
                failureThreshold: 2,
                maxRetries: 0
            });

            // Consecutive failures should open circuit at fixed threshold
            await breaker.execute(async () => { throw new Error('fail'); }); // failureCount = 1
            assert.strictEqual(breaker.getState(), CircuitState.CLOSED);

            await breaker.execute(async () => { throw new Error('fail'); }); // failureCount = 2
            assert.strictEqual(breaker.getState(), CircuitState.OPEN);
        });
    });

    describe('Metrics Integration', function() {
        it('should call metrics collector for threshold adjustments', async function() {
            let thresholdAdjustmentCalls = [];

            const mockMetrics = {
                recordCircuitBreakerThresholdAdjustment: (service, prevThreshold, newThreshold, errorRate) => {
                    thresholdAdjustmentCalls.push({ service, prevThreshold, newThreshold, errorRate });
                }
            };

            const breaker = new CircuitBreaker('test-service', {
                baseThreshold: 3,
                windowSize: 5,
                maxRetries: 0
            }, mockMetrics);

            // Create operations that will trigger threshold adjustment
            for (let i = 0; i < 3; i++) {
                await breaker.execute(async () => 'success');
            }
            
            // Add failures to increase error rate
            await breaker.execute(async () => { throw new Error('fail'); });
            await breaker.execute(async () => { throw new Error('fail'); });

            // Should have recorded threshold adjustment
            assert.ok(thresholdAdjustmentCalls.length > 0);
            const lastCall = thresholdAdjustmentCalls[thresholdAdjustmentCalls.length - 1];
            assert.strictEqual(lastCall.service, 'test-service');
            assert.ok(lastCall.errorRate > 0);
        });
    });
});
