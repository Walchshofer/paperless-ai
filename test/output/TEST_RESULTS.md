# Test Results

## Runs
- `npm test` (full suite): 325 passing, 0 pending, 0 failing (~10s).
- `npm run test:performance`: 10 passing (~0.1s).
- `npm run test:coverage`: coverage captured with `c8` (full suite).

## Pending Tests
- None.

## Coverage
- Statements: 55.43% (17149/30938)
- Branches: 59.91% (1224/2043)
- Functions: 40.73% (310/761)
- Lines: 55.43% (17149/30938)
- Report: `coverage/lcov-report/index.html`.

## Performance
- Executed performance suites under `test/performance/` (latency, throughput, resource usage).

## Notes
- Bias Engine integration tests run against local mock servers by default; set `BIAS_ENGINE_TEST_MODE=external` for live services.
- Guidance health check exercised via mock unless external mode is enabled.
