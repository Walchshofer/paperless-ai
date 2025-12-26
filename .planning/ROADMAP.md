# Roadmap: Visual RAG v1.1

## Overview

Building on Visual RAG v1.0 foundation (PDF rendering, overlay extraction, pipeline integration), v1.1 enhances retrieval with hybrid text+visual embeddings, integrates domain experts for smarter interpretation, enables batch processing, and surfaces overlays in the existing UI.

## Phases

- [ ] **Phase 1: Storage Infrastructure** - PostgreSQL overlay storage working end-to-end
- [ ] **Phase 2: Hybrid Embeddings** - OCR-enhanced search combining text + visual
- [ ] **Phase 3: Domain Expert Integration** - Expert-guided overlay interpretation
- [ ] **Phase 4: Batch Ingestion** - Process existing document library
- [ ] **Phase 5: UI Enhancement** - Add overlay visualization to existing pages

## Phase Details

### Phase 1: Storage Infrastructure
**Goal**: PostgreSQL overlay storage accessible and working from all environments (Docker + host)
**Depends on**: Nothing (first phase)
**Plans**: 2 plans

Plans:
- [ ] 01-01: Fix PostgreSQL connectivity and schema migration
- [ ] 01-02: Implement overlay CRUD operations with tests

### Phase 2: Hybrid Embeddings
**Goal**: Combine visual embeddings with OCR text from paperless-ngx for better retrieval
**Depends on**: Phase 1
**Plans**: 2 plans

Plans:
- [ ] 02-01: Integrate OCR text extraction from paperless-ngx API
- [ ] 02-02: Implement hybrid embedding strategy and search

### Phase 3: Domain Expert Integration
**Goal**: Use domain experts (medical, financial, legal) to refine overlay detection and interpretation
**Depends on**: Phase 2
**Plans**: 2 plans

Plans:
- [ ] 03-01: Wire domain expert selection to overlay extraction
- [ ] 03-02: Implement expert-guided label refinement and confidence adjustment

### Phase 4: Batch Ingestion
**Goal**: Process existing document library (100+ documents) without manual intervention
**Depends on**: Phase 3
**Plans**: 2 plans

Plans:
- [ ] 04-01: Create batch ingestion queue and worker
- [ ] 04-02: Add progress tracking, error handling, and retry logic

### Phase 5: UI Enhancement
**Goal**: Display bounding box overlays on existing Tailwind pages
**Depends on**: Phase 4
**Plans**: 3 plans

Target pages:
- `/manual` - Manual document processing
- `/chat` - Chat interface
- `/rag` - RAG interface
- `/playground` - Testing playground
- `/history` - Reanalyze buttons per document row

Plans:
- [ ] 05-01: Create overlay visualization component (yellow boxes)
- [ ] 05-02: Integrate overlays into manual, chat, rag pages
- [ ] 05-03: Add overlay display to history page with reanalyze integration

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Storage Infrastructure | 0/2 | Not started | - |
| 2. Hybrid Embeddings | 0/2 | Not started | - |
| 3. Domain Expert Integration | 0/2 | Not started | - |
| 4. Batch Ingestion | 0/2 | Not started | - |
| 5. UI Enhancement | 0/3 | Not started | - |
