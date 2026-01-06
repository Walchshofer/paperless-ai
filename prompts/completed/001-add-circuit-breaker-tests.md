# Circuit Breaker Test Suite

Create comprehensive unit tests for the CircuitBreaker implementation with coverage for:

1. **State Transitions**
   - CLOSED → OPEN (after threshold failures)
   - OPEN → HALF_OPEN (after timeout)
   - HALF_OPEN → CLOSED (on success)
   - HALF_OPEN → OPEN (on failure)

2. **Failure Tracking**
   - Success count resets on state change
   - Failure count increments correctly
   - Threshold detection

3. **Timer Behavior**
   - Timeout in OPEN state
   - Half-open trial window

Use Mocha framework with chai assertions. Include edge cases and error scenarios.
