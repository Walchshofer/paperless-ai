# Visual RAG Migration Checklist

**Goal:** Incrementally refactor `ollamaService.js` into the 3-stage pipeline without breaking current functionality.

---

## Phase 0: Preparation (No Code Changes)

- [ ] **0.1** Freeze ADR as authoritative spec
- [ ] **0.2** Review `fieldRegistry.json` and `profiles.json` - ensure all current custom fields are represented
- [ ] **0.3** Verify qwen3-vl:8b is installed: `ollama list | grep qwen3-vl`
- [ ] **0.4** Create backup branch: `git checkout -b backup/pre-visual-rag`
- [ ] **0.5** Document current `analyzeDocument()` behavior as baseline

---

## Phase 1: Add Config (Non-Breaking)

Files: `config/config.js`

- [ ] **1.1** Add vision model config:
  ```javascript
  ollama: {
    apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    visionModel: process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b',  // NEW
    visionKeepAlive: process.env.VISION_KEEP_ALIVE || '5m',        // NEW
    textKeepAlive: process.env.TEXT_KEEP_ALIVE || '2m'             // NEW
  }
  ```

- [ ] **1.2** Add quality threshold config:
  ```javascript
  visualRag: {
    enabled: parseEnvBoolean(process.env.ENABLE_VISUAL_RAG, 'no'),
    textQualityThreshold: parseInt(process.env.TEXT_QUALITY_THRESHOLD || '60', 10),
    forceVision: parseEnvBoolean(process.env.FORCE_VISUAL_RAG, 'no')
  }
  ```

- [ ] **1.3** Test: App starts without errors

---

## Phase 2: Add FieldProfiler Integration (Non-Breaking)

Files: `services/ollamaService.js`

- [ ] **2.1** Import FieldProfiler at top:
  ```javascript
  const FieldProfiler = require('./visual-rag/FieldProfiler');
  ```

- [ ] **2.2** Initialize in constructor:
  ```javascript
  this.fieldProfiler = new FieldProfiler();
  ```

- [ ] **2.3** Add lazy init in `analyzeDocument()`:
  ```javascript
  await this.fieldProfiler.init();
  ```

- [ ] **2.4** Test: Existing functionality unchanged

---

## Phase 3: Add Vision API Method (Non-Breaking)

Files: `services/ollamaService.js`

- [ ] **3.1** Add `_callOllamaVisionAPI()` method:
  ```javascript
  async _callOllamaVisionAPI(prompt, base64Image, options = {}) {
    const response = await this.client.post(`${this.apiUrl}/api/generate`, {
      model: config.ollama.visionModel,
      prompt: prompt,
      images: [base64Image],
      keep_alive: options.keep_alive || config.ollama.visionKeepAlive,
      stream: false,
      options: {
        num_ctx: 32768,
        num_predict: 4096,
        temperature: 0.3
      }
    });
    return response.data;
  }
  ```

- [ ] **3.2** Add `_loadThumbnailAsBase64()` helper:
  ```javascript
  async _loadThumbnailAsBase64(documentId) {
    const thumbnailPath = path.join(process.cwd(), 'public', 'images', `${documentId}.png`);
    try {
      const buffer = await fs.readFile(thumbnailPath);
      return buffer.toString('base64');
    } catch (e) {
      console.log(`[VISION] No thumbnail for doc ${documentId}`);
      return null;
    }
  }
  ```

- [ ] **3.3** Test: Call `_callOllamaVisionAPI()` manually with test image

---

## Phase 4: Add Quality Detection (Non-Breaking)

Files: `services/ollamaService.js`

- [ ] **4.1** Add `_assessTextQuality()` method:
  ```javascript
  _assessTextQuality(content) {
    if (!content || content.length < 50) return 0;

    const words = content.split(/\s+/);
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    const specialCharRatio = (content.match(/[^\w\s]/g) || []).length / content.length;

    let score = 100;
    if (avgWordLength < 3) score -= 30;
    if (specialCharRatio > 0.15) score -= 30;
    if (words.length < 20) score -= 20;

    return Math.max(0, score);
  }
  ```

- [ ] **4.2** Add `_detectVisualComplexity()` method:
  ```javascript
  _detectVisualComplexity(content) {
    const flags = [];
    if ((content.match(/\|/g) || []).length > 5) flags.push('table');
    if (/\[\s*[xX]?\s*\]/.test(content)) flags.push('form');
    if (/^\s{2,}\S+\s{2,}\S+/m.test(content)) flags.push('columns');
    return flags;
  }
  ```

- [ ] **4.3** Test: Log quality scores for sample documents

---

## Phase 5: Add Routing Logic (Non-Breaking)

Files: `services/ollamaService.js`

- [ ] **5.1** Add `_determineAnalysisMode()`:
  ```javascript
  _determineAnalysisMode(content) {
    if (!config.visualRag.enabled) return 'TEXT_ONLY';
    if (config.visualRag.forceVision) return 'VISION_ONLY';

    const quality = this._assessTextQuality(content);
    const complexity = this._detectVisualComplexity(content);

    if (quality < 40) return 'VISION_ONLY';
    if (quality >= 70 && complexity.length < 2) return 'TEXT_ONLY';
    return 'SEQUENTIAL';
  }
  ```

- [ ] **5.2** Test: Log routing decisions for sample documents

---

## Phase 6: Add Vision Analysis Path (Feature Flag)

Files: `services/ollamaService.js`

- [ ] **6.1** Add `analyzeDocumentWithVision()`:
  ```javascript
  async analyzeDocumentWithVision(documentId, content, options = {}) {
    const base64Image = await this._loadThumbnailAsBase64(documentId);
    if (!base64Image) {
      console.log('[VISION] Fallback to text: no thumbnail');
      return this.analyzeDocument(content, options);
    }

    await this.fieldProfiler.init();
    const profileId = this.fieldProfiler.selectProfile(options.classification || {});
    const prompt = this.fieldProfiler.generateExtractionPrompt(profileId);

    const response = await this._callOllamaVisionAPI(prompt, base64Image);
    return this._processOllamaResponse(response.response);
  }
  ```

- [ ] **6.2** Test: Enable `ENABLE_VISUAL_RAG=yes`, process test document

---

## Phase 7: Add Sequential Pipeline (Feature Flag)

Files: `services/ollamaService.js`

- [ ] **7.1** Add `analyzeDocumentSequential()`:
  ```javascript
  async analyzeDocumentSequential(documentId, content, options = {}) {
    // Text first
    const textResult = await this.analyzeDocument(content, options);

    const quality = this._assessTextQuality(content);
    if (quality >= config.visualRag.textQualityThreshold) {
      return textResult;
    }

    // Vision second
    const visionResult = await this.analyzeDocumentWithVision(documentId, content, options);

    // Merge
    return this._mergeAnalysisResults(textResult, visionResult);
  }
  ```

- [ ] **7.2** Add `_mergeAnalysisResults()`:
  ```javascript
  _mergeAnalysisResults(textResult, visionResult) {
    return {
      title: visionResult.title || textResult.title,
      correspondent: visionResult.correspondent || textResult.correspondent,
      tags: [...new Set([...(textResult.tags || []), ...(visionResult.tags || [])])],
      document_type: visionResult.document_type || textResult.document_type,
      document_date: visionResult.document_date || textResult.document_date,
      language: textResult.language || visionResult.language,
      custom_fields: { ...textResult.custom_fields, ...visionResult.custom_fields },
      _analysisMode: 'SEQUENTIAL',
      _sources: { text: textResult, vision: visionResult }
    };
  }
  ```

- [ ] **7.3** Test: Sequential analysis on complex document

---

## Phase 8: Wire Up Main Entry Point

Files: `services/ollamaService.js`, `routes/setup.js`

- [ ] **8.1** Modify `analyzeDocument()` to use routing:
  ```javascript
  async analyzeDocument(content, options = {}) {
    const mode = this._determineAnalysisMode(content);
    console.log(`[ANALYSIS] Mode: ${mode}`);

    switch (mode) {
      case 'VISION_ONLY':
        return this.analyzeDocumentWithVision(options.documentId, content, options);
      case 'SEQUENTIAL':
        return this.analyzeDocumentSequential(options.documentId, content, options);
      default:
        return this._analyzeDocumentText(content, options);
    }
  }
  ```

- [ ] **8.2** Rename original `analyzeDocument` to `_analyzeDocumentText`

- [ ] **8.3** Update `routes/setup.js` to pass `documentId` in options

- [ ] **8.4** Full integration test

---

## Phase 9: Domain Expert Prompts

Files: `config/schemas/profiles.json`

- [ ] **9.1** Test medical profile with lab report
- [ ] **9.2** Test financial profile with invoice
- [ ] **9.3** Test technical profile with manual
- [ ] **9.4** Tune extraction hints based on results

---

## Phase 10: Cleanup & Documentation

- [ ] **10.1** Remove deprecated code paths
- [ ] **10.2** Update `.env.example` with new variables
- [ ] **10.3** Update README with Visual RAG section
- [ ] **10.4** Merge to main: `git merge feature/visual-rag`

---

## Rollback Plan

If issues occur:

1. Set `ENABLE_VISUAL_RAG=no` → immediate fallback to text-only
2. Revert to backup branch: `git checkout backup/pre-visual-rag`
3. Redeploy with `docker compose down && docker compose up -d`

---

## Verification Checklist

After each phase:

- [ ] App starts without errors
- [ ] Existing documents process correctly
- [ ] No regressions in text-only analysis
- [ ] `docker compose logs paperless-ai | grep ERROR` shows no new errors
- [ ] `ollama ps` shows expected model loading behavior
