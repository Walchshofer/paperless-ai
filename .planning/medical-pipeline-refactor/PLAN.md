# Medical Pipeline Refactor Plan
## Remove Meditron 3-Stage Pipeline, Implement Improved Architecture

**Created**: 2025-12-21 11:49
**Status**: Ready for Implementation
**Priority**: High

---

## Overview

The current Meditron 3-stage pipeline has proven ineffective - Meditron returns generic chatbot responses instead of analyzing medical documents. This plan removes the failed implementation and replaces it with a robust architecture addressing all identified strategy gaps.

---

## Phase 1: Cleanup - Remove Meditron Pipeline
**Estimated Complexity**: Low

### 1.1 Remove Meditron-specific code from ollamaService.js
- **File**: `services/ollamaService.js`
- **Lines**: 395-554 (\_analyzeWithExpertModel 3-stage pipeline)
- **Lines**: 354-364 (\_generateMedicalExpertPrompt)
- **Lines**: 307-350 (\_selectExpertModel)
- **Lines**: 250-305 (\_classifyFromText)
- **Action**: Delete or comment out these methods

### 1.2 Remove Meditron config
- **File**: `config/config.js:80-85`
- **Action**: Remove `medicalModel`, `financialModel`, `expertKeepAlive` from ollama config
- **File**: `docker-compose.env` (paperless-ngx)
- **Action**: Remove `OLLAMA_MEDICAL_MODEL=meditron:7b` and `EXPERT_KEEP_ALIVE`

### 1.3 Remove expert routing integration
- **File**: `services/ollamaService.js:566-576`
- **Action**: Remove the expert model check block after planner classification

### 1.4 Clean up .env.example
- **File**: `.env.example`
- **Action**: Remove expert model environment variable documentation

### Verification
- [ ] Container builds successfully
- [ ] No references to Meditron remain
- [ ] Standard document processing still works
- [ ] Vision pipeline unchanged

---

## Phase 2: Implement PromptFactory Service
**Estimated Complexity**: Medium

### 2.1 Create PromptFactory service
- **File**: `services/PromptFactory.js` (new)
- **Purpose**: Centralize all prompt construction

```javascript
// Structure:
class PromptFactory {
  constructor(fieldProfiler) {}

  // Base template builders
  buildBaseTemplate(mode) {}  // 'text' | 'vision' | 'medical'

  // Mode-specific builders
  buildTextPrompt(content, fields, options) {}
  buildVisionPrompt(fields, docType, options) {}
  buildMedicalExtractionPrompt(content, fields) {}

  // Field schema helpers
  getFieldSchema(profileId) {}
  buildFieldInstructions(fields) {}

  // Validation
  validatePromptLength(prompt, maxTokens) {}
}
```

### 2.2 Migrate prompts from ollamaService.js
- **Source**: `services/ollamaService.js` (scattered throughout)
- **Target**: `services/PromptFactory.js`
- **Prompts to migrate**:
  - Text analysis prompt (lines ~850-920)
  - Vision extraction prompt (lines ~1050-1120)
  - Planner classification prompt (lines ~720-780)

### 2.3 Migrate prompts from FieldProfiler
- **Source**: `services/visual-rag/FieldProfiler.js:generateExtractionPrompt`
- **Target**: `services/PromptFactory.js:buildVisionPrompt`

### Verification
- [ ] All existing tests pass
- [ ] Prompts produce identical output
- [ ] No prompt-related code remains in ollamaService.js or FieldProfiler.js

---

## Phase 3: Enhance Planner with Routing Metadata
**Estimated Complexity**: Medium

### 3.1 Modify planner return object
- **File**: `services/ollamaService.js:690-750` (analyzeDocumentPlannerVision)
- **Current return**:
```javascript
{ category, doc_type_hint, confidence, keywords, needs_visual }
```
- **New return**:
```javascript
{
  category,
  doc_type_hint,
  confidence,
  keywords,
  needs_visual,
  routing: {
    recommendedModel: 'gpt-oss:latest',
    fallbackModel: null,
    routingConfidence: 0.85,
    requiresExpertExtraction: false
  }
}
```

### 3.2 Implement routing logic in planner
- Add model selection based on category and confidence
- For `medical` category: route to vision model with specialized prompt
- For `financial` category: route to vision model with financial prompt
- Add fallback model selection when confidence < 0.7

### 3.3 Create routing configuration
- **File**: `config/routing.js` (new)
```javascript
module.exports = {
  categories: {
    medical: {
      minConfidence: 0.6,
      preferVision: true,
      specializedPrompt: 'medical',
      fallbackToText: true
    },
    financial: {
      minConfidence: 0.7,
      preferVision: true,
      specializedPrompt: 'financial',
      fallbackToText: true
    },
    general: {
      minConfidence: 0.5,
      preferVision: false,
      specializedPrompt: null,
      fallbackToText: true
    }
  }
};
```

### Verification
- [ ] Planner returns routing metadata
- [ ] Downstream code uses routing.recommendedModel
- [ ] Logs show routing decisions

---

## Phase 4: Implement Dynamic Fallback Trigger
**Estimated Complexity**: High

### 4.1 Define extraction quality metrics
- **File**: `services/ExtractionValidator.js` (new)
```javascript
class ExtractionValidator {
  validateExtraction(result, expectedFields, minConfidence = 0.7) {
    return {
      isValid: boolean,
      missingFields: string[],
      lowConfidenceFields: string[],
      score: number,  // 0-1
      shouldFallback: boolean
    };
  }
}
```

### 4.2 Add post-extraction validation
- **File**: `services/ollamaService.js`
- After vision extraction, validate result
- If validation fails (missing required fields, low score), trigger fallback

### 4.3 Implement fallback flow
```javascript
async analyzeWithFallback(documentId, content, options) {
  // Primary extraction
  const primaryResult = await this.extractWithVision(documentId, content, options);

  // Validate
  const validation = this.validator.validateExtraction(
    primaryResult,
    options.requiredFields,
    options.minConfidence
  );

  if (validation.shouldFallback && options.fallbackEnabled) {
    console.log(`[FALLBACK] Triggering fallback for doc ${documentId}`);
    const fallbackResult = await this.extractWithText(content, options);
    return this.mergeResults(primaryResult, fallbackResult, validation);
  }

  return primaryResult;
}
```

### 4.4 Add fallback metadata to result
```javascript
{
  document: { ... },
  _extractionMode: 'VISION_WITH_FALLBACK',
  _primaryModel: 'qwen3-vl:8b',
  _fallbackModel: 'gpt-oss:latest',
  _fallbackUsed: true,
  _fallbackReason: 'missing_fields',
  _validation: { ... }
}
```

### Verification
- [ ] Fallback triggers on missing fields
- [ ] Fallback triggers on low confidence
- [ ] Merged results contain best data from both
- [ ] Logs show fallback decisions

---

## Phase 5: Add Fuzzy Field Name Matching
**Estimated Complexity**: Medium

### 5.1 Create FieldMatcher service
- **File**: `services/FieldMatcher.js` (new)
```javascript
class FieldMatcher {
  constructor(paperlessFields) {
    this.fields = paperlessFields;
    this.embeddings = null;  // Lazy load
  }

  // Primary: exact match
  matchExact(fieldName) {}

  // Fallback 1: Levenshtein distance
  matchFuzzy(fieldName, threshold = 0.8) {}

  // Fallback 2: Semantic embedding (optional)
  async matchSemantic(fieldName, threshold = 0.85) {}

  // Main entry point
  async findBestMatch(fieldName) {
    let match = this.matchExact(fieldName);
    if (match) return { field: match, method: 'exact', confidence: 1.0 };

    match = this.matchFuzzy(fieldName);
    if (match) return { field: match, method: 'fuzzy', confidence: match.score };

    if (this.embeddings) {
      match = await this.matchSemantic(fieldName);
      if (match) return { field: match, method: 'semantic', confidence: match.score };
    }

    return null;
  }
}
```

### 5.2 Integrate with paperlessService
- **File**: `services/paperlessService.js`
- Replace `name__iexact` queries with FieldMatcher
- Add caching for field lookups

### 5.3 Implement Levenshtein algorithm
```javascript
levenshteinDistance(a, b) {
  // Standard implementation
}

levenshteinSimilarity(a, b) {
  const distance = this.levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - (distance / maxLen);
}
```

### Verification
- [ ] Exact matches work as before
- [ ] "Cholesterin" matches "Cholesterol"
- [ ] "HbA1c" matches "HBA1C"
- [ ] No false positives in matching

---

## Phase 6: Add Extraction Telemetry
**Estimated Complexity**: Low

### 6.1 Define telemetry schema
```javascript
{
  _telemetry: {
    documentId: 94,
    timestamp: '2025-12-21T12:00:00Z',
    totalDurationMs: 4523,
    stages: [
      { name: 'planner', model: 'qwen3-vl:8b', durationMs: 1200, success: true },
      { name: 'vision', model: 'qwen3-vl:8b', durationMs: 2800, success: true },
      { name: 'fallback', model: 'gpt-oss:latest', durationMs: 523, success: true }
    ],
    routing: {
      category: 'medical',
      confidence: 0.92,
      fallbackTriggered: true,
      fallbackReason: 'missing_fields'
    },
    extraction: {
      fieldsRequested: 12,
      fieldsExtracted: 10,
      fieldsMissing: ['custom_field_1', 'custom_field_2'],
      lowConfidenceFields: ['correspondent']
    },
    validation: {
      score: 0.83,
      passed: true
    }
  }
}
```

### 6.2 Implement TelemetryCollector
- **File**: `services/TelemetryCollector.js` (new)
- Track timing for each stage
- Collect field extraction stats
- Log structured telemetry

### 6.3 Add telemetry logging
- Create log format for analysis
- Option to write to file for later analysis
- Add summary metrics to existing logs

### Verification
- [ ] Telemetry appears in logs
- [ ] Timing is accurate
- [ ] Field counts match reality

---

## Phase 7: Update Design Document
**Estimated Complexity**: Low

### 7.1 Update HEALTH_METRICS_EXTRACTION_DESIGN.md
- Add "Implementation Status" section with current state table
- Add "Strategy Gap Analysis" section documenting identified issues
- Add "Remediation Roadmap" section with this plan's phases
- Update architecture diagram to reflect new components
- Remove Meditron references, update to current model strategy
- Add PromptFactory, FieldMatcher, TelemetryCollector to architecture

### 7.2 Update inline documentation
- Add JSDoc comments to new services
- Document configuration options
- Add usage examples

---

## Phase 8: Testing & Validation
**Estimated Complexity**: Medium

### 8.1 Create test documents
- 5 lab reports (German, various formats)
- 5 financial documents (invoices, statements)
- 5 general documents (letters, contracts)

### 8.2 Test extraction accuracy
- Compare extracted fields to ground truth
- Measure extraction rate (fields found / fields expected)
- Measure accuracy rate (correct values / fields found)

### 8.3 Test fallback behavior
- Documents with poor OCR (should trigger fallback)
- Documents with unusual formatting (should trigger fallback)
- Documents with standard formatting (should not trigger fallback)

### 8.4 Test field matching
- Known field names (should match exactly)
- Slightly different names (should match fuzzy)
- Completely different names (should fail gracefully)

---

## Execution Order

1. **Phase 1**: Cleanup (removes broken code)
2. **Phase 7**: Update documentation (captures current state)
3. **Phase 2**: PromptFactory (foundational service)
4. **Phase 5**: FieldMatcher (needed for validation)
5. **Phase 4**: Dynamic fallback (core improvement)
6. **Phase 3**: Enhanced planner routing
7. **Phase 6**: Telemetry (observability)
8. **Phase 8**: Testing (validation)

---

## Files Created/Modified

### New Files
- `services/PromptFactory.js`
- `services/FieldMatcher.js`
- `services/ExtractionValidator.js`
- `services/TelemetryCollector.js`
- `config/routing.js`

### Modified Files
- `services/ollamaService.js` (major changes)
- `services/paperlessService.js` (field matching)
- `services/visual-rag/FieldProfiler.js` (prompt delegation)
- `config/config.js` (remove expert model config)
- `.env.example` (cleanup)
- `docker-compose.env` (cleanup)
- `HEALTH_METRICS_EXTRACTION_DESIGN.md` (updates)

### Deleted/Deprecated
- Meditron 3-stage pipeline code
- Expert model routing code
- Expert model configuration

---

## Success Criteria

- [ ] No Meditron/expert model code remains
- [ ] PromptFactory handles all prompt construction
- [ ] Planner returns routing metadata
- [ ] Fallback triggers on quality issues
- [ ] Field matching works with fuzzy names
- [ ] Telemetry shows in logs
- [ ] Extraction accuracy ≥ 85% on test set
- [ ] All existing functionality preserved

---

## Rollback Plan

If issues arise:
1. Revert to previous commit (before Phase 1)
2. Rebuild container with old code
3. Document issues for analysis

Git tag before starting: `pre-medical-refactor-2025-12-21`
