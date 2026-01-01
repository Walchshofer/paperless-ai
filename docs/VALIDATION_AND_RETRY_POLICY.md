# Validation and Retry Policy

This document defines how extraction results are validated and how retries, fallbacks, and terminal states are determined.

This policy is authoritative and must be enforced by the orchestrator. Validation logic must not perform retries directly.

---

## Validation Engine Output

The current ValidationEngine emits the following structure:

```json
{
  "isValid": false,
  "missingFields": ["invoice_number", "date"],
  "lowConfidenceFields": ["total_amount"],
  "score": 0.65,
  "shouldFallback": true
}
```

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

### Forbidden

* Infinite retries
* Stage-driven retries
* Page-level retries (until schema evolves)

### Retry Escalation Order

1. Retry extraction (same OCR)
2. Escalate OCR (Visual OCR vs Tesseract)
3. Fallback to PromptRegistry
4. Accept with warning or require manual review

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
