# TO-DOS

## Health Metrics Database Implementation - 2025-12-21 06:42

- **Create SQLite health_metrics database** (done) - Build database schema to store extracted lab values for pattern detection. **Problem:** The pipeline does not yet persist health metrics for trend analysis and pattern detection. **Files:** `HEALTH_METRICS_EXTRACTION_DESIGN.md` (full design spec). **Solution:** Create SQLite database with health_metrics table (document_id, biomarker, value, unit, reference_range, status, measured_date), implement HealthMetricsService to persist extracted metrics after analysis.

- **Implement PatternDetectionEngine** (done) - Build trend/anomaly detection for stored health metrics. **Problem:** Design document specifies pattern detection (trends, anomalies, correlations, seasonal patterns) but no implementation exists yet. **Files:** `HEALTH_METRICS_EXTRACTION_DESIGN.md` (contains PatternDetectionEngine class design). **Solution:** Implement PatternDetectionEngine class that queries health_metrics database to identify: upward/downward trends, out-of-range anomalies, correlation between biomarkers, seasonal patterns.

## Strategy Gap Analysis and Fixes - 2025-12-21 11:49

- **Update HEALTH_METRICS_EXTRACTION_DESIGN.md** (done) - Incorporate the strategy gap analysis findings into the design document. **Files:** `HEALTH_METRICS_EXTRACTION_DESIGN.md`.

- **Implement dynamic fallback trigger** (done) - Add post-extraction quality checks to trigger fallback when primary extraction fails. **Files:** `services/ollamaService.js`, `services/ExtractionValidator.js`.

- **Add fuzzy field name matching** (done) - Implement Levenshtein matching for field names. **Files:** `services/FieldMatcher.js`, `services/paperlessService.js`.

- **Return routing metadata from planner** (done) - Planner returns routing object inline. **Files:** `services/ollamaService.js`, `config/routing.js`.

- **Add extraction telemetry metadata** (done) - Track models, fallback status, and timing. **Files:** `services/TelemetryCollector.js`, `services/ollamaService.js`.

- **Create PromptFactory service** (done) - Centralize prompt construction across all extraction modes. **Files:** `services/PromptFactory.js`.

## Duplicate Detection Actions & Settings Fixes - 2025-12-21 19:10

- **Fix /settings handler expert fields** (done) - /settings references `expertPipelineEnabled` and medical model fields without reading them from `req.body`, causing a ReferenceError and preventing settings persistence. **Files:** `routes/setup.js`.

- **Implement duplicateAction=tag** (done) - Add duplicate tag + note to duplicate docs while skipping processing. **Files:** `server.js`, `services/paperlessService.js`, `config/config.js`.

- **Implement duplicateAction=archive** (done) - Support archive via `remove_tag` (Inbox tag) or `storage_path` with config knobs. **Files:** `server.js`, `services/paperlessService.js`, `config/config.js`, `.env.example`.

- **Implement duplicateAction=merge** (done) - Use Paperless bulk edit `merge` to merge duplicate into original and optionally delete originals. **Files:** `server.js`, `services/paperlessService.js`, `config/config.js`, `.env.example`.

## Vision Repair & Notes Defaults - 2025-12-21 19:40

- **Guard custom field null crash** (done) - Prevent `customField.field_name` access when a custom field entry is null. **Files:** `server.js`.

- **Smart defaults for notes** (done) - If `document_type` is note/memo, inject `correspondent=Self` and `document_date=today` before validation and persistence. **Files:** `services/ollamaService.js`, `server.js`.

- **Repair pipeline for Qwen JSON** (done) - On parse failure, retry up to 2x, then send cleaned raw output to gpt-oss for JSON repair and use repaired JSON. **Files:** `services/ollamaService.js`.

- **Trim log spam from context/embeddings** (done) - Truncate or omit large numeric arrays (e.g., `context`) from Ollama response logs. **Files:** `services/ollamaService.js`.
