# PHASE 4: Visual Query Execution

**Phase Number:** 4 of 6  
**Assigned Agent:** @agent-pipeline-orchestration-expert  
**Status:** Ready after Phase 3 complete  
**Prerequisite:** Phases 1, 2, & 3 complete and tested  

## Domain Keywords (for routing classification)

`pipeline` `orchestrate` `workflow` `chain` `execute` `batch` `streaming` `retry` `validation` `error-handling` `circuit-breaker` `timeout` `fallback`

**Expected Classification:** @agent-pipeline-orchestration-expert

## Prerequisites Met

### From Phase 1
- CircuitBreaker.js implemented and protecting sidecar calls
- State machine operational
- Failure threshold: 3 consecutive failures
- Cooldown: 30 seconds

### From Phase 2
- Parallel OCR execution working
- mergeOcrResults() complete
- Document metadata available (type, confidence)

### From Phase 3
- Visual query generation implemented
- Minimum 3 queries per document
- Logit bias configured per query
- Query validation: all required fields present
- Phase 3 tests passing

### From Repository
- Visual RAG sidecar deployed and accessible
- Embedding model available (as configured)
- Database schema for storing visual query results

## Objective

Execute visual queries against the Visual RAG sidecar and merge results with extraction output.

Purpose:
- Execute each generated query via sidecar
- Apply circuit breaker protection (500ms budget, 1000ms hard timeout)
- Deduplicate overlapping bounding boxes (IoU threshold: 0.7)
- Merge visual results with extraction output
- Update field confidence scores with visual confirmations
- Calculate overlay positions for UI rendering
- Handle failures gracefully (partial results acceptable)

## Requirements

### Query Execution
- Execute each visual query via sidecar with circuit breaker protection
- Timeout budget: 500ms per query (hard timeout: 1000ms)
- Max 5 concurrent queries per document
- Exponential backoff on timeout: 100ms, 200ms, 400ms
- Retry failed queries up to 3 times
- If circuit breaker OPEN: skip visual queries, continue with extraction-only

### Dynamic K Calculation

Calculate K (number of search results) per query:

`K = base_K * (1 + (1 - confidence) * 0.5) * (1 + rarity_factor)`

Where:
- base_K: `field_extraction=3`, `validation=5`, `exploration=10`
- confidence: extraction confidence (0.0–1.0)
- rarity_factor: field rarity (0.0–1.0)

Example:
- type=field_extraction (base_K=3)
- confidence=0.6 → factor=1.2
- rarity=0.3 → factor=1.3
- K = 3 * 1.2 * 1.3 = 4.68 → 5

### Result Processing
- Receive bounding boxes and scores from sidecar
- Deduplicate overlapping boxes (IoU > 0.7 ⇒ merge)
- Sort by confidence score (descending)
- Match to extracted fields by position and `field_target`
- Calculate overlay positions (x, y, width, height normalized to 0–1)

### Confidence Score Fusion
For each field with visual confirmation:

`updated_confidence = extraction_confidence * 0.6 + visual_confidence * 0.4`

For newly discovered fields (no extraction match):
- create new field entry
- confidence = visual_confidence
- flag `newly_discovered=true`

### Error Handling
- Individual query timeout: skip that query, continue others
- Circuit breaker OPEN: skip all visual queries, continue extraction-only
- Sidecar API error: retry with backoff; fallback if retries exhausted
- Partial results: accept and merge what succeeded; log failures

## Expected Deliverables

### Code
- Visual query executor stage (~350 lines)
- Dynamic K calculation function
- Bounding box deduplication (IoU-based)
- Result aggregation and field matching
- Confidence fusion logic
- Overlay position calculation
- Circuit breaker integration
- Retry logic with exponential backoff
- Error handlers for all failure modes

### Testing
- Unit tests: Dynamic K (8+ scenarios)
- Unit tests: IoU deduplication (6+ scenarios)
- Unit tests: confidence fusion (5+ scenarios)
- Integration tests: Phase 3 → Phase 4 flow (5+ scenarios)
- Performance tests: latency targets
- E2E test: extraction → query execution → UI overlay flow

### Documentation
- Code comments on critical paths
- Function docs with examples
- Integration guide (Phase 3 → Phase 4)
- Overlay position reference
- Error-handling notes
- Performance tuning notes

## Success Criteria (Acceptance Tests)
- Query execution success rate ≥ 95%
- All queries complete within 500ms budget (P95)
- 5 concurrent queries complete within 500ms total (P95)
- Dynamic K calculated correctly for all query types
- Bounding boxes deduplicated correctly (IoU threshold 0.7)
- Field confidence scores updated correctly (0.6/0.4 weights)
- Overlay positions accurate within ± 5 pixels
- Circuit breaker prevents cascading failures
- Graceful degradation on timeout/failure (no pipeline crash)
- All unit/integration/perf/E2E tests passing
- Ready for Phase 5 integration

## Test Execution Instructions

```bash
# Unit tests (examples; adjust to your repo)
npm test -- Phase4-DynamicK.test.js --verbose
npm test -- Phase4-Deduplication.test.js --verbose
npm test -- Phase4-ConfidenceFusion.test.js --verbose
npm test -- Phase4-OverlayCalculation.test.js --verbose

# Integration tests
npm test -- Phase3-Phase4-Integration.test.js --verbose

# Performance tests
npm test -- Phase4-Performance.test.js --verbose

# E2E tests
npm test -- FullPipeline-Phase4.test.js --verbose
```

## Integration Points (Reference)

Reference doc:
- `.claude/HANDOFF_PROMPT.xml`

### Input from Phase 3
```js
const phase3Output = { visual_queries: [/* ... */] };
```

### Input from Extraction
```js
const extractionResults = { fields: {/* ... */} };
```

### Output for Phase 5/6
```js
const phase4Output = {
  fields: [/* merged fields */],
  newly_discovered_fields: [/* ... */],
  execution_metadata: {
    total_queries_executed: number,
    successful_queries: number,
    failed_queries: number,
    timeout_queries: number,
    circuit_breaker_state: "CLOSED" | "OPEN" | "HALF_OPEN",
    total_latency_ms: number,
    average_query_latency_ms: number,
    visual_confirmation_rate: number
  }
};
```

## Constraints & Notes
- Do NOT modify Phases 1–3 implementations
- Overlay positions must be normalized (0–1), not pixels
- IoU threshold default must be exactly 0.7
- Fusion weights default: 0.6 extraction, 0.4 visual
