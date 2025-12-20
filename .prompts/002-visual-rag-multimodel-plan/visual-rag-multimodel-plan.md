# Visual RAG Implementation Plan with Qwen3-VL

<plan>
  <summary>
    Four-phase implementation roadmap to integrate Qwen3-VL (qwen3-vl:8b) vision model into paperless-ai for Visual RAG document analysis. Uses Ollama's auto-managed memory via `keep_alive` parameter - no manual model rotation needed. Ollama handles GPU/CPU swapping automatically. Vision-based analysis activates when text extraction fails or is insufficient.
  </summary>

  <ollama_memory_management>
    **Key Insight: Ollama is self-managing**
    
    Use `keep_alive` parameter to control model residency:
    - "5m": Keep model 5 minutes (vision - expensive to reload)
    - "2m": Keep model 2 minutes (text - lighter)
    - 0: Unload immediately
    - -1: Keep indefinitely
    
    Monitor: `ollama ps` shows loaded models and GPU %
    
    **No manual offloading needed** - Ollama auto-swaps between GPU/CPU based on resources.
  </ollama_memory_management>

  <phases>
    <phase number="1" name="Vision Model Integration">
      <objective>
        Add qwen3-vl:8b support to ollamaService.js with keep_alive memory management and vision API calls.
      </objective>

      <tasks>
        <task priority="high">Add OLLAMA_VISION_MODEL config (default: qwen3-vl:8b)</task>
        <task priority="high">Add VISION_KEEP_ALIVE config (default: "5m")</task>
        <task priority="high">Create _callOllamaVisionAPI() with images[] and keep_alive</task>
        <task priority="medium">Implement base64 image encoding for thumbnails</task>
        <task priority="medium">Add analyzeDocumentWithVision() entry point</task>
      </tasks>

      <deliverables>
        <deliverable>ollamaService.js with vision API support</deliverable>
        <deliverable>config/config.js with vision + keep_alive settings</deliverable>
      </deliverables>

      <execution_notes>
        Vision API call with keep_alive:
        ```javascript
        async _callOllamaVisionAPI(prompt, base64Image, options = {}) {
          return await this.client.post(`${this.apiUrl}/api/generate`, {
            model: this.visionModel,  // qwen3-vl:8b
            prompt: prompt,
            images: [base64Image],    // Raw base64, no data: prefix
            keep_alive: options.keep_alive || "5m",
            stream: false,
            options: {
              num_ctx: 32768,
              num_predict: 4096,
              temperature: 0.3
            }
          });
        }
        ```
        
        Image encoding:
        ```javascript
        const imageBuffer = await fs.readFile(thumbnailPath);
        const base64Image = imageBuffer.toString('base64');
        ```
        
        Test: `ollama ps` to verify model loading
      </execution_notes>
    </phase>

    <phase number="2" name="Quality Detection and Routing">
      <objective>
        Detect when to use vision vs text analysis based on OCR quality indicators.
      </objective>

      <tasks>
        <task priority="high">Implement _assessTextQuality() scoring (0-100)</task>
        <task priority="high">Detect tables, forms, visual complexity</task>
        <task priority="medium">Create routing: TEXT_ONLY / VISION_ONLY / SEQUENTIAL</task>
        <task priority="medium">Add TEXT_QUALITY_THRESHOLD config (default: 60)</task>
      </tasks>

      <deliverables>
        <deliverable>Quality scoring algorithm</deliverable>
        <deliverable>Analysis mode router</deliverable>
      </deliverables>

      <execution_notes>
        Routing decision:
        | Text Quality | Mode         | Action                    |
        |-------------|--------------|---------------------------|
        | High (>70)  | TEXT_ONLY    | Use gpt-oss only          |
        | Medium      | SEQUENTIAL   | Text first, then vision   |
        | Low (<40)   | VISION_ONLY  | Use qwen3-vl only         |
        
        Quality indicators:
        - OCR garbage: special chars > 15%
        - Short words: avg length < 3
        - Table patterns: pipe chars, grids
      </execution_notes>
    </phase>

    <phase number="3" name="Visual RAG Pipeline">
      <objective>
        Build sequential analysis pipeline with Ollama auto-managed model swapping.
      </objective>

      <tasks>
        <task priority="high">Implement analyzeDocumentSequential()</task>
        <task priority="high">Create _mergeAnalysisResults() for combining outputs</task>
        <task priority="medium">Add fallback chain: text → vision → degraded</task>
        <task priority="medium">Track metrics including model load times</task>
      </tasks>

      <deliverables>
        <deliverable>Sequential analysis pipeline</deliverable>
        <deliverable>Result merger with source tracking</deliverable>
      </deliverables>

      <execution_notes>
        Sequential execution (Ollama manages memory):
        ```javascript
        async analyzeDocumentSequential(content, thumbnail, options) {
          // 1. Text analysis (Ollama loads gpt-oss if needed)
          const textResult = await this._callOllamaAPI(prompt, {
            keep_alive: "2m"
          });
          
          // 2. Check if vision needed
          const quality = this._assessTextQuality(textResult);
          if (quality >= 70) return textResult;
          
          // 3. Vision analysis (Ollama auto-swaps models)
          const visionResult = await this._callOllamaVisionAPI(
            visionPrompt, 
            base64Thumbnail,
            { keep_alive: "5m" }
          );
          
          // 4. Merge results
          return this._mergeAnalysisResults(textResult, visionResult);
        }
        ```
        
        Merge priority:
        - Tags: union, deduplicated
        - Correspondent: vision for scanned docs
        - Numeric fields: vision (better table reading)
      </execution_notes>
    </phase>

    <phase number="4" name="Domain Expertise Prompts">
      <objective>
        Create specialized vision prompts for medical, financial, and technical documents.
      </objective>

      <tasks>
        <task priority="high">Medical prompt: lab reports, prescriptions</task>
        <task priority="high">Financial prompt: invoices, VAT, tables</task>
        <task priority="high">Technical prompt: specs, diagrams</task>
        <task priority="medium">Domain detection via keywords</task>
      </tasks>

      <deliverables>
        <deliverable>4 domain-specific vision prompts</deliverable>
        <deliverable>Domain detection for prompt selection</deliverable>
      </deliverables>

      <execution_notes>
        Medical: Extract lab values, medication dosages, German terminology
        Financial: Line items, VAT amounts, IBAN, payment details
        Technical: Specifications, part numbers, diagram annotations
      </execution_notes>
    </phase>
  </phases>

  <metadata>
    <confidence level="high">
      Ollama auto-manages memory via keep_alive.
      All components exist (thumbnails, APIs, models installed).
    </confidence>

    <models>
      - qwen3-vl:8b (6.1GB) - vision model
      - gpt-oss:latest (13GB) - text model
    </models>

    <implementation_note>
      Use Context7 MCP Server for up-to-date Ollama API documentation when implementing code.
    </implementation_note>

    <estimated_effort>
      Phase 1: 4-6 hours
      Phase 2: 3-4 hours
      Phase 3: 4-6 hours
      Phase 4: 3-4 hours
      Total: 14-20 hours
    </estimated_effort>
  </metadata>
</plan>
