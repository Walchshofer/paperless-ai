# Translation Service Audit & Remediations ✅

## Summary
This document records the findings from an audit of the translation functionality, the recommended remediations, test plan, file-level changes, rollout guidance, and a handoff for the implement-agent.

## Findings (short)
- OCR translations were disabled via environment: `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=no`.
- The translation minimum length threshold is set to `TRANSLATION_MIN_CHARS=20`, causing short OCR snippets to be skipped.
- Translator failures (Ollama connectivity or model availability) fall back silently to original text; logs exist but startup connectivity checks are recommended.

## Root causes
1. Configuration: `docker-compose.env` explicitly disables OCR translations and sets an overly large `TRANSLATION_MIN_CHARS` so short OCR snippets are not translated.
2. Visibility: `LocalTranslator.translate()` quietly returns original text when skipping due to `minChars` or when `source === target` without emitting a diagnostic-level log indicating the skip.
3. Operational: No explicit startup health check for Ollama connectivity; failures surface only at runtime as warnings.

## Recommended Remediations (priority ordered)
1. Env fixes (low risk, immediate)
   - `docker-compose.env`:
     - `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=no` → `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes`
     - `TRANSLATION_MIN_CHARS=20` → `TRANSLATION_MIN_CHARS=3`
   - Rationale: Enable OCR translation pipeline and ensure short OCR fragments are translated.

2. Code: add diagnostic logs (very low risk)
   - `services/experts/translation/LocalTranslator.js`
     - Add `logger.debug('[LocalTranslator] Skipping translation due to minChars', { textLength, minChars })` when skipped for minChars.
     - Add `logger.debug('[LocalTranslator] No translation needed: source === target', { source, target })` when source/target equal.
   - `services/experts/utils/ocrMetadata.js` or call-site in `ExpertPipelineExecutor.js`
     - Add an info log when `includeTranslations` is false so startup/config reasons are obvious.

3. Tests: add/extend tests (required)
   - Unit: `LocalTranslator` should log and return original text when text length < `minChars`.
   - Unit: `buildVisOcrMetadata()` should reflect `translationAttempted: false` when `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=no`.
   - Integration: Update or add an integration test demonstrating translation occurs with `TRANSLATION_MIN_CHARS=3`.

4. Operational: health checks & observability (recommended)
   - Add a lightweight Ollama connectivity check at service startup and on health endpoints; warn/fail fast if model unavailability is detected.
   - Add telemetry or an event when translator falls back due to API failure for easier postmortems.

## File-by-file Suggested Changes
- Modify `paperless-ngx/docker-compose.env`
  - Set `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes`
  - Set `TRANSLATION_MIN_CHARS=3`
- Modify `services/experts/translation/LocalTranslator.js`
  - Add debug logs for skip reasons, and consider returning `null` or marking a flag when translation was skipped for clearer instrumentation (non-breaking change preferred).
- Modify `services/experts/utils/ocrMetadata.js`
  - Add an info log when `includeTranslations` is false: `logger.info('[OCR] Translations disabled via config; skipping translation pass')`.
- Tests: `test/integration/expert-pipeline.test.js` or new tests under `test/unit/`
  - Add/adjust `LocalTranslator` tests and `buildVisOcrMetadata` tests.

## Acceptance Criteria
- `docker-compose.env` contains:
  - `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes`
  - `TRANSLATION_MIN_CHARS=3`
- New/updated tests exist and pass locally (`npm test`) and in CI.
- Logs contain diagnostic messages when translation is skipped due to config or `minChars`.
- A PR includes the doc change, code changes, and tests, with a short changelog referencing this doc.

## Rollout & Validation Steps
1. Update `docker-compose.env` and redeploy the `paperless-ai` service or restart containers for local dev.
2. Run unit and integration tests: `npm test` and verify added tests pass.
3. Process a short OCR snippet in a test document and confirm `document._vis_ocr_metadata.metadata.translated === true` and `vis_ocr_text_en`/`vis_ocr_text_de` populated as expected.
4. Verify logs show translation attempts and any health check warnings.

---

## Handoff (for implement-agent) — summary
- Implement the env changes and code logging changes described above.
- Add the three tests listed under Tests and ensure CI passes.
- Update docs and include a PR checklist referencing this document.

---

### References
- `services/experts/translation/LocalTranslator.js`
- `services/experts/utils/ocrMetadata.js`
- `services/experts/ExpertPipelineExecutor.js`
- `config/config.js`
- `paperless-ngx/docker-compose.env`
- `test/integration/expert-pipeline.test.js`


*Document created by GitHub Copilot (Docs Agent) — ready to hand off to the implement-agent.*
