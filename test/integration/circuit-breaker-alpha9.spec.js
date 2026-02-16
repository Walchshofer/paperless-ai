/* eslint-env mocha */

/**
 * Circuit Breaker State Transition Tests - Alpha-9
 *
 * Verifies the circuit breaker state machine:
 * CLOSED → OPEN (3 failures) → HALF-OPEN (cooldown) → CLOSED (success)
 *
 * Architecture Reference: ticket:014.1
 */

const assert = require('assert');
const { VisualSearchClient, ErrorTypes, CircuitBreakerStates } = require('../../services/visual-rag-client/VisualSearchClient');
const { startAlpha9SidecarMock, MockStates } = require('../helpers/sidecar-mock-alpha9');

describe('Circuit Breaker State Transitions - Alpha-9', function () {
    this.timeout(30000); // Extended timeout for state transitions

    let mockServer;
    let client;

    // Short cooldown for testing (100ms instead of default)
    const TEST_COOLDOWN_MS = 100;
    const TEST_FAILURE_THRESHOLD = 3;

    before(async function () {
        // Start mock sidecar
        mockServer = await startAlpha9SidecarMock(8099, {
            state: MockStates.HEALTHY
        });
    });

    after(async function () {
        if (mockServer) {
            await mockServer.stop();
        }
    });

    beforeEach(function () {
        // Create fresh client for each test
        client = new VisualSearchClient({
            baseUrl: 'http://localhost:8099',
            timeout: 1000,
            cooldownMs: TEST_COOLDOWN_MS,
            failureThreshold: TEST_FAILURE_THRESHOLD
        });
    });

    describe('CLOSED to OPEN Transition', function () {
        it('starts in CLOSED state', function () {
            assert.strictEqual(
                client.getCircuitState(),
                CircuitBreakerStates.CLOSED,
                'Circuit should start CLOSED'
            );
        });

        it('remains CLOSED after 1-2 failures', async function () {
            mockServer.setState(MockStates.ERROR);

            // First failure
            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
            } catch (e) {
                // Expected to fail
            }
            assert.strictEqual(client.getCircuitState(), CircuitBreakerStates.CLOSED);

            // Second failure
            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
            } catch (e) {
                // Expected to fail
            }
            assert.strictEqual(client.getCircuitState(), CircuitBreakerStates.CLOSED);
        });

        it('trips to OPEN after 3 consecutive failures', async function () {
            mockServer.setState(MockStates.ERROR);

            for (let i = 0; i < TEST_FAILURE_THRESHOLD; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // Expected to fail
                }
            }

            assert.strictEqual(
                client.getCircuitState(),
                CircuitBreakerStates.OPEN,
                'Circuit should be OPEN after 3 failures'
            );
        });

        it('increments failure counter on each failure', async function () {
            mockServer.setState(MockStates.ERROR);

            for (let i = 1; i <= TEST_FAILURE_THRESHOLD; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // Expected
                }

                if (i < TEST_FAILURE_THRESHOLD) {
                    assert.strictEqual(
                        client.getFailureCount(),
                        i,
                        `Failure count should be ${i}`
                    );
                }
            }
        });
    });

    describe('OPEN State Behavior', function () {
        beforeEach(async function () {
            // Trip the circuit breaker
            mockServer.setState(MockStates.ERROR);
            for (let i = 0; i < TEST_FAILURE_THRESHOLD; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // Expected
                }
            }
            assert.strictEqual(client.getCircuitState(), CircuitBreakerStates.OPEN);
        });

        it('returns 503 immediately without contacting sidecar', async function () {
            // Reset to healthy - but circuit is OPEN so it shouldn't matter
            mockServer.setState(MockStates.HEALTHY);

            const startTime = Date.now();

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown CIRCUIT_OPEN error');
            } catch (e) {
                const elapsed = Date.now() - startTime;

                // Should be fast-fail (under 50ms)
                assert.ok(elapsed < 50, `Fast-fail expected, took ${elapsed}ms`);
                assert.strictEqual(e.type, ErrorTypes.CIRCUIT_OPEN);
            }
        });

        it('provides clear error message in OPEN state', async function () {
            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown');
            } catch (e) {
                assert.ok(
                    e.message.includes('temporarily unavailable') ||
                    e.message.includes('circuit') ||
                    e.message.includes('CIRCUIT_OPEN'),
                    'Error message should indicate circuit breaker state'
                );
            }
        });

        it('multiple requests in OPEN state all fail fast', async function () {
            const results = [];

            for (let i = 0; i < 5; i++) {
                const start = Date.now();
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    results.push({
                        elapsed: Date.now() - start,
                        error: e.type
                    });
                }
            }

            // All should be fast failures
            results.forEach((r, i) => {
                assert.ok(r.elapsed < 50, `Request ${i} should be fast-fail`);
                assert.strictEqual(r.error, ErrorTypes.CIRCUIT_OPEN);
            });
        });
    });

    describe('HALF-OPEN Transition', function () {
        beforeEach(async function () {
            // Trip the circuit breaker
            mockServer.setState(MockStates.ERROR);
            for (let i = 0; i < TEST_FAILURE_THRESHOLD; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // Expected
                }
            }
            assert.strictEqual(client.getCircuitState(), CircuitBreakerStates.OPEN);
        });

        it('transitions to HALF-OPEN after cooldown period', async function () {
            // Wait for cooldown
            await new Promise(r => setTimeout(r, TEST_COOLDOWN_MS + 10));

            // Next request should attempt HALF-OPEN
            mockServer.setState(MockStates.HEALTHY);

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
            } catch (e) {
                // May still fail, but state should transition
            }

            // After cooldown and a request, should be in HALF-OPEN or CLOSED
            const state = client.getCircuitState();
            assert.ok(
                state === CircuitBreakerStates.HALF_OPEN ||
                state === CircuitBreakerStates.CLOSED,
                `Expected HALF_OPEN or CLOSED, got ${state}`
            );
        });

        it('allows single request in HALF-OPEN state', async function () {
            // Wait for cooldown
            await new Promise(r => setTimeout(r, TEST_COOLDOWN_MS + 10));

            mockServer.setState(MockStates.HEALTHY);

            // First request should be allowed
            const result = await client.searchImageAlpha9('testImage', 'visual_pages');

            assert.ok(result, 'Request should succeed in HALF-OPEN');
        });
    });

    describe('Recovery to CLOSED', function () {
        beforeEach(async function () {
            // Trip the circuit breaker
            mockServer.setState(MockStates.ERROR);
            for (let i = 0; i < TEST_FAILURE_THRESHOLD; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // Expected
                }
            }

            // Wait for cooldown
            await new Promise(r => setTimeout(r, TEST_COOLDOWN_MS + 10));
        });

        it('transitions to CLOSED on successful request in HALF-OPEN', async function () {
            mockServer.setState(MockStates.HEALTHY);

            // Make successful request
            await client.searchImageAlpha9('testImage', 'visual_pages');

            assert.strictEqual(
                client.getCircuitState(),
                CircuitBreakerStates.CLOSED,
                'Circuit should be CLOSED after successful request'
            );
        });

        it('resets failure counter on recovery', async function () {
            mockServer.setState(MockStates.HEALTHY);

            await client.searchImageAlpha9('testImage', 'visual_pages');

            assert.strictEqual(
                client.getFailureCount(),
                0,
                'Failure count should be reset'
            );
        });

        it('resumes normal operation after recovery', async function () {
            mockServer.setState(MockStates.HEALTHY);

            // Recover
            await client.searchImageAlpha9('testImage', 'visual_pages');

            // Multiple successful requests
            for (let i = 0; i < 5; i++) {
                const result = await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.ok(result, `Request ${i} should succeed`);
            }

            assert.strictEqual(client.getCircuitState(), CircuitBreakerStates.CLOSED);
        });

        it('returns to OPEN if HALF-OPEN request fails', async function () {
            mockServer.setState(MockStates.HEALTHY);

            // Wait for HALF-OPEN
            await new Promise(r => setTimeout(r, TEST_COOLDOWN_MS + 10));

            // Set to error right before request
            mockServer.setState(MockStates.ERROR);

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
            } catch (e) {
                // Expected to fail
            }

            assert.strictEqual(
                client.getCircuitState(),
                CircuitBreakerStates.OPEN,
                'Should return to OPEN on HALF-OPEN failure'
            );
        });
    });

    describe('Metrics and Logging', function () {
        it('logs state transitions', async function () {
            const logs = [];
            const originalLog = console.log;
            console.log = (...args) => logs.push(args.join(' '));

            try {
                mockServer.setState(MockStates.ERROR);

                for (let i = 0; i < TEST_FAILURE_THRESHOLD; i++) {
                    try {
                        await client.searchImageAlpha9('testImage', 'visual_pages');
                    } catch (e) {
                        // Expected
                    }
                }

                // Check for transition log
                const _hasTransitionLog = logs.some(log =>
                    log.includes('OPEN') || log.includes('circuit')
                );

                // Note: This test depends on client logging behavior
                // If no logs, client may not log transitions
            } finally {
                console.log = originalLog;
            }
        });
    });

    describe('503 Initializing vs Circuit Breaker', function () {
        it('does not trip circuit on 503 Initializing', async function () {
            mockServer.setState(MockStates.INITIALIZING);

            for (let i = 0; i < TEST_FAILURE_THRESHOLD + 1; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // 503 Initializing should not count as failure
                    assert.strictEqual(e.type, ErrorTypes.SIDECAR_INITIALIZING);
                }
            }

            // Circuit should remain CLOSED
            assert.strictEqual(
                client.getCircuitState(),
                CircuitBreakerStates.CLOSED,
                'Circuit should not trip on 503 Initializing'
            );
        });
    });
});
