# Observability and Telemetry

This document defines the logging, telemetry, and diagnostics requirements for
the paperless-ai Expert Pipeline.

Observability is mandatory to ensure retries, fallbacks, and model decisions
are transparent and debuggable.

---

## Required Log Fields

All pipeline-related log entries MUST include:

- `request_id`
- `document_id`
- `pipeline_id`
- `stage`
- `retry_count`
- `fallback_reason` (if applicable)
- `ocr_source_selected` (`visual` | `tesseract`)

---

## Key Telemetry Events

The system must emit structured telemetry for the following events:

### `normalization_metrics`
- normalization requested
- normalization executed
- actions applied
- re-ingestion performed
- confidence score

---

### `ocr_comparison`
- visual OCR score
- tesseract OCR score
- selected source
- threshold

---

### `retry_triggered`
- stage
- reason
- severity
- retry_scope (`document`)

---

### `fallback_executed`
- from (`guidance`)
- to (`prompt_registry`)
- reason

---

### `prompt_truncated`
- original token count
- truncated token count
- stage

---

## Metrics (Recommended)

- retry_rate
- fallback_rate
- visual_ocr_selection_rate
- guidance_success_rate
- average_pipeline_duration

---

## Debugging Workflow

When investigating incorrect results:

1. Identify the `request_id`
2. Trace stage execution order
3. Inspect retry and fallback telemetry
4. Check OCR comparison metrics
5. Review validator output
6. Confirm final terminal state

---

## Non-Negotiable Guarantees

- All retries are logged
- All fallbacks are logged
- OCR source selection is auditable
- Silent failures are forbidden
