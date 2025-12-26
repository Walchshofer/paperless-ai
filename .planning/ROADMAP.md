# Roadmap: Visual RAG v1.1

## Overview

Building on Visual RAG v1.0 foundation (PDF rendering, overlay extraction, pipeline integration), v1.1 enhances retrieval with hybrid text+visual embeddings, integrates domain experts for smarter interpretation, enables batch processing, and surfaces overlays in the existing UI.

## Phases

- [x] **Phase 1: Storage Infrastructure** - PostgreSQL overlay storage working end-to-end ✅
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
- [x] 01-01: Fix PostgreSQL connectivity and schema migration ✅
- [x] 01-02: Implement overlay CRUD operations with tests ✅

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
**Goal**: Display color-coded bounding box overlays mapped to paperless-ngx fields
**Depends on**: Phase 4
**Plans**: 3 plans

Target pages:
- `/manual` - Manual document processing with overlay preview
- `/chat` - Chat interface with document overlays
- `/rag` - RAG interface with document overlays
- `/history` - Overlay badges and reanalyze integration

Domain color scheme:
- 🟧 Financial: Oranges (#FFF7ED → #9A3412)
- 🟩 Medical: Greens/Teals (#BBF7D0 → #065F46)
- 🟪 Legal: Purples (#E9D5FF → #581C87)
- 🟦 General: Blues (#93C5FD → #1D4ED8)

Plans:
- [ ] 05-01: Update OverlayExtractor with new format and domain field specs
- [ ] 05-02: Create OverlayViewer and OverlayLegend UI components
- [ ] 05-03: Integrate into manual, chat, rag, history pages

## Progress

| Phase | Plans | Tasks | Status | Completed |
|-------|-------|-------|--------|-----------|
| 1. Storage Infrastructure | 2/2 | 6/6 | **Complete** | 2025-12-26 |
| 2. Hybrid Embeddings | 0/2 | 0/6 | Planned | - |
| 3. Domain Expert Integration | 0/2 | 0/6 | Planned | - |
| 4. Batch Ingestion | 0/2 | 0/6 | Planned | - |
| 5. UI Enhancement | 0/3 | 0/9 | Planned | - |

**Total: 11 plans, 33 tasks across 5 phases**
**Completed: 2 plans, 6 tasks (Phase 1)**
