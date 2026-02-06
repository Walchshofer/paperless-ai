/**
 * CircuitBreaker.js
 *
 * Circuit breaker pattern implementation for graceful degradation when Visual Sidecar fails.
 * Protects the pipeline from cascading failures by transitioning through states:
 * CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing recovery)
 *
 * Architecture Reference: Visual RAG Integration, Circuit Breaker Pattern
 * Handoff Prompt: Phase 1 - CircuitBreaker Implementation
 */

const logger = require('../logger');

/**
 * Circuit breaker states
 * @enum {string}
 */
const CircuitState = {
    CLOSED: 'CLOSED',       // Normal operation, all operations allowed
    OPEN: 'OPEN',           // Circuit broken, skip operations gracefully
    HALF_OPEN: 'HALF_OPEN'  // Testing recovery, limited operations
};

/**
 * Default configuration for circuit breaker
 */
const DEFAULT_CONFIG = {
    failureThreshold: 3,        // Consecutive failures to open circuit (deprecated, use baseThreshold)
    baseThreshold: 3,           // Base threshold for adaptive calculation
    cooldownPeriod: 30000,      // 30 seconds before attempting recovery (HALF_OPEN)
    timeout: 500,               // 500ms latency budget
    hardTimeout: 1000,          // 1000ms hard limit
    maxRetries: 3,              // Maximum retry attempts
    backoffMultiplier: 2,       // Exponential backoff multiplier
    initialBackoff: 100,        // Initial backoff in ms (100, 200, 400)
    enableAdaptiveThreshold: true,  // Enable adaptive threshold based on error rate
    windowSize: 20              // Sliding window size for error rate calculation
};

// Shared instances map
const instances = new Map();

/**
 * CircuitBreaker - Implements circuit breaker pattern for external service calls
 *
 * Usage:
 *   const breaker = new CircuitBreaker('visual-sidecar', config);
 *   const result = await breaker.execute(async () => {
 *     return await visualSidecarCall();
 *   });
 */
class CircuitBreaker {
    /**
     * @param {string} serviceName - Name of the service being protected
     * @param {Object} config - Configuration options
     * @param {Object} metricsCollector - Optional Prometheus metrics collector
     */
    constructor(serviceName, config = {}, metricsCollector = null) {
        this.serviceName = serviceName;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.metricsCollector = metricsCollector;

        // Backward compatibility: use failureThreshold as baseThreshold if baseThreshold not provided
        if (config.failureThreshold && !config.baseThreshold) {
            this.config.baseThreshold = config.failureThreshold;
        }

        // State machine
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastStateChangeTime = Date.now();

        // Adaptive threshold tracking
        this.recentOperations = []; // Sliding window: array of {success: boolean, timestamp: number}
        this.currentThreshold = this.config.baseThreshold;
        this.errorRate = 0;

        // Metrics tracking
        this.stats = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            timeoutCalls: 0,
            rejectedCalls: 0, // Calls rejected due to OPEN state
            stateTransitions: {
                CLOSED_TO_OPEN: 0,
                OPEN_TO_HALF_OPEN: 0,
                HALF_OPEN_TO_CLOSED: 0,
                HALF_OPEN_TO_OPEN: 0
            },
            thresholdAdjustments: 0 // Count of threshold adjustments
        };

        logger.info({
            event: 'circuit_breaker_initialized',
            serviceName: this.serviceName,
            config: this.config,
            adaptiveEnabled: this.config.enableAdaptiveThreshold
        });
        if (this.metricsCollector?.recordCircuitBreakerState) {
            this.metricsCollector.recordCircuitBreakerState(this.serviceName, this.state);
        }
    }

    /**
     * Get or create a shared CircuitBreaker instance
     * @param {string} serviceName 
     * @param {Object} config 
     * @param {Object} metricsCollector 
     * @returns {CircuitBreaker}
     */
    static getInstance(serviceName, config = {}, metricsCollector = null) {
        if (!instances.has(serviceName)) {
            instances.set(serviceName, new CircuitBreaker(serviceName, config, metricsCollector));
        }
        return instances.get(serviceName);
    }

    /**
     * Execute a protected operation with circuit breaker pattern
     *
     * @param {Function} operation - Async function to execute
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} Result with { success, data, error, fallback }
     */
    async execute(operation, options = {}) {
        this.stats.totalCalls++;

        // Check if circuit is OPEN
        if (this.state === CircuitState.OPEN) {
            // Check if cooldown period has elapsed
            if (this._shouldAttemptRecovery()) {
                this._transitionTo(CircuitState.HALF_OPEN);
            } else {
                // Circuit still open, reject call gracefully
                this.stats.rejectedCalls++;
                this._recordMetric('rejected');

                logger.warn({
                    event: 'circuit_breaker_rejected',
                    serviceName: this.serviceName,
                    state: this.state,
                    failureCount: this.failureCount,
                    message: 'Circuit breaker is OPEN, operation skipped gracefully'
                });

                return {
                    success: false,
                    data: null,
                    error: new Error(`Circuit breaker OPEN for ${this.serviceName}`),
                    fallback: true,
                    circuitState: this.state
                };
            }
        }

        // Execute operation with timeout and retry logic
        const retries = options.retries || this.config.maxRetries;
        const timeout = options.timeout || this.config.timeout;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                // Apply exponential backoff for retries
                if (attempt > 0) {
                    const backoffMs = this.config.initialBackoff * Math.pow(this.config.backoffMultiplier, attempt - 1);
                    await this._sleep(backoffMs);

                    logger.debug({
                        event: 'circuit_breaker_retry',
                        serviceName: this.serviceName,
                        attempt: attempt + 1,
                        maxRetries: retries + 1,
                        backoffMs
                    });
                }

                // Execute operation with timeout
                const result = await this._executeWithTimeout(operation, timeout);

                // Success - record and potentially close circuit
                this._onSuccess();

                return {
                    success: true,
                    data: result,
                    error: null,
                    fallback: false,
                    circuitState: this.state,
                    attempt: attempt + 1
                };

            } catch (error) {
                const isLastAttempt = attempt === retries;
                const isTimeout = error.name === 'TimeoutError';

                const logPayload = {
                    event: 'circuit_breaker_operation_failed',
                    serviceName: this.serviceName,
                    attempt: attempt + 1,
                    maxRetries: retries + 1,
                    isTimeout,
                    isLastAttempt,
                    error: error.message
                };

                if (isLastAttempt || !isTimeout) {
                    logger.warn(logPayload);
                } else {
                    logger.debug(logPayload);
                }

                if (isTimeout) {
                    this.stats.timeoutCalls++;
                }

                // If last attempt, record failure
                if (isLastAttempt) {
                    this._onFailure(error);

                    return {
                        success: false,
                        data: null,
                        error,
                        fallback: true,
                        circuitState: this.state,
                        attempt: attempt + 1
                    };
                }
            }
        }

        // Should not reach here, but handle defensively
        return {
            success: false,
            data: null,
            error: new Error('Max retries exceeded'),
            fallback: true,
            circuitState: this.state
        };
    }

    /**
     * Execute operation with timeout
     * @private
     */
    async _executeWithTimeout(operation, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const error = new Error(`Operation timeout after ${timeoutMs}ms`);
                error.name = 'TimeoutError';
                reject(error);
            }, timeoutMs);

            try {
                Promise.resolve(operation())
                    .then((result) => {
                        clearTimeout(timer);
                        resolve(result);
                    })
                    .catch((error) => {
                        clearTimeout(timer);
                        reject(error);
                    });
            } catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }

    /**
     * Handle successful operation
     * @private
     */
    _onSuccess() {
        this.stats.successfulCalls++;
        this.failureCount = 0; // Reset failure count
        this.successCount++;
        this._recordMetric('success');

        // Update sliding window and adaptive threshold AFTER recording stats
        // This ensures threshold is updated based on historical data
        this._updateRecentOperations(true);

        // If in HALF_OPEN state, transition back to CLOSED
        if (this.state === CircuitState.HALF_OPEN) {
            logger.info({
                event: 'circuit_breaker_recovery',
                serviceName: this.serviceName,
                message: 'Recovery successful, transitioning to CLOSED state'
            });
            this._transitionTo(CircuitState.CLOSED);
        }
    }

    /**
     * Handle failed operation
     * @private
     */
    _onFailure(error) {
        this.stats.failedCalls++;
        this.failureCount++;
        this.successCount = 0; // Reset success count
        this.lastFailureTime = Date.now();
        this._recordMetric('failure');

        // Determine the threshold to use BEFORE updating the window
        // This uses historical error rate, not including current failure
        const effectiveThreshold = this.config.enableAdaptiveThreshold 
            ? this.currentThreshold 
            : this.config.failureThreshold;

        logger.warn({
            event: 'circuit_breaker_failure',
            serviceName: this.serviceName,
            failureCount: this.failureCount,
            threshold: effectiveThreshold,
            adaptiveThreshold: this.currentThreshold,
            errorRate: this.errorRate.toFixed(3),
            state: this.state,
            error: error.message
        });

        // Check if we should open the circuit BEFORE updating window
        const shouldOpenCircuit = this.state === CircuitState.CLOSED && this.failureCount >= effectiveThreshold;
        const shouldReturnToOpen = this.state === CircuitState.HALF_OPEN;

        // Now update sliding window with this failure
        this._updateRecentOperations(false);

        // Execute state transitions
        if (shouldOpenCircuit) {
            logger.error({
                event: 'circuit_breaker_threshold_exceeded',
                serviceName: this.serviceName,
                failureCount: this.failureCount,
                threshold: effectiveThreshold,
                adaptiveEnabled: this.config.enableAdaptiveThreshold,
                errorRate: this.errorRate.toFixed(3),
                message: 'Failure threshold exceeded, opening circuit'
            });
            this._transitionTo(CircuitState.OPEN);
        } else if (shouldReturnToOpen) {
            // Failed while testing recovery, go back to OPEN
            logger.warn({
                event: 'circuit_breaker_recovery_failed',
                serviceName: this.serviceName,
                message: 'Recovery test failed, returning to OPEN state'
            });
            this._transitionTo(CircuitState.OPEN);
        }
    }

    /**
     * Transition circuit breaker to new state
     * @private
     */
    _transitionTo(newState) {
        const oldState = this.state;
        if (oldState === newState) {
            return; // No transition needed
        }

        this.state = newState;
        this.lastStateChangeTime = Date.now();

        // Reset counters on state transition
        if (newState === CircuitState.CLOSED) {
            this.failureCount = 0;
            this.successCount = 0;
        }

        // Track state transition
        const transitionKey = `${oldState}_TO_${newState}`;
        if (this.stats.stateTransitions[transitionKey] !== undefined) {
            this.stats.stateTransitions[transitionKey]++;
        }

        // Record transition metric
        this._recordStateTransition(oldState, newState);

        logger.info({
            event: 'circuit_breaker_state_transition',
            serviceName: this.serviceName,
            oldState,
            newState,
            failureCount: this.failureCount,
            successCount: this.successCount,
            timestamp: new Date(this.lastStateChangeTime).toISOString()
        });
    }

    /**
     * Check if cooldown period has elapsed and recovery should be attempted
     * @private
     */
    _shouldAttemptRecovery() {
        if (this.state !== CircuitState.OPEN) {
            return false;
        }

        const timeSinceLastFailure = Date.now() - this.lastFailureTime;
        return timeSinceLastFailure >= this.config.cooldownPeriod;
    }

    /**
     * Sleep for specified milliseconds (for backoff)
     * @private
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Record metric for operation result
     * @private
     */
    _recordMetric(type) {
        if (!this.metricsCollector) {
            return;
        }

        // Record operation result metric
        // This will be expanded in Phase 5 with Prometheus integration
        try {
            if (this.metricsCollector.recordCircuitBreakerOperation) {
                this.metricsCollector.recordCircuitBreakerOperation(
                    this.serviceName,
                    type,
                    this.state
                );
            }
        } catch (error) {
            logger.debug({
                event: 'circuit_breaker_metric_error',
                serviceName: this.serviceName,
                error: error.message
            });
        }
    }

    /**
     * Record state transition metric
     * @private
     */
    _recordStateTransition(fromState, toState) {
        if (!this.metricsCollector) {
            return;
        }

        try {
            if (this.metricsCollector.recordCircuitBreakerStateTransition) {
                this.metricsCollector.recordCircuitBreakerStateTransition(
                    this.serviceName,
                    fromState,
                    toState
                );
            }
        } catch (error) {
            logger.debug({
                event: 'circuit_breaker_metric_error',
                serviceName: this.serviceName,
                error: error.message
            });
        }
    }

    /**
     * Update sliding window with operation result
     * @private
     */
    _updateRecentOperations(success) {
        if (!this.config.enableAdaptiveThreshold) {
            return;
        }

        // Add operation to sliding window
        this.recentOperations.push({
            success,
            timestamp: Date.now()
        });

        // Maintain window size
        if (this.recentOperations.length > this.config.windowSize) {
            this.recentOperations.shift();
        }

        // Recalculate error rate and adaptive threshold
        this._updateAdaptiveThreshold();
    }

    /**
     * Calculate error rate from sliding window
     * @private
     * @returns {number} Error rate (0.0 to 1.0)
     */
    _calculateErrorRate() {
        if (!this.config.enableAdaptiveThreshold || this.recentOperations.length === 0) {
            return 0;
        }

        const failures = this.recentOperations.filter(op => !op.success).length;
        return failures / this.recentOperations.length;
    }

    /**
     * Calculate adaptive threshold based on error rate
     * Formula: threshold = baseThreshold × (1 + errorRate)
     * @private
     * @returns {number} Adaptive threshold (rounded up)
     */
    _calculateAdaptiveThreshold() {
        if (!this.config.enableAdaptiveThreshold) {
            return this.config.baseThreshold;
        }

        const errorRate = this._calculateErrorRate();
        const adaptiveThreshold = this.config.baseThreshold * (1 + errorRate);
        return Math.ceil(adaptiveThreshold); // Round up to nearest integer
    }

    /**
     * Update adaptive threshold and log if changed
     * @private
     */
    _updateAdaptiveThreshold() {
        if (!this.config.enableAdaptiveThreshold) {
            return;
        }

        const previousThreshold = this.currentThreshold;
        const previousErrorRate = this.errorRate;
        
        this.errorRate = this._calculateErrorRate();
        this.currentThreshold = this._calculateAdaptiveThreshold();

        if (this.currentThreshold !== previousThreshold) {
            this.stats.thresholdAdjustments++;

            logger.info({
                event: 'circuit_breaker_threshold_adjusted',
                serviceName: this.serviceName,
                previousThreshold,
                newThreshold: this.currentThreshold,
                errorRate: this.errorRate.toFixed(3),
                previousErrorRate: previousErrorRate.toFixed(3),
                windowSize: this.recentOperations.length,
                baseThreshold: this.config.baseThreshold
            });

            // Record threshold adjustment metric
            if (this.metricsCollector?.recordCircuitBreakerThresholdAdjustment) {
                this.metricsCollector.recordCircuitBreakerThresholdAdjustment(
                    this.serviceName,
                    previousThreshold,
                    this.currentThreshold,
                    this.errorRate
                );
            }
        }
    }

    /**
     * Get current circuit breaker state
     * @returns {string} Current state (CLOSED, OPEN, HALF_OPEN)
     */
    getState() {
        return this.state;
    }

    /**
     * Get circuit breaker statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            ...this.stats,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastStateChangeTime: this.lastStateChangeTime,
            // Adaptive threshold stats
            adaptiveThresholdEnabled: this.config.enableAdaptiveThreshold,
            currentThreshold: this.currentThreshold,
            baseThreshold: this.config.baseThreshold,
            errorRate: this.errorRate,
            windowSize: this.recentOperations.length,
            maxWindowSize: this.config.windowSize
        };
    }

    /**
     * Reset circuit breaker to initial state
     * Useful for testing or manual recovery
     */
    reset() {
        logger.info({
            event: 'circuit_breaker_reset',
            serviceName: this.serviceName,
            previousState: this.state
        });

        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastStateChangeTime = Date.now();
    }

    /**
     * Check if circuit is healthy (CLOSED state)
     * @returns {boolean} True if circuit is CLOSED
     */
    isHealthy() {
        return this.state === CircuitState.CLOSED;
    }

    /**
     * Check if circuit is open (failing)
     * @returns {boolean} True if circuit is OPEN
     */
    isOpen() {
        return this.state === CircuitState.OPEN;
    }

    /**
     * Check if circuit is in recovery testing mode
     * @returns {boolean} True if circuit is HALF_OPEN
     */
    isTesting() {
        return this.state === CircuitState.HALF_OPEN;
    }
}

module.exports = {
    CircuitBreaker,
    CircuitState,
    DEFAULT_CONFIG
};
