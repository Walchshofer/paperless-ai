# PHASE 6: Testing and Validation (Final)

**Phase Number:** 6 of 6  
**Assigned Agent:** @agent-debug-agent (or @general-purpose)  
**Status:** Ready after Phases 1–5 complete  
**Prerequisite:** All components from Phases 1–5 implemented and instrumented  

## Domain Keywords (for routing classification)

`test` `mocha` `chai` `jasmine` `coverage` `unit-test` `integration-test` `e2e-test` `fixture` `mock` `stub` `spy` `assertion` `test-suite` `validation` `accuracy`

**Expected Classification:** @agent-debug-agent or @general-purpose

## Prerequisites Met
- Phase 1: CircuitBreaker implemented
- Phase 2: Parallel OCR + reconciliation implemented
- Phase 3: Query generation implemented
- Phase 4: Query execution + merge implemented
- Phase 5: Metrics implemented
- Test tooling + fixtures present in repo
- Visual sidecar accessible for integration tests

## Objective

Comprehensive validation of the complete Expert Pipeline (formerly SSOT Retrieval Broker) + Visual RAG integration pipeline.

Purpose:
- Unit test all new components (Phases 1–5)
- Integration test cross-phase interactions
- Performance test latency targets
- Failure scenario testing (graceful degradation)
- End-to-end validation (full pipeline)
- Accuracy validation (precision/recall/F1)
- Reliability validation (no deadlocks/races)

## Requirements

### Test Suite Structure

#### Unit Tests (target 40+ scenarios)
Cover:
- CircuitBreaker transitions and concurrency
- OCR parallelism and reconciliation logic
- Query generation: minimum 3 queries, validation, logit bias
- Query execution: dynamic K, timeouts, retries, dedup, fusion
- Metrics: registration, labels, exporters, overhead

#### Integration Tests (target 20+ scenarios)
Cover:
- Phase 1 ↔ 2: breaker protects OCR
- Phase 2 ↔ 3: extraction outputs feed query gen
- Phase 3 ↔ 4: generated queries execute and merge
- Phase 4 ↔ 5: metrics captured per stage
- Full pipeline: non-blocking failures, partial results, end-to-end

#### Performance Tests (target 10+ scenarios)
Targets (P95, per docs/VISUAL_RAG_INTEGRATION.md):
- Parallel OCR < 1000ms
- Query generation < 200ms
- Per-query exec < 500ms
- 5 concurrent queries < 500ms total
- End-to-end per document < 2000ms
Also: throughput and leak checks (100–1000 docs)

#### Failure Scenario Tests (target 15+ scenarios)
Cover:
- sidecar timeouts/unavailability
- one OCR track fails
- query generation fails
- taxonomy unavailable
- malformed bbox and out-of-range confidence
- ensure graceful degradation (no crash)

#### E2E Tests (target 5+ scenarios)
Cover:
- happy path
- degraded paths (sidecar fail / gen fail / OCR fail)
- accuracy validation (F1/precision/recall)
- reliability (no deadlocks/races)

## Expected Deliverables

### Test Code
- Unit tests:
  - Phase1CircuitBreaker.test.js
  - Phase2OCRReconciliation.test.js
  - Phase3QueryGeneration.test.js
  - Phase4QueryExecution.test.js
  - Phase5Metrics.test.js
- Integration tests:
  - Phase1-Phase2-Integration.test.js
  - Phase2-Phase3-Integration.test.js
  - Phase3-Phase4-Integration.test.js
  - Phase4-Phase5-Integration.test.js
  - FullPipeline.test.js
- Performance tests:
  - Latency.perf.test.js
  - Throughput.perf.test.js
  - ResourceUsage.perf.test.js
- Failure scenarios:
  - FailureScenarios.test.js
  - GracefulDegradation.test.js
- E2E:
  - EndToEnd.test.js
  - AccuracyValidation.test.js

### Reports
- `TEST_RESULTS.md` (summary, timings, coverage, perf metrics)
- `ISSUES_AUDIT_REPORT.md` (only if failures; includes RCA notes)
- `CODE_QUALITY_AUDIT.md` (style/docs/perf/security review notes)

## Success Criteria

### Coverage and Pass Rate
- All unit tests passing (100%)
- All integration tests passing (100%)
- All performance tests passing
- All failure scenario tests passing
- All E2E tests passing
- Coverage ≥ 95% on critical paths
- Zero skipped/pending tests (unless explicitly justified)

### Performance
- Parallel OCR < 1000ms (P95)
- Query generation < 200ms (P95)
- Per-query execution < 500ms (P95)
- 5 concurrent queries < 500ms total (P95)
- End-to-end < 2000ms per document (P95)
- Metrics overhead < 5%
- No memory leaks over extended runs

### Accuracy
- precision > 0.95
- recall > 0.90
- F1 > 0.92
- overlay positions are normalized (0–1), not pixels
- visual confirmation rate > 0.80

### Reliability
- deadlocks = 0
- race conditions = 0
- pipeline crashes = 0
- graceful degradation confirmed for all failure types

## Test Execution Instructions

```bash
npm install
npm run test:setup
npm run services:start

# Full suite
npm test -- --verbose

# By category (examples; adjust)
npm test -- --grep "unit" --verbose
npm test -- --grep "integration" --verbose
npm test -- --grep "performance" --verbose
npm test -- --grep "failure|degradation" --verbose
npm test -- --grep "e2e|end-to-end" --verbose

# Coverage
npm run test:coverage

# Report generation
npm run test:report
```

## Issue Handling Protocol
If tests fail:
- write/update `ISSUES_AUDIT_REPORT.md` with stack traces + severity
- optionally invoke @agent-debug-agent for RCA
- apply fixes to originating phase (1–5)
- rerun affected tests until 100% pass

## Reference
- `.claude/HANDOFF_PROMPT.xml` (full acceptance criteria and integration points)
