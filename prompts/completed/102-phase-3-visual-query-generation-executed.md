---
execution_mode: direct
execution_strategy: sequential
primary_executor: guidance-expert
domain_classification: guidance-expert
domain_confidence: HIGH
error_recovery_used: false
error_recovery_agent: none
recovery_successful: n/a
recovery_attempts: 0
parallel: false
timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
status: success
implementation_approach: direct_implementation
note: Implemented Phase 3 with VisualQueryGenerator module, stage registration, and comprehensive tests
---

# PHASE 3: Visual Query Generation Integration

**Phase Number:** 3 of 6  
**Assigned Agent:** @agent-guidance-expert  
**Status:** Ready to start  
**Prerequisite:** Phases 1 & 2 complete and tested  

## Domain Keywords (for routing classification)

`guidance` `guidance-framework` `gen()` `select()` `regex` `template` `structured-output` `logit-bias` `constraint` `local-patch` `json-schema`

**Expected Classification:** @agent-guidance-expert

## Prerequisites Met

### From Phase 1
- CircuitBreaker.js implemented and working
- State machine (CLOSED/OPEN/HALF_OPEN) operational
- Failure threshold: 3 consecutive failures
- Cooldown: 30 seconds before HALF_OPEN attempt

### From Phase 2
- PaperlessService.js with getFieldTaxonomy() function
- Parallel OCR execution (Visual + Tesseract) working
- mergeOcrResults() reconciliation function complete
- Conflict rate < 10% verified by tests
- All Phase 2 tests passing

### From Repository
- ExpertRegistry.js available
- GuidanceTemplate system (base + domain variants) available
- Extraction pipeline producing field confidence scores
- Database schema for storing visual queries

## Objective

Integrate visual query generation into the SSOT Retrieval Broker extraction pipeline.

Purpose:
- Generate targeted visual queries for missing or low-confidence fields
- Use Guidance framework (gen/select/regex) for structured output
- Apply logit bias for JSON structure and field-name prioritization
- Degrade gracefully if generation fails (pipeline continues)

## Requirements

### Query Generation
- Generate minimum 3 queries per document
- Target missing fields first (confidence < threshold)
- Target low-confidence extracted fields second
- Each query must have:
  - `question`: natural language query (1–2 sentences)
  - `field_target`: target field name from schema
  - `expected_element_type`: `field_extraction` | `validation` | `exploration`
  - `priority`: 0.0–1.0 ranking (higher = more important)
  - `confidence`: expected confidence level (0.0–1.0)
  - `rarity_factor`: field rarity in taxonomy (0.0–1.0)
  - `logit_bias`: token biasing configuration for structured output

### Integration
- Register `STAGE_VISUAL_QUERY_GENERATION` in ExpertRegistry
- Load `custom_field_taxonomy` from `PaperlessService.getFieldTaxonomy()`
- Access extraction results: field confidence scores + missing fields
- Access OCR text: reconciled text from Phase 2
- Integrate with GuidanceTemplate system (e.g., `visual_query_generator_de.py` or your equivalent)

### Logit Bias Configuration
For each query, configure logit bias to boost:
- JSON structure tokens: `{`, `}`, `[`, `]`, `:`, `"`
- Field names from schema (tokenized)
- Enum values for constrained fields
- Date/number format tokens (context-dependent)

### Graceful Degradation
- If query generation fails: skip visual query stage, continue with extraction-only results
- If field taxonomy unavailable: use fallback field set
- If GuidanceTemplate fails: return empty queries, do not crash pipeline
- All failures logged but non-blocking

## Expected Deliverables

### Code
- STAGE_VISUAL_QUERY_GENERATION implementation (~300 lines)
- Query prioritization logic (missing fields first)
- Logit bias configuration builder
- Graceful degradation handlers
- Integration with ExpertRegistry
- Integration with GuidanceTemplate system

### Testing
- Unit tests: query generation (10+ scenarios)
  - minimum 3 queries generated per document
  - priority ranking correct
  - field target validation
  - rarity factor calculation
  - logit bias token selection
- Unit tests: logit bias configuration (5+ scenarios)
- Integration tests: Phase 2 → Phase 3 flow (5+ scenarios)
  - various extraction confidence levels
  - missing fields
  - taxonomy unavailable
  - graceful degradation on failures
- E2E test: extraction → query generation flow

### Documentation
- Code comments on critical paths
- Function documentation with examples
- Integration guide (Phase 2 → Phase 3)
- Error-handling notes

## Success Criteria (Acceptance Tests)

- Query generation success rate ≥ 95%
- Minimum 3 queries generated per document (100% of documents)
- All queries include required fields (`question`, `field_target`, `expected_element_type`)
- Field targets exist in extraction schema or custom taxonomy (100% valid)
- Logit bias tokens valid for structured output
- Priority, confidence, rarity are within [0.0, 1.0]
- Zero pipeline failures if query generation fails (graceful degradation)
- All unit tests passing
- All integration tests passing
- Ready for Phase 4 integration

## Test Execution Instructions

Run from repository root:

```bash
# Unit tests (examples; adjust names to your repo)
npm test -- Phase3.test.js --verbose
npm test -- QueryGeneration.test.js --verbose
npm test -- LogitBias.test.js --verbose

# Integration tests
npm test -- Phase2-Phase3-Integration.test.js --verbose

# E2E test
npm test -- FullPipeline-Phase3.test.js --verbose
```

## Integration Points (Reference)

Reference document for full context (do not pass to slash command directly):
- `.claude/HANDOFF_PROMPT.xml`

### Input from Phase 2
```js
const phase2Output = {
  reconciled_ocr_text: string,
  conflict_rate: number,          // < 0.10
  source_attribution: object,
  visual_elements: array,
  document_type: string
};
```

### Output for Phase 4
```js
const phase3Output = {
  visual_queries: [
    {
      question: string,
      field_target: string,
      expected_element_type: "field_extraction" | "validation" | "exploration",
      priority: number,
      confidence: number,
      rarity_factor: number,
      logit_bias: object
    }
  ],
  generation_metadata: {
    total_queries_generated: number,
    success_rate: number,
    fields_targeted: array,
    missing_fields: array,
    low_confidence_fields: array
  }
};
```

### Uses Phase 1 (CircuitBreaker)
If query generation calls external services: wrap with `circuitBreaker.execute()` and handle OPEN state by falling back (non-blocking).

## Constraints & Notes
- Do NOT modify Phases 1 & 2 implementations
- Do NOT call the Visual Sidecar in this phase (Phase 4 does that)
- Do NOT hardcode field lists; always use taxonomy when available
- All error states must be logged but non-blocking
