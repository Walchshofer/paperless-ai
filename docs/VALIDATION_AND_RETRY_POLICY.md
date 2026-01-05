# Validation and Retry Policy

This document defines how extraction results are validated and how retries, fallbacks, and terminal states are determined.

This policy is authoritative and must be enforced by the orchestrator. Validation logic must not perform retries directly.

---

## Validation Engine Output

The ValidationEngine emits the following structure:

```json
{
  "isValid": false,
  "missingFields": ["invoice_number", "date"],
  "lowConfidenceFields": ["total_amount"],
  "score": 0.65,
  "shouldFallback": true,
  "severity": "critical",
  "fieldSeverities": {
    "invoice_number": "critical",
    "date": "critical",
    "total_amount": "medium"
  },
  "retryHint": {
    "suggestedAction": "visual_ocr",
    "targetFields": ["invoice_number", "date", "total_amount"],
    "reason": "Missing critical fields: invoice_number, date"
  }
}
```

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `isValid` | boolean | True if no missing or low-confidence fields |
| `missingFields` | string[] | Required fields that are missing or empty |
| `lowConfidenceFields` | string[] | Fields below confidence threshold |
| `score` | number | Validation score (0.0-1.0) |
| `shouldFallback` | boolean | True if score < 0.5 or missing required fields |
| `severity` | string | Overall severity: "none", "warning", "critical" |
| `fieldSeverities` | object | Per-field severity mapping |
| `retryHint` | object\|null | Actionable retry suggestion (null if valid) |

### Severity Values

- **`none`**: Validation passed, no issues
- **`warning`**: Low confidence fields exist but no missing required fields
- **`critical`**: Required fields are missing

### Field Severity Levels

- **`critical`**: Missing required field (score deduction: -0.2)
- **`high`**: Confidence < 0.5 (score deduction: -0.1)
- **`medium`**: Confidence 0.5-0.7 (score deduction: -0.1)

### Retry Hint Actions

- **`visual_ocr`**: Re-attempt with Visual OCR when fields are missing
- **`visual_query`**: Execute targeted visual queries for missing/low-confidence fields
- **`lower_threshold`**: Consider lowering threshold for low-confidence fields

### Important Constraints

* Validation results are **document-scoped**
* No **page-level locality** exists today
* Field confidence is derived from `_field_confidence`

---

## Severity Levels

### High Severity

**Conditions:**

* One or more required fields missing
* Structural or logical inconsistencies

**Actions:**

* Retry extraction
* Escalate OCR strategy
* Fallback to PromptRegistry if needed

### Medium Severity

**Conditions:**

* One or more fields below confidence threshold

**Actions:**

* Single retry permitted
* Accept with warning if unchanged

### Low Severity

**Conditions:**

* Formatting issues
* Normalization inconsistencies

**Actions:**

* Local normalization
* Accept result

---

## Retry Rules

* Retries are **explicitly orchestrated**
* Retries are **always bounded**
* Retry reasons must be **logged**
* Retry scope is always **"document"**

**Implementation binding**
- Extraction retries are orchestrated via `ExpertPipelineExecutor._executeWithValidation()` using `ValidationEngine.validate()`.
- Stage-level `retryCount` must not be used to implement validation-driven extraction retries.

### Forbidden

* Infinite retries
* Stage-driven retries
* Page-level retries (until schema evolves)

### Retry Escalation Order

1. Retry extraction (same OCR)
2. Execute visual queries for targeted field validation (if available)
3. Escalate OCR (Visual OCR vs Tesseract reconciliation)
4. Fallback to PromptRegistry
5. Accept with warning or require manual review

### Circuit Breaker Interaction

**Circuit Breaker States:**
- **CLOSED**: Normal operation, all visual operations allowed
- **OPEN**: Visual Sidecar failing, skip visual operations gracefully
- **HALF_OPEN**: Testing recovery, limited visual operations

**Retry Behavior with Circuit Breaker:**

- When circuit breaker is **CLOSED**:
  - Full retry escalation order applies
  - Visual queries executed normally
  - 500ms latency budget, 1000ms hard timeout

- When circuit breaker is **OPEN**:
  - Skip visual query generation (Stage 5.5)
  - Skip visual query execution (Stage 8)
  - Fall back to extraction-only pipeline
  - No pipeline failure, log degraded mode
  - Continue with OCR escalation if needed

- When circuit breaker is **HALF_OPEN**:
  - Allow visual query generation attempt
  - Single visual query execution attempt (no retries)
  - If successful → transition to CLOSED
  - If failed → transition back to OPEN

**Circuit Breaker Retry Configuration:**
- Failure threshold: 3 consecutive failures
- Cooldown period: 30 seconds
- Exponential backoff: 100ms, 200ms, 400ms
- Max retries per operation: 3

### Visual Query Retry Policy

**Query Generation Retries:**
- Single retry permitted if Guidance template fails
- Fallback to PromptRegistry + JsonRepair
- If both fail → skip visual validation, continue pipeline

**Query Execution Retries:**
- Per-query retry via circuit breaker (max 3 attempts)
- Exponential backoff between retries
- Failed queries do not block pipeline
- Partial results accepted (some queries succeed, others fail)

**Graceful Degradation:**
- Visual validation is enhancement, not requirement
- Missing visual confirmation does not fail validation
- Extraction-only results are valid terminal state

---

## Terminal States

| State                  | Description                           |
| ---------------------- | ------------------------------------- |
| Success                | Fully valid result                    |
| Accepted with warnings | Minor or unresolved confidence issues |
| Manual review required | Blocking validation failures          |

---

## Non-Negotiable Guarantees

* Validation **does not mutate data**
* Validation **does not perform retries**
* All retry decisions are **auditable**
* Final state must be **explicit**
