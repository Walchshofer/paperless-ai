# Visual RAG v1.1

## Current State (Updated: 2024-12-26)

**Shipped:** v1.0 Visual RAG Foundation (2024-12-26)
**Status:** Development / Internal testing
**Codebase:**
- ~17,000 lines of JavaScript
- Node.js + Express backend
- Ollama (Qwen3-VL, qwen2.5:14b), PostgreSQL, Docker
- Integrates with paperless-ngx document management

**Working Components:**
- PDFRenderer.js - 300 DPI PDF-to-image conversion
- OverlayExtractor.js - Qwen3-VL bounding box detection
- ExpertPipelineExecutor.js - Visual RAG integration
- DocumentProcessor.js - Ingestion trigger

**Known Issues:**
- Visual Sidecar (ColQwen2) not fully integrated
- PostgreSQL overlay storage not accessible from Windows host
- No batch document ingestion
- No UI overlay visualization

## v1.1 Goals

**Vision:** Enhance Visual RAG with hybrid text+visual retrieval and domain expert guidance.

**Motivation:**
- Paperless-ngx OCR text is underutilized for visual retrieval
- Domain experts (medical, financial, legal) can improve overlay interpretation
- Need production-ready storage and UI visualization

**Scope (v1.1):**
- Complete PostgreSQL overlay storage integration
- Implement OCR-enhanced hybrid embeddings (visual + text)
- Domain expert overlay interpretation pipeline
- Batch document ingestion for existing library
- UI overlay visualization ("yellow box" feature)

**Success Criteria:**
- [ ] Overlays stored and retrieved from PostgreSQL
- [ ] Hybrid search returns better results than vision-only
- [ ] Domain experts can refine overlay labels/confidence
- [ ] Batch process ingests 100+ documents without manual intervention
- [ ] UI displays bounding boxes on document preview

**Out of Scope:**
- Training custom vision models
- Real-time document scanning
- Multi-tenant support
- Mobile UI
