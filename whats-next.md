# Handoff Document: Expert Pipeline Fixes and Verbose Logging

<original_task>
1. Enable TEMPORARY verbose logging to see which templates are used and model responses
2. Investigate 'Bad Request' errors in paperless_webserver logs
3. Investigate 'FATAL' and 'WARNING' logs in paperless_db container
4. Test document 74 with the Expert Pipeline after fixes
5. Address response truncation, token budgets, and PDF rendering issues discovered during testing
</original_task>

<work_completed>

## 1. Verbose Logging Enabled

### guidance_service/app/__init__.py
Added detailed template execution logging (lines 389-417):
```python
# VERBOSE LOGGING: Log template execution start
app.logger.info({
    'event': 'template_execution_start',
    'template': template_name,
    'model': model,
    'temperature': temperature,
    'variables_keys': list(variables.keys()) if variables else [],
    'ollama_endpoint': OLLAMA_ENDPOINT
})

# VERBOSE LOGGING: Log raw result
app.logger.info({
    'event': 'template_execution_complete',
    'template': template_name,
    'model': model,
    'latency_seconds': round(template_latency_seconds, 2),
    'raw_output_preview': str(raw_output)[:300] if raw_output else None,
    'raw_output_type': type(raw_output).__name__ if raw_output else None
})
```

### docker-compose.yml (C:\Users\pwalc\MyApps\paperless-ngx\)
Line 166: Changed `LOG_LEVEL=INFO` to `LOG_LEVEL=DEBUG  # TEMPORARY: Verbose logging for debugging`

### services/guidance/GuidanceClient.js
Lines 196-212: Enhanced `guidance_generate_success` logging to include:
- `generatedPreview`: First 500 chars of response JSON
- `validationErrors`: First 3 validation errors
- `validationWarnings`: First 3 validation warnings

## 2. Fixed Guidance Service OLLAMA_API_URL

### guidance_service/app/__init__.py (lines 228-235)
Changed from checking `OLLAMA_ENDPOINT` → `OLLAMA_HOST` → localhost
To: `OLLAMA_ENDPOINT` → `OLLAMA_API_URL` → localhost
Also auto-appends `/v1` suffix for OpenAI compatibility:
```python
_ollama_base = os.getenv('OLLAMA_ENDPOINT',
    os.getenv('OLLAMA_API_URL', 'http://localhost:11434'))
OLLAMA_ENDPOINT = _ollama_base if _ollama_base.endswith('/v1') else f"{_ollama_base.rstrip('/')}/v1"
```

## 3. Fixed Custom Fields Bad Request Error

### Root Cause
Code passed `data_type: "text"` but Paperless-ngx API expects `"string"`

### services/experts/utils/ocrMetadata.js (line 291-292)
Changed:
```javascript
// Paperless-ngx uses 'string' for text fields, not 'text'
const result = await paperlessService.createCustomFieldSafely(field, 'string');
```

### Created Missing Custom Fields via API
```bash
curl -X POST "http://localhost:8000/api/custom_fields/" -H "Authorization: Token ..." -d '{"name": "vis_ocr_text", "data_type": "string"}'
# Created vis_ocr_text (id: 11), vis_ocr_text_de (id: 12), vis_ocr_text_en (id: 13)
```

## 4. Fixed Database Collation Mismatch

### Root Cause
PostgreSQL upgrade changed collation version (2.41 → 2.36)

### Fix Applied
```bash
docker exec -i paperless_db psql -U elfman -d paperless -c "ALTER DATABASE paperless REFRESH COLLATION VERSION;"
```
Note: Database user is `elfman`, not `paperless`

## 5. Fixed ExpertPipelineExecutor Constructor Error

### Root Cause
`services/ollama/index.js` line 10 passed module object instead of class

### Fix (line 10)
Changed:
```javascript
ExpertPipelineExecutor: require('../experts/ExpertPipelineExecutor').ExpertPipelineExecutor,
```

## 6. Updated cross_pipeline_router Model

### services/experts/pipelines/GeneralPipeline.js (lines 65-66)
Changed from `MODEL_NAMES.general` to use orchestrator:
```javascript
// Use orchestrator model for routing decisions, fallback to general
model: MODEL_NAMES.orchestrator || MODEL_NAMES.general,
```

## 7. Increased Token Budgets

### config/config.js (lines 134-142)
Changed defaults from 256 to higher values:
```javascript
// Increased token budgets for qwen3-vl:8b (128K context allows more tokens)
const qwenRouterThinkingTokens = parseEnvInt(
  process.env.QWEN_ROUTER_THINKING_TOKENS,
  1024  // Was 256 - too low, caused truncation
);
const qwenRouterOutputTokens = parseEnvInt(
  process.env.QWEN_ROUTER_OUTPUT_TOKENS,
  512   // Was 256 - too low, caused truncation
);
```

## 8. Fixed PDF Rendering Fallback

### services/ollama/vision.js (lines 820-856)
Added fallback to regular download when original download fails:
```javascript
// Try original document first, fallback to regular download if it fails
let pdfBuffer = await paperlessService.downloadOriginalDocument(documentId);
if (!pdfBuffer || pdfBuffer.length === 0) {
    logger.info(`[VISION] Original download unavailable, trying regular download for doc ${documentId}`);
    pdfBuffer = await paperlessService.downloadDocument(documentId);
}
```

### Root Cause
`/download/original/` endpoint returns 302 redirect to login (doesn't support token auth)
`/download/` endpoint works correctly with token auth

</work_completed>

<work_remaining>

## 1. Test Document 74 Again
All fixes have been applied but not yet tested. Run:
```bash
cd C:\Users\pwalc\MyApps\paperless-ai
PAPERLESS_API_URL=http://localhost:8000/api PAPERLESS_API_TOKEN=6a07c1933e505afd78fa2f9484ea3758de4957ce node test/manual/test-doc74-pipeline.js
```

Expected improvements:
- PDF should render at 300 DPI (not thumbnail fallback)
- Token budgets: thinkingBudget=1024, outputBudget=512 (was 256 each)
- cross_pipeline_router should use orchestrator model if available
- ExpertPipelineExecutor should instantiate correctly
- Guidance templates should show verbose logs

## 2. Rebuild paperless-ai Container (if testing inside Docker)
The local test runs outside Docker. To test inside container:
```bash
cd C:\Users\pwalc\MyApps\paperless-ngx
docker compose build paperless-ai
docker compose up -d paperless-ai
```

## 3. Revert Verbose Logging (after debugging)
In `docker-compose.yml` line 166, change back:
```yaml
- LOG_LEVEL=INFO  # Reverted from DEBUG
```

## 4. Verify Router Model Pre-Check Behavior
The logs showed `loadedModels: []` because Ollama unloads models after inactivity.
The current code falls back to General when model isn't pre-loaded, but vision analysis still uses qwen3-vl:8b on-demand.
Consider: Should the pre-check be removed or made optional?

## 5. Address OCR Custom Fields "Already Exists" Errors
The fields now exist but code still tries to create them, causing 400 errors with `{ name: [Array] }`.
The `createCustomFieldSafely` function should detect existing fields and return them instead of failing.

</work_remaining>

<attempted_approaches>

## Failed: Adding OLLAMA_HOST to docker-compose.yml
User rejected: "Use OLLAMA_API_URL instead of creating a duplicate with exact the same value. We do not need OLLAMA_HOST."
Solution: Modified guidance service code to read OLLAMA_API_URL directly.

## Failed: Initial Token Budget Values
Default 256 tokens for thinking+output caused response truncation at 700 tokens.
Increased to 1024+512=1536 total.

## Failed: downloadOriginalDocument Only
The `/download/original/` endpoint returns 302 redirect to login page.
Added fallback to regular `/download/` endpoint which works with token auth.

## Investigated But Not Root Cause: "role paperless does not exist"
These FATAL errors happen during container startup before database is initialized.
Actual user is `elfman` (from docker-compose.env). Not a real issue, just transient health check failures.

</attempted_approaches>

<critical_context>

## Docker Configuration Location
- docker-compose.yml: `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml`
- docker-compose.env: `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env`
- Project code: `C:\Users\pwalc\MyApps\paperless-ai\`

## Key Environment Variables
- `PAPERLESS_API_TOKEN`: 6a07c1933e505afd78fa2f9484ea3758de4957ce
- `OLLAMA_API_URL`: http://host.docker.internal:11434 (in docker-compose.env)
- `ORCHESTRATOR_MODEL`: nemotron-orchestrator:8b (in docker-compose.env)
- `GUIDANCE_MODEL`: sauerkraut-llama3.1:8b
- `POSTGRES_USER`: elfman (NOT "paperless")

## Model Availability
- qwen3-vl:8b: Vision router model, 128K context, loads on-demand
- sauerkraut-llama3.1:8b: General/Guidance model
- nemotron-orchestrator:8b: Orchestrator model for routing decisions

## Paperless-ngx API Notes
- `/documents/{id}/download/` - Works with token auth (returns PDF)
- `/documents/{id}/download/original/` - Returns 302 redirect (doesn't support token auth from API)
- Custom field `data_type` must be `"string"`, not `"text"`

## Test Script Location
`C:\Users\pwalc\MyApps\paperless-ai\test\manual\test-doc74-pipeline.js`

## Guidance Service Health Check
```bash
curl -s http://localhost:8002/health | python -m json.tool
# Shows: ollama_target: "http://host.docker.internal:11434/v1"
```

</critical_context>

<current_state>

## Files Modified (Not Committed)
1. `guidance_service/app/__init__.py` - OLLAMA_API_URL fix + verbose logging
2. `services/guidance/GuidanceClient.js` - Enhanced success logging
3. `services/experts/utils/ocrMetadata.js` - data_type: "string"
4. `services/ollama/index.js` - ExpertPipelineExecutor import fix
5. `services/experts/pipelines/GeneralPipeline.js` - orchestrator model for router
6. `config/config.js` - Increased token budgets
7. `services/ollama/vision.js` - PDF download fallback
8. `docker-compose.yml` - LOG_LEVEL=DEBUG (temporary)

## Containers Status
- guidance-service: Rebuilt and running with DEBUG logging
- paperless_ai: Running but using old code (not rebuilt)
- paperless_webserver: Running
- paperless_db: Running, collation fixed

## Custom Fields Created
- vis_ocr_text (id: 11)
- vis_ocr_text_de (id: 12)
- vis_ocr_text_en (id: 13)

## Ready for Testing
All code fixes applied. Test document 74 to verify:
1. PDF renders at 300 DPI (not thumbnail)
2. No ExpertPipelineExecutor constructor error
3. Token budgets show 1024/512 in logs
4. Guidance templates show verbose logs
5. cross_pipeline_router uses orchestrator model

## Open Questions
1. Should router model pre-check be removed? (causes fallback when model not in VRAM)
2. Should OCR field creation check for existing fields first?

</current_state>
