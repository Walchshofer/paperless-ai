# Custom Field Normalization (Expert Pipelines) ✅

## Purpose
Centralize and standardize normalization of values destined for Paperless-ngx `custom_fields` to avoid Django validation errors (e.g., "object of type 'int' has no len()") and to ensure consistent storage.

## Implementation
- New helper: `services/customFieldUtils.js`
  - Exported function: `normalizeCustomFieldValue(value)`
  - Rules:
    - null or undefined → `''` (empty string)
    - Objects/Arrays → `JSON.stringify(value)` (safe fallback if JSON serializable)
    - All other values → `String(value)`
    - Final result is truncated to **255 characters** to avoid maximum length validator failures in Paperless-ngx

- Export path:
  - The helper is also attached to the Paperless service instance (`services/paperlessService.js`) as `paperlessService.normalizeCustomFieldValue` for convenience.

## Call sites
AI services and pipelines were updated to apply normalization *before* calling `PaperlessService.updateDocument()`:
- `services/openaiService.js` — applies normalization in `_normalizeDocumentOutput()`
- `services/azureService.js` — applies normalization in `_normalizeDocumentOutput()`
- `services/ollama/helpers.js` — applies normalization in `_normalize()`
- `services/experts/ExpertPipelineExecutor.js` — normalizes `custom_fields` immediately before calling `updateDocument()` for OCR checkpoint / pipeline updates

Note: `PaperlessService.updateDocument()` still applies normalization as a safety net. The new approach ensures intermediate components work with normalized data and reduces the risk of truncation/loss-of-data surprises.

## Why truncation to 255 chars?
- Paperless-ngx uses Django CharField/validators for custom field values in many deployments. 255 is a conservative safe limit that avoids validation errors while retaining meaningful content. If a value is truncated, the original string (if important) should be stored in a different storage (e.g., attachments or an indexed note).

## Tests
- Unit tests added: `test/unit/paperless_custom_fields.test.js`
  - Verifies numeric coercion, object JSON serialization, and truncation.

## Next steps / Acceptance criteria
- Run `npm test` (unit tests) and verify `paperless_custom_fields` tests pass ✅
- Optionally, run a Docker/compose re-deploy and execute `docker exec -it paperless_webserver python3 manage.py document_index_re-index` to verify the original TypeError is resolved in integration scenarios.

---
Last updated: Automated patch applied
