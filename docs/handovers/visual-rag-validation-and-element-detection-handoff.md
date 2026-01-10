# Visual RAG Validation and Element Detection Implementation Handoff

**To Agent**: `implement-agent` or `pipeline-orchestration-expert`
**From**: Validation and audit phase (2026-01-09)
**Priority**: HIGH - Critical endpoint missing, pipeline degraded
**Estimated Effort**: 2-4 days (depending on chosen option)

---

## Executive Summary 🎯

**CRITICAL FINDING**: The `/detect_elements` endpoint is documented, tested, and called by the pipeline but **NOT implemented** in `services/visual-rag-sidecar/main.py`.

**Root Cause**: ColQwen3 (TomoroAI/tomoro-colqwen3-embed-8b) is a **visual retrieval model** using Late Interaction embeddings, NOT a layout analysis model. It cannot detect tables/figures with bounding boxes.

**Current State**:
- ✅ `/health` endpoint works
- ✅ `/search` endpoint works (visual retrieval)
- ❌ `/detect_elements` endpoint missing (returns HTTP 404)
- ✅ Circuit breaker gracefully handles failures
- ✅ Pipeline continues with OCR-only results

**Impact**: Stage 4 Track 3 (Visual Element Detection) fails silently. No pipeline breakage, but missing layout analysis capability reduces extraction accuracy for structured documents (forms, tables).

---

## What To Do Next 📋

### Phase 1: Container Validation (1-2 hours)

1. **Rebuild visual-rag container with correct environment**
   ```bash
   cd C:\Users\pwalc\MyApps\paperless-ngx
   docker compose --env-file docker-compose.env up -d --build visual-rag
   ```

2. **Verify model loading and health endpoint**
   ```bash
   # Wait for model to load (first run downloads ~16GB model)
   docker logs -f visual_rag

   # Test health endpoint
   curl http://localhost:8001/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "model_loaded": true,
     "index_loaded": false,
     "model_name": "TomoroAI/tomoro-colqwen3-embed-8b",
     "indexed_docs_count": 0,
     "flash_attn_available": true,
     "flash_attn_version": "2.7.4.post1"
   }
   ```

3. **Test search endpoint with sample query**
   ```bash
   curl -X POST http://localhost:8001/search \
     -H "Content-Type: application/json" \
     -d '{"query": "invoice total", "k": 3}'
   ```

4. **Verify /detect_elements returns 404 (confirming the gap)**
   ```bash
   curl -X POST http://localhost:8001/detect_elements \
     -H "Content-Type: application/json" \
     -d '{"image": "...", "detect_types": ["tables"]}'
   # Expected: 404 Not Found
   ```

### Phase 2: Decision Point - Choose Implementation Path (stakeholder decision)

**You must choose ONE of these three options before proceeding:**

#### Option 1: Add LayoutLMv3 for Proper Layout Analysis ⭐ RECOMMENDED

**Best for**: Production-quality layout analysis

**Pros**:
- ⭐⭐⭐⭐⭐ Industry-standard accuracy
- Proper bounding boxes and element classification
- Structured output (tables with rows/columns)
- Fits within 24GB VRAM budget

**Cons**:
- Requires new model integration (2-3GB VRAM)
- 2-3 day implementation
- Additional dependencies

**VRAM Budget**:
- ColQwen3 baseline: 8-10GB
- LayoutLMv3: 2-3GB
- Flash Attention overhead: 1-2GB
- **Total: 11-15GB (safe for RTX 3090 Ti 24GB)**

**Implementation Steps**:
1. Add LayoutLMv3 dependencies to requirements.txt
2. Implement `/detect_elements` endpoint in main.py
3. Load LayoutLMv3 model separately from ColQwen3
4. Add element detection logic with bounding box extraction
5. Update tests and documentation

**Code Reference**: See `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` section "LayoutLMv3 Integration Code"

---

#### Option 2: Use Visual Queries Instead of Dedicated Detection

**Best for**: Pragmatic solution leveraging existing model

**Pros**:
- No additional model required
- Uses existing ColQwen3 capabilities
- 1 day implementation
- Zero VRAM increase

**Cons**:
- ⭐⭐⭐ Lower accuracy than LayoutLMv3
- No bounding boxes (approximate regions only)
- Requires query tuning per document type
- Not structured layout analysis

**Implementation Steps**:
1. Implement `/detect_elements` endpoint that translates to visual queries
2. Use ColQwen3 `/search` with pre-defined queries like:
   - "table with rows and columns"
   - "form with fields"
   - "signature block"
3. Convert search results to element-like output
4. Map confidence scores to element types

**Code Reference**: See `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` section "Visual Query-Based Detection"

---

#### Option 3: Disable Track 3 Formally (Interim Solution)

**Best for**: Short-term while deciding on long-term approach

**Pros**:
- 1 hour implementation
- Documents current reality
- Stops unnecessary HTTP calls
- No performance impact

**Cons**:
- No layout understanding capability
- Gap remains in pipeline
- Requires revisiting later

**Implementation Steps**:
1. Update `ParallelOcrExecutor.js` to skip Track 3
2. Update documentation to mark Track 3 as disabled
3. Update integration tests to expect Track 3 skip
4. Add TODO/FIXME comments with issue tracking

**Code Changes**: See `docs/VISUAL_RAG_ELEMENT_DETECTION_GAP.md` section "Option 3: Disable Track 3"

---

### Phase 3: Implementation (varies by option)

**After choosing an option above**, proceed with implementation following the detailed steps in the referenced documentation.

### Phase 4: Validation & Testing (1 day)

1. **Run integration tests**
   ```bash
   npm test -- test/integration/visual-rag/health.test.js
   npm test -- test/integration/visual-rag/detect_elements.test.js
   ```

2. **Test full pipeline with visual element detection**
   ```bash
   # Test with a sample document containing tables
   curl -X POST http://localhost:3000/api/process-document \
     -H "Content-Type: application/json" \
     -d '{"document_id": 123}'
   ```

3. **Verify metrics and circuit breaker behavior**
   ```bash
   curl http://localhost:9091/metrics | grep visual_element
   ```

4. **Check Grafana dashboard** (http://localhost:3001)
   - Visual element detection latency
   - Success/failure rates
   - Circuit breaker state transitions

---

## Context You Must Read 📚

### Critical Documentation (READ FIRST)

1. **C:\Users\pwalc\MyApps\paperless-ai\docs\VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md**
   - Comprehensive technical analysis of the gap
   - All three implementation options with code examples
   - VRAM budgets and performance characteristics

2. **C:\Users\pwalc\MyApps\paperless-ai\docs\VISUAL_RAG_ELEMENT_DETECTION_GAP.md**
   - Executive summary and quick reference
   - Decision matrix for choosing implementation path

3. **C:\Users\pwalc\MyApps\paperless-ai\docs\EXPERT_PIPELINE_DECISION_TABLE.md**
   - Authoritative pipeline contract (updated with Track 3 gap)
   - Stage 4 Track 1/2/3 comparison

4. **C:\Users\pwalc\MyApps\paperless-ai\docs\VISUAL_RAG_INTEGRATION.md**
   - Integration architecture
   - Circuit breaker configuration
   - Timeout hierarchy (500ms query, 3s health, 30s indexing)

### Model & Environment Documentation

5. **C:\Users\pwalc\MyApps\paperless-ai\docs\model\tomoro-colqwen3.md**
   - ColQwen3 model profile and capabilities
   - What it CAN do vs what it CANNOT do

6. **C:\Users\pwalc\MyApps\paperless-ai\docs\ENVIRONMENT_VARIABLES.md**
   - All Visual RAG environment variables
   - Pinned versions (transformers==4.57.3, torch==2.6.0)

7. **C:\Users\pwalc\MyApps\paperless-ai\docs\handovers\visual-rag-healthcheck-snippet.md**
   - Docker compose healthcheck configuration

### Service Code & Configuration

8. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\main.py**
   - Current implementation (health + search endpoints only)
   - Where to add `/detect_elements` endpoint

9. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\Dockerfile**
   - Build configuration with flash-attn auto-detection
   - Line ending normalization
   - Smoke test at build time

10. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\requirements.txt**
    - Pinned dependencies
    - byaldi==0.0.7, transformers==4.57.3

11. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\README.md**
    - Operational notes
    - Diagnostic scripts reference

12. **C:\Users\pwalc\MyApps\paperless-ai\services\experts\ParallelOcrExecutor.js**
    - Lines 467-548: Visual Element Track implementation
    - Calls `/detect_elements` endpoint (currently fails)

13. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag\VisualSearchClient.js**
    - Circuit breaker wrapper
    - Timeout configuration
    - Concurrency limiting (5 concurrent queries)

14. **C:\Users\pwalc\MyApps\paperless-ai\config\config.js**
    - Lines 401-409: visualRagSidecar configuration
    - Model aliasing and defaults

### Docker Compose & Environment

15. **C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml**
    - visual-rag service definition
    - Volume mounts, GPU support, healthcheck

16. **C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env**
    - Runtime environment variables (contains secrets)
    - VISUAL_RAG_URL, MODEL_NAME, INDEX_DIR, MEDIA_DIR

### Tests & CI

17. **C:\Users\pwalc\MyApps\paperless-ai\test\integration\visual-rag\health.test.js**
    - Health endpoint integration test
    - Validates response schema

18. **C:\Users\pwalc\MyApps\paperless-ai\test\integration\visual-rag\detect_elements.test.js**
    - Element detection test (currently fails - endpoint missing)
    - Expected payload shape

19. **C:\Users\pwalc\MyApps\paperless-ai\.github\workflows\visual-rag-e2e.yml**
    - CI/CD workflow for visual RAG testing

### Operational Scripts

20. **C:\Users\pwalc\MyApps\paperless-ai\scripts\validate_env.sh** (if exists)
    - Environment validation script

21. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\scripts\verify_flash_attn_vram.sh**
    - VRAM profiling during PDF processing

22. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\scripts\inspect_shard_keys.py**
    - Checkpoint shard key translation validation

23. **C:\Users\pwalc\MyApps\paperless-ai\services\visual-rag-sidecar\scripts\test_config_override.py**
    - Config override validation

---

## Acceptance Criteria ✅

### Phase 1: Container Validation

- [ ] `docker compose --env-file docker-compose.env up -d --build visual-rag` succeeds
- [ ] Container receives environment variables (`INDEX_DIR`, `MEDIA_DIR`, `VISUAL_RAG_INDEX_NAME`) correctly
- [ ] Model loads successfully (check logs for "Model loaded successfully")
- [ ] Flash Attention imports without errors (check logs for "✅ SYSTEM READY")
- [ ] `GET /health` returns 200 with `model_loaded: true`
- [ ] `GET /health` includes `flash_attn_available` and `flash_attn_version` fields
- [ ] `POST /search` works with sample query

### Phase 2: Implementation (varies by option)

**If Option 1 (LayoutLMv3)**:
- [ ] LayoutLMv3 dependencies added to requirements.txt
- [ ] `/detect_elements` endpoint implemented in main.py
- [ ] Model loads within VRAM budget (monitor `nvidia-smi`)
- [ ] Returns proper bounding boxes with confidence scores
- [ ] Response matches schema: `{elements: [], layout: {}, confidence: number}`

**If Option 2 (Visual Queries)**:
- [ ] `/detect_elements` endpoint translates to visual search queries
- [ ] Returns approximate element locations (no strict bboxes required)
- [ ] Confidence scores map from search results

**If Option 3 (Disable Track 3)**:
- [ ] ParallelOcrExecutor.js updated to skip Track 3
- [ ] Documentation updated with "DISABLED" status
- [ ] Integration tests updated to expect Track 3 skip
- [ ] No 404 errors in pipeline logs

### Phase 3: Testing & Validation

- [ ] `npm test -- test/integration/visual-rag/health.test.js` passes
- [ ] `npm test -- test/integration/visual-rag/detect_elements.test.js` passes (or updated if Option 3)
- [ ] Full pipeline test with structured document (tables/forms) succeeds
- [ ] Circuit breaker state transitions correctly (check metrics)
- [ ] No regressions in existing `/search` endpoint
- [ ] Prometheus metrics show visual element detection latency
- [ ] Grafana dashboard displays circuit breaker state

### Phase 4: Documentation

- [ ] VISUAL_RAG_INTEGRATION.md updated with implementation details
- [ ] EXPERT_PIPELINE_DECISION_TABLE.md updated (Track 3 status)
- [ ] ENVIRONMENT_VARIABLES.md updated if new variables added
- [ ] README.md updated with operational notes
- [ ] CLAUDE.md updated if multi-container setup changes

---

## Known Issues & Gotchas ⚠️

### 1. Model Download on First Run
- First container start downloads ~16GB model
- Can take 10-30 minutes depending on network
- Container may timeout before model loads
- **Solution**: Increase healthcheck intervals or pre-download model

### 2. Flash Attention Build Issues
- Requires CUDA 12.4 compatible flash-attn wheel
- ABI mismatch can cause import errors
- **Solution**: Automatic ABI detection in Dockerfile (lines 62-78)

### 3. VRAM Exhaustion
- ColQwen3 baseline: 8-10GB
- Adding LayoutLMv3: +2-3GB
- Total must stay under 24GB
- **Solution**: Monitor with `nvidia-smi` during testing

### 4. Line Ending Issues (Windows)
- Windows git may add CRLF to Python files
- Causes IndentationError in container
- **Solution**: Dockerfile includes `sed -i 's/\r$//'` normalization (line 95)

### 5. Circuit Breaker Already Open
- If Track 3 has been failing, circuit breaker may be OPEN
- Needs cooldown period (30s default) before accepting requests
- **Solution**: Restart paperless-ai service or wait for cooldown

### 6. Index Path Confusion
- `INDEX_DIR` must be writable by container
- Volume mount must exist in docker-compose.yml
- **Solution**: Verify volume mounts and permissions

---

## Quick Checklist for Implementation Agent ✅

- [ ] Read docs (VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md, ELEMENT_DETECTION_GAP.md)
- [ ] Read prior handoffs (`docs/handovers/visual-rag-*.md`)
- [ ] Review container logs (`docker logs visual_rag`)
- [ ] Choose implementation option (1, 2, or 3)
- [ ] Get stakeholder approval if choosing Option 1 (VRAM budget)
- [ ] Rebuild container with correct environment
- [ ] Verify health and search endpoints work
- [ ] Implement chosen solution
- [ ] Run all integration tests
- [ ] Update documentation
- [ ] Monitor metrics and circuit breaker
- [ ] Create follow-up handoff if needed

---

## Timeline Estimates ⏱️

| Option | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|--------|---------|---------|---------|---------|-------|
| **Option 1 (LayoutLMv3)** | 1-2h | 12-16h | 4-6h | 2-3h | **2.5-3.5 days** |
| **Option 2 (Visual Queries)** | 1-2h | 4-6h | 4-6h | 2-3h | **1.5-2 days** |
| **Option 3 (Disable Track 3)** | 1-2h | 1h | 2-3h | 1h | **0.5-1 day** |

---

## References 🔗

### Documentation Created During Audit
- `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` (NEW)
- `docs/VISUAL_RAG_ELEMENT_DETECTION_GAP.md` (NEW)

### Documentation Updated During Audit
- `docs/EXPERT_PIPELINE_DECISION_TABLE.md` (Track 3 section)
- `docs/VISUAL_RAG_INTEGRATION.md` (Track 3 section)
- `docs/model/tomoro-colqwen3.md` (Capabilities section)

### Pipeline Orchestration Analysis
- Agent ID: `aa19d68` - pipeline-orchestration-expert analysis
- Findings: Missing Stage 5.5, no circuit breaker coordination, visual elements underutilized

### Related Issues
- Stage 5.5 (Visual Query Generation) not implemented in pipeline definitions
- ValidationEngine doesn't check circuit breaker state for retry hints
- OCR reconciliation ignores visual elements for scoring

---

## Contact & Support 📞

If you encounter issues during implementation:

1. **Check logs**: `docker logs visual_rag`
2. **Check metrics**: http://localhost:9091/metrics
3. **Check Grafana**: http://localhost:3001
4. **Review diagnostic scripts**: `services/visual-rag-sidecar/scripts/`
5. **Consult docs**: Start with VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md

**Agent handoff chain**:
- docs-agent (a8469e3) → created comprehensive documentation
- pipeline-orchestration-expert (aa19d68) → analyzed integration gaps
- **→ YOU (implement-agent)** → fix endpoint and validate container

---

## Success Metrics 📊

After implementation, you should see:

- **Health endpoint**: `model_loaded: true`, `flash_attn_available: true`
- **Search endpoint**: Returns results with confidence > 0.7
- **Element endpoint** (if Option 1/2): Returns elements array with bboxes
- **Circuit breaker**: Transitions from OPEN → HALF_OPEN → CLOSED
- **Pipeline**: Stage 4 Track 3 succeeds (or is formally disabled)
- **Metrics**: `visual_element_detection_latency_ms` histogram populated
- **Tests**: All integration tests pass

Good luck! 🚀
