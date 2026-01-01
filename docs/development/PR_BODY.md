This PR enables OCR translations by default and lowers the translation minimum character threshold to 3. Also adds diagnostic logging and unit tests.

Changes:
- Set `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes` (env) — applied outside this repo in `paperless-ngx/docker-compose.env`.
- `services/experts/translation/LocalTranslator.js`: add debug logs when skipping translation.
- `services/experts/utils/ocrMetadata.js`: add info log when translations are disabled.
- Added unit tests: `test/unit/local-translator.test.js`, `test/unit/ocr-metadata.test.js`.
- Added docs: `docs/TRANSLATION_SERVICE_AUDIT_AND_REMEDIATIONS.md` (audit + remediation plan).

Testing:
- Unit tests pass locally: `npx mocha --require test/setup-env.js "test/unit/**/*.test.js"` (170 passing locally).

Acceptance criteria:
- `TRANSLATION_MIN_CHARS=3` and `OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes` (env file updated).
- Unit tests pass in CI and staging validation confirms translations appear for short OCR snippets.

Please review and request staging validation from @debug-agent.
