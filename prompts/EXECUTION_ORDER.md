# Prompt Execution Order and Dependencies

## Overview
This document defines the authoritative execution order for implementation and verification prompts 001-018, including dependencies, parallel execution opportunities, and integration checkpoints.

**BREAKING CHANGE (2026-01):** Prompt 018 introduces Qdrant migration. For new deployments, execute 018 first. See `docs/QDRANT_MIGRATION.md`.

## Dependency Graph

```mermaid
graph TD
    %% Phase 1: Backend Foundation
    001[001: Feedback Persistence] --> 002[002: Paperless Integration]
    001 --> 011[011: Verify DB Schema]
    002 --> 013[013: Verify Telemetry]

    %% Phase 2: Manual Route UI
    002 --> 003[003: Visual Annotation UI]
    002 --> 004[004: Manual Feedback UI]
    003 --> 004
    004 --> 015[015: Feedback E2E Test]

    %% Phase 3: History Route Enhancement
    005[005: Visual Sidecar] --> 006[006: Visual Search API]
    006 --> 007[007: Verify Visual Search API]
    006 --> 014[014: Verify Circuit Breaker]
    007 --> 008[008: History Split Layout]
    008 --> 009[009: Visual Red Pen]
    008 --> 012[012: Verify Frontend Islands]
    009 --> 010[010: Final Integration Test]

    %% Phase 4: Final Verification & Cleanup
    011 & 012 & 013 & 014 & 015 & 010 --> 016[016: Verification Checklist]

    %% Independent / Cleanup
    017[017: Refactor Playground]

    %% Phase 5: Qdrant Migration (BREAKING CHANGE)
    018[018: Qdrant Migration] --> 001
    018 --> 005
    018 --> 011

    style 001 fill:#e1f5ff
    style 002 fill:#e1f5ff
    style 003 fill:#e1f5ff
    style 004 fill:#e1f5ff
    style 005 fill:#fff4e1
    style 006 fill:#fff4e1
    style 007 fill:#dff0d8
    style 008 fill:#fff4e1
    style 009 fill:#fff4e1
    style 010 fill:#dff0d8
    style 011 fill:#dff0d8
    style 012 fill:#dff0d8
    style 013 fill:#dff0d8
    style 014 fill:#dff0d8
    style 015 fill:#dff0d8
    style 016 fill:#dff0d8
    style 017 fill:#f9f9f9
    style 018 fill:#ffcccc
```

## Execution Phases

### Phase 1: Backend Foundation (Sequential)
**Prompts:** 001, 011, 002, 013
**Blocking:** Must complete before Phase 2

- **001: Implement Feedback Persistence** (Foundation)
- **011: Verification: Database Schema** (Verifies 001)
- **002: Enhance Paperless Integration** (Depends on 001)
- **013: Verification: Telemetry** (Verifies 002/System)

### Phase 2: Manual Route UI (Parallel Possible)
**Prompts:** 003, 004, 015
**Blocking:** Independent from History Route (Phase 3)

- **003: Implement Visual Annotation UI** (Depends on 002)
- **004: Implement Manual Feedback UI** (Depends on 003)
- **015: Integration Feedback E2E** (Verifies 004 + 001 flow)

### Phase 3: History Route Enhancement (Parallel with Phase 2)
**Prompts:** 005, 006, 007, 014, 008, 012, 009, 010

- **005: Upgrade Visual Sidecar** (Independent Python service)
- **006: Expose Visual Search API** (Depends on 005)
- **007: Verify Visual Search API** (Standalone verification for 006)
- **014: Verification: Circuit Breaker** (Verifies 006 resilience)
- **008: Implement History Split Layout** (Depends on 007)
- **012: Verification: Frontend Islands** (Verifies 008/Islands architecture)
- **009: Implement Visual Red Pen** (Depends on 008)
- **010: Final Integration Test** (Verifies History Route E2E)

### Phase 4: Final Verification & Cleanup
**Prompts:** 016, 017

- **016: Verification Checklist** (Consolidated gates for all previous steps)
- **017: Refactor Playground** (Cleanup task, can be done anytime, ideally after core features)

### Phase 5: Qdrant Migration (BREAKING CHANGE)
**Prompts:** 018
**Blocking:** Should be executed BEFORE Phases 1-4 for new deployments

- **018: Qdrant Migration** (Vector store migration from pgVector to Qdrant)
  - Implements QdrantAdapter (JS and Python)
  - Updates all services to use Qdrant
  - Requires re-ingestion of all documents from paperless-ngx backup
  - See `docs/QDRANT_MIGRATION.md` for details

## Integration Checkpoints

### Checkpoint 1: Database & Telemetry
**After:** 001, 011, 002, 013
**Verify:** Schema correct, Telemetry propagating.

### Checkpoint 2: Manual Feedback Loop
**After:** 004, 015
**Verify:** Full E2E flow from Manual UI to DB to Paperless.

### Checkpoint 3: Visual Search Pipeline
**After:** 006, 007, 014
**Verify:** Sidecar integration, API contracts, Circuit Breaker.

### Checkpoint 4: History Route & Islands
**After:** 008, 009, 012, 010
**Verify:** Split layout, Islands architecture, Red Pen interaction.

### Checkpoint 5: Qdrant Migration
**After:** 018
**Verify:**
- Qdrant container running and healthy
- Collections created with correct dimensions
- QdrantAdapter (JS and Python) passing tests
- Re-ingestion completed successfully
- Search functionality working with Qdrant backend

## Rollback Procedures
See individual prompts for specific rollback steps. Generally:
- **DB:** Run rollback migrations.
- **Code:** Revert git commits.
- **Services:** Restart services.
- **Qdrant Migration:** If rollback needed, switch `VECTOR_STORE=pgvector` and restore pgVector tables from backup.