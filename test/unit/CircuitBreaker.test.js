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
                maxRetries: 0
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
            const result = await breaker.execute(failingOperation);
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
