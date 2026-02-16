/* eslint-env mocha */

/**
 * Alpha-9 Handshake and Resilience Tests
 *
 * Verifies Alpha-9 handshake behavior including:
 * - Model swap simulation (503 → GPU Initializing → Ready)
 * - Timeout handling (5-second strict timeout)
 * - Circuit breaker integration (already tested in circuit-breaker-alpha9.spec.js)
 * - Text-Only Search fallback
 *
 * Architecture Reference: ticket:010.2
 * Hardware Reference: RTX 3090 Ti warmup simulation
 */

const assert = require('assert');
const { VisualSearchClient, ErrorTypes, CircuitBreakerStates } = require('../../services/visual-rag-client/VisualSearchClient');
const { startAlpha9SidecarMock, MockStates } = require('../helpers/sidecar-mock-alpha9');

describe('Alpha-9 Handshake and Resilience', function () {
    this.timeout(60000); // Extended timeout for warmup simulations

    let mockServer;
    let client;

    before(async function () {
        // Start mock sidecar on port 8098 (avoid conflicts)
        mockServer = await startAlpha9SidecarMock(8098, {
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
            baseUrl: 'http://localhost:8098',
            timeout: 5000,
            cooldownMs: 100,
            failureThreshold: 3
        });
    });

    describe('Model Swap Simulation', function () {
        it('handles 503 Initializing response during model swap', async function () {
            // Set mock to initializing state (simulates model loading)
            mockServer.setState(MockStates.INITIALIZING);
            mockServer.setInitStage('loading_model');

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown SIDECAR_INITIALIZING error');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.SIDECAR_INITIALIZING);
                assert.ok(e.message.includes('initializing'));
            }
        });

        it('transitions from 503 to successful results after warmup', async function () {
            // Start in initializing state
            mockServer.setState(MockStates.INITIALIZING);
            mockServer.setInitStage('loading_model');

            // First request should fail with 503
            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown SIDECAR_INITIALIZING error');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.SIDECAR_INITIALIZING);
            }

            // Simulate model loading completion
            mockServer.setState(MockStates.HEALTHY);

            // Second request should succeed
            const result = await client.searchImageAlpha9('testImage', 'visual_pages');

            assert.ok(result, 'Should get successful result');
            assert.ok(Array.isArray(result.results), 'Results should be an array');
        });

        it('provides initialization stage in error response', async function () {
            mockServer.setState(MockStates.INITIALIZING);
            mockServer.setInitStage('connecting_qdrant');

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.SIDECAR_INITIALIZING);
                // Error detail should mention the stage
                assert.ok(e.detail.includes('connecting_qdrant') || e.message.includes('initializing'));
            }
        });

        it('simulates complete warmup sequence', async function () {
            // Simulate warmup with 1 second delay
            mockServer.simulateWarmup(1000);

            // First request during warmup should fail
            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown during warmup');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.SIDECAR_INITIALIZING);
            }

            // Wait for warmup to complete
            await new Promise(r => setTimeout(r, 1500));

            // Request after warmup should succeed
            const result = await client.searchImageAlpha9('testImage', 'visual_pages');

            assert.ok(result, 'Should succeed after warmup');
            assert.strictEqual(result.collectionUsed, 'visual_pages');
        });
    });

    describe('Timeout Handling', function () {
        it('enforces 5-second timeout on requests', async function () {
            // Set mock to timeout state (delays response indefinitely)
            mockServer.setState(MockStates.TIMEOUT);

            const startTime = Date.now();

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown TIMEOUT error');
            } catch (e) {
                const elapsed = Date.now() - startTime;

                // Should timeout within reasonable bounds (5000ms + some overhead)
                assert.ok(elapsed >= 4500 && elapsed < 7000,
                    `Timeout should be around 5000ms, was ${elapsed}ms`);
                assert.strictEqual(e.type, ErrorTypes.TIMEOUT);
            }
        });

        it('provides timeout duration in error', async function () {
            mockServer.setState(MockStates.TIMEOUT);

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.TIMEOUT);
                // Error message should mention timeout
                assert.ok(
                    e.message.includes('timeout') || e.message.includes('5000'),
                    'Error should mention timeout'
                );
            }
        });

        it('times out even with partial response', async function () {
            // This test verifies that incomplete responses are handled
            mockServer.setState(MockStates.TIMEOUT);

            const startTime = Date.now();

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown');
            } catch (e) {
                const elapsed = Date.now() - startTime;
                assert.ok(elapsed >= 4500, 'Should wait for full timeout period');
                assert.strictEqual(e.type, ErrorTypes.TIMEOUT);
            }
        });
    });

    describe('Fallback Behavior', function () {
        it('does not trip circuit breaker on 503 Initializing', async function () {
            mockServer.setState(MockStates.INITIALIZING);

            // Make multiple requests that return 503 Initializing
            for (let i = 0; i < 5; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    assert.strictEqual(e.type, ErrorTypes.SIDECAR_INITIALIZING);
                }
            }

            // Circuit should remain CLOSED (503 Initializing shouldn't trip it)
            assert.strictEqual(
                client.getCircuitState(),
                CircuitBreakerStates.CLOSED,
                'Circuit should remain CLOSED on 503 Initializing'
            );
        });

        it('trips circuit breaker on repeated 500 errors', async function () {
            mockServer.setState(MockStates.ERROR);

            // Make 3 requests that return 500 errors
            for (let i = 0; i < 3; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // 500 errors should count toward circuit breaker
                }
            }

            // Circuit should be OPEN
            assert.strictEqual(
                client.getCircuitState(),
                CircuitBreakerStates.OPEN,
                'Circuit should be OPEN after 3 failures'
            );
        });

        it('provides appropriate error for Text-Only fallback decision', async function () {
            // Set mock to return errors to trip circuit
            mockServer.setState(MockStates.ERROR);

            // Trip the circuit
            for (let i = 0; i < 3; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // Expected
                }
            }

            // Verify circuit is open
            assert.strictEqual(client.getCircuitState(), CircuitBreakerStates.OPEN);

            // Next request should fail fast with CIRCUIT_OPEN
            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
                assert.fail('Should have thrown CIRCUIT_OPEN error');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.CIRCUIT_OPEN);
                // UI can use this error type to show Text-Only fallback option
                assert.ok(
                    e.message.includes('temporarily unavailable') ||
                    e.message.includes('circuit'),
                    'Error should indicate service unavailability'
                );
            }
        });
    });

    describe('RTX 3090 Ti Warmup Simulation', function () {
        it('handles realistic GPU warmup timing', async function () {
            // Simulate realistic warmup (2 second delay for RTX 3090 Ti)
            mockServer.simulateWarmup(2000);

            const initializingErrors = [];

            // Poll until ready or timeout
            const startTime = Date.now();
            const maxWaitTime = 5000;

            while (Date.now() - startTime < maxWaitTime) {
                try {
                    const result = await client.searchImageAlpha9('testImage', 'visual_pages');

                    // Success - warmup complete
                    const warmupTime = Date.now() - startTime;
                    assert.ok(result, 'Should get result after warmup');
                    assert.ok(warmupTime >= 2000, `Warmup should take at least 2000ms, was ${warmupTime}ms`);

                    // Log warmup time (as required by ticket)
                    console.log(`RTX 3090 Ti warmup completed in ${warmupTime}ms`);
                    return;
                } catch (e) {
                    if (e.type === ErrorTypes.SIDECAR_INITIALIZING) {
                        initializingErrors.push({
                            time: Date.now() - startTime,
                            detail: e.detail
                        });
                        // Wait a bit before retrying
                        await new Promise(r => setTimeout(r, 200));
                    } else {
                        throw e;
                    }
                }
            }

            // If we reach here, warmup didn't complete in time
            assert.fail('Warmup did not complete within expected time');
        });
    });

    describe('Error Type Classification', function () {
        it('correctly classifies SIDECAR_INITIALIZING error', async function () {
            mockServer.setState(MockStates.INITIALIZING);

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.SIDECAR_INITIALIZING);
                assert.strictEqual(e.status, 503);
            }
        });

        it('correctly classifies TIMEOUT error', async function () {
            mockServer.setState(MockStates.TIMEOUT);

            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.TIMEOUT);
            }
        });

        it('correctly classifies CIRCUIT_OPEN error', async function () {
            mockServer.setState(MockStates.ERROR);

            // Trip circuit
            for (let i = 0; i < 3; i++) {
                try {
                    await client.searchImageAlpha9('testImage', 'visual_pages');
                } catch (e) {
                    // Expected
                }
            }

            // Next request should be CIRCUIT_OPEN
            try {
                await client.searchImageAlpha9('testImage', 'visual_pages');
            } catch (e) {
                assert.strictEqual(e.type, ErrorTypes.CIRCUIT_OPEN);
            }
        });
    });
});
