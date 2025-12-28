# Roadmap: paperless-ai

## Overview
Deliver a localized, cost-aware, expert model pipeline for paperless-ngx by building a translation layer, semantic routing, template localization, and retrieval orchestration, then validating quality with evaluation and A/B testing.

## Phases
- [ ] **Phase 1: Infrastructure & Data Layer** - pgvector foundation and ingestion pipeline.
- [ ] **Phase 2: The Brain** - translation, routing, and localized templates.
- [ ] **Phase 3: Retrieval & Orchestration** - hybrid retrieval and expert pipeline alignment.
- [ ] **Phase 4: Evaluation & Optimization** - test harness and A/B validation.

## Phase Details
### Phase 1: Infrastructure & Data Layer
**Goal**: Establish pgvector storage and ingestion pipeline (OCR -> translate -> embed -> insert).
**Depends on**: Nothing (first phase)
**Plans**: 2 plans

Plans:
- [ ] 01-01: DB schema for pgvector
- [ ] 01-02: Ingestion pipeline (OCR -> translate -> embed -> insert)

### Phase 2: The Brain
**Goal**: Build the routing, translation, and prompt localization core.
**Depends on**: Phase 1
**Plans**: 3 plans

Plans:
- [ ] 02-01: LocalTranslator implementation
- [ ] 02-02: Cost-aware SemanticRouter implementation
- [ ] 02-03: TemplateRegistry + localized prompt variants

### Phase 3: Retrieval & Orchestration
**Goal**: Align retrieval and prompt generation with expert model native language.
**Depends on**: Phase 2
**Plans**: 2 plans

Plans:
- [ ] 03-01: Hybrid PgVectorRetriever implementation
- [ ] 03-02: ExpertPipeline update (TemplateManager + translation flow)

### Phase 4: Evaluation & Optimization
**Goal**: Validate quality and optimize prompt language alignment.
**Depends on**: Phase 3
**Plans**: 2 plans

Plans:
- [ ] 04-01: Evaluation harness tests
- [ ] 04-02: Template A/B testing for expert models

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Data Layer | 0/2 | Not started | - |
| 2. The Brain | 0/3 | Not started | - |
| 3. Retrieval & Orchestration | 0/2 | Not started | - |
| 4. Evaluation & Optimization | 0/2 | Not started | - |
