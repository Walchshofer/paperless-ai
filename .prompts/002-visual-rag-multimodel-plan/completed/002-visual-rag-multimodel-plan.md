<objective>
Create implementation roadmap for Visual RAG system with multi-domain expertise.

Purpose: Enable accurate extraction from complex documents containing images, tables, and visual elements using vision models when text-only analysis fails or is insufficient.

Input:
- External API research findings: @.prompts/001-external-api-integration-research/external-api-integration-research.md
- Existing multi-model routing: @prompts/002-multi-model-routing.md
- Current ollamaService.js implementation

Output: `.prompts/002-visual-rag-multimodel-plan/visual-rag-multimodel-plan.md`
</objective>

<context>
**Existing Capabilities (from codebase analysis):**
- Multi-model routing already implemented in `ollamaService.js` (commit dd19679)
- Keyword-based document classification (medical, financial keywords)
- Thumbnail caching in `public/images/{id}.png`
- PDF documents scanned, text extracted

**Current Gaps:**
- No vision model support (Qwen3-VL not integrated)
- No fallback when text extraction fails or is poor quality
- Tables and images in documents not analyzed
- Limited to text-only analysis regardless of document complexity

**User Requirements:**
- Visual RAG system for document analysis (local Ollama only)
- Support for medical, financial, technical, and visual document types
- Use PNG/image files when text extraction fails
- Multi-domain expertise in prompts
- Maximum accuracy from complex documents
- Vision model: Qwen3-VL via Ollama
</context>

<planning_requirements>
**Technical Requirements:**
- Integrate Qwen3-VL vision model via Ollama (local only, no cloud APIs)
- Build visual analysis pipeline that can process document images
- Implement quality detection to trigger visual fallback
- Enhance multi-model routing for visual vs text routing
- All models run locally on Ollama

**Available Models (from `ollama list`):**
- gpt-oss:latest (13GB) - text analysis model
- qwen3-vl:8b (6.1GB) - vision model (already installed)
- Total: 19.1GB - both fit in 24GB VRAM simultaneously (no rotation needed!)

**Architecture Goals:**
- Extend existing multi-model routing (don't replace)
- Maintain backward compatibility with current config
- Run both models concurrently for fast switching

**Each phase must be executable as a single prompt.**
</planning_requirements>

<output_structure>
Save to: `.prompts/002-visual-rag-multimodel-plan/visual-rag-multimodel-plan.md`

Structure the plan using this XML format:

```xml
<plan>
  <summary>
    {Overview of Visual RAG implementation approach using Qwen3-VL}
  </summary>

  <phases>
    <phase number="1" name="vision-model-integration">
      <objective>Add Qwen3-VL vision model support to Ollama service</objective>
      <tasks>
        <task priority="high">Add OLLAMA_MODEL_VISION env config (default: qwen2-vl:7b)</task>
        <task priority="high">Implement vision model selection logic in multi-model router</task>
        <task priority="high">Create vision-specific API call method using Ollama vision format</task>
        <task priority="medium">Handle base64 image encoding for Qwen3-VL</task>
        <task priority="medium">Implement model rotation (unload gpt-oss, load qwen2-vl) for VRAM management</task>
      </tasks>
      <deliverables>
        <deliverable>ollamaService.js with Qwen3-VL vision support</deliverable>
        <deliverable>Environment config for vision model</deliverable>
        <deliverable>Model rotation utility for VRAM management</deliverable>
      </deliverables>
      <dependencies>Ollama qwen2-vl:7b model pulled locally</dependencies>
      <execution_notes>
        Extends existing multi-model routing.
        Qwen3-VL uses Ollama's vision API format with images array.
        Test with single document before batch processing.
        Model rotation: `ollama stop gpt-oss && ollama run qwen2-vl`
      </execution_notes>
    </phase>

    <phase number="2" name="quality-detection">
      <objective>Detect when to use visual analysis vs text-only</objective>
      <tasks>
        <task priority="high">Implement text extraction quality scoring</task>
        <task priority="high">Detect table presence in content (markdown table patterns, column alignment)</task>
        <task priority="medium">Identify image-heavy documents (low text density)</task>
        <task priority="medium">Create routing logic: quality score + document type → vision or text</task>
        <task priority="low">Add manual override flag for forcing vision analysis</task>
      </tasks>
      <deliverables>
        <deliverable>Quality detection module (qualityDetector.js)</deliverable>
        <deliverable>Enhanced routing logic in ollamaService.js</deliverable>
      </deliverables>
      <dependencies>Phase 1 complete</dependencies>
      <execution_notes>
        Quality indicators:
        - Text length ratio (chars vs expected for page count)
        - OCR artifact patterns (|||, ###, broken words)
        - Table detection (pipe chars, consistent spacing)
        - Keyword density (too low = likely OCR failed)

        Threshold: quality_score < 0.6 → use vision model
      </execution_notes>
    </phase>

    <phase number="3" name="visual-rag-pipeline">
      <objective>Build complete visual document analysis pipeline</objective>
      <tasks>
        <task priority="high">Implement document image retrieval from Paperless API</task>
        <task priority="high">Create vision prompt template for document analysis</task>
        <task priority="high">Handle image preprocessing (resize for optimal token usage)</task>
        <task priority="medium">Implement hybrid analysis (text context + visual analysis)</task>
        <task priority="medium">Handle multi-page documents (analyze first page or key pages)</task>
      </tasks>
      <deliverables>
        <deliverable>Visual RAG pipeline (visualAnalyzer.js)</deliverable>
        <deliverable>Vision-specific system prompts</deliverable>
        <deliverable>Image preprocessing utilities</deliverable>
      </deliverables>
      <dependencies>Phase 2 complete</dependencies>
      <execution_notes>
        Use existing thumbnail cache or request full document image via Paperless API.
        Qwen3-VL can read tables directly from images - leverage this for financial docs.
        Combine visual insights with available text for best results.
        For multi-page: analyze thumbnail (composite) or first page.
      </execution_notes>
    </phase>

    <phase number="4" name="domain-expertise-prompts">
      <objective>Create specialized vision prompts for each domain</objective>
      <tasks>
        <task priority="high">Medical vision prompt (lab reports with tables, prescriptions, handwriting)</task>
        <task priority="high">Financial vision prompt (invoices, receipts, line item tables)</task>
        <task priority="high">Technical vision prompt (diagrams, specifications, labels)</task>
        <task priority="medium">General vision prompt (catch-all for unclassified documents)</task>
        <task priority="medium">Integrate prompt selection with existing category detection</task>
      </tasks>
      <deliverables>
        <deliverable>Domain-specific vision prompts (4 variants)</deliverable>
        <deliverable>Enhanced category detection with visual hints</deliverable>
      </deliverables>
      <dependencies>Phase 3 complete</dependencies>
      <execution_notes>
        Vision prompts should instruct Qwen3-VL to:
        - Medical: Read lab values from tables, medication lists, doctor signatures
        - Financial: Extract line items, amounts, VAT, totals from invoice layouts
        - Technical: Read specifications from labels, extract model numbers from images
        - General: Comprehensive analysis for mixed/unknown document types

        All prompts must output JSON matching existing schema.
      </execution_notes>
    </phase>
  </phases>

  <metadata>
    <confidence level="medium">
      Qwen3-VL integration via Ollama is straightforward.
      Quality detection heuristics need experimentation with real documents.
      Multi-page document handling may have edge cases.
      VRAM rotation adds latency but enables larger models.
    </confidence>
    <dependencies>
      - Ollama qwen2-vl:7b model installed (`ollama pull qwen2-vl:7b`)
      - 24GB VRAM available (rotation strategy for concurrent usage)
      - Paperless API provides document images
    </dependencies>
    <open_questions>
      - Optimal quality threshold for triggering visual analysis?
      - Best image resolution for Qwen3-VL (balance quality vs tokens)?
      - Handle scanned documents with mixed quality pages?
      - Model rotation latency impact on batch processing?
    </open_questions>
    <assumptions>
      - Qwen3-VL 7B fits alongside gpt-oss with rotation
      - Paperless provides document images via API
      - PNG format from scanner is sufficient quality for vision models
      - Single-page or first-page analysis is sufficient for most documents
    </assumptions>
  </metadata>
</plan>
```
</output_structure>

<summary_requirements>
Also create `.prompts/002-visual-rag-multimodel-plan/SUMMARY.md` with:
- Substantive one-liner summarizing the 4-phase approach
- Phase overview (1-2 words each phase)
- Decisions needed (quality thresholds, image resolution)
- Blockers (qwen2-vl model installation)
- Next step: Execute Phase 1
</summary_requirements>

<success_criteria>
- Plan builds on existing multi-model routing (doesn't replace it)
- Each phase is independently executable
- VRAM constraints acknowledged with rotation strategy
- Qwen3-VL specified as the vision model
- Domain expertise expanded beyond current medical/financial
- Clear path from current state to Visual RAG capability
- SUMMARY.md has substantive one-liner
- No cloud API dependencies (local Ollama only)
</success_criteria>
