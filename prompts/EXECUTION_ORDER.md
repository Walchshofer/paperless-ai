# Prompt Execution Order and Dependencies

## Overview
This document defines the authoritative execution order for implementation and verification prompts 001-018. Under the **Native Protocol Alpha-9**, Phase 5 (Qdrant Migration) is the mandatory root for all subsequent development.

**Policy:** All agents must read `docs/AGENT_READ_POLICY.md` before executing any prompt.

## Dependency Graph



```mermaid
graph TD
    %% Phase 5: Qdrant Migration (The Alpha-9 Root)
    018[018: Qdrant Migration] --> 001
    018 --> 005
    018 --> 011

    %% Phase 1: Backend Foundation
    001[001: Feedback Persistence] --> 002[002: Paperless Integration]
    001 --> 011[011: Verify DB Schema]
    002 --> 013[013: Verify Telemetry]

    %% Phase 2: Manual Route UI (Hybrid SOT)
    002 --> 003[003: Visual Annotation UI]
    002 --> 004[004: Manual Feedback UI]
    003 --> 004
    004 --> 015[015: Feedback E2E Test]

    %% Phase 3: History Route Enhancement (MaxSim)
    005[005: Visual Sidecar] --> 006[006: Visual Search API]
    006 --> 007[007: Verify Visual Search API]
    006 --> 014[014: Verify Circuit Breaker]
    007 --> 008[008: History Split Layout]
    008 --> 009[009: Visual Red Pen]
    008 --> 012[012: Verify Frontend Islands]
    009 --> 010[010: Final Integration Test]

    %% Phase 4: Final Verification
    011 & 012 & 013 & 014 & 015 & 010 --> 016[016: Verification Checklist]
    016 --> 017[017: Refactor Playground]

```

## Execution Phases

### Phase 5: Qdrant Migration (BREAKING CHANGE)

**Prompt:** 018

* Establishes the **Hybrid SOT** architecture.
* Implements 320D/384D collections with **Distance Metric Locks** (Dot Product for MaxSim).

### Phase 1: Backend Foundation

**Prompts:** 001, 011, 002, 013

* Implements the RLHF feedback persistence and Paperless-ngx metadata sync.
* Verifies the **"Detoxed"** PostgreSQL schema (0 vector columns).

### Phase 2: Manual Route UI

**Prompts:** 003, 004, 015

* Implements Preact Islands for visual annotations and metadata editing.
* Validates the **Payload Mirroring** from UI to Qdrant.

### Phase 3: History Route Enhancement

**Prompts:** 005, 006, 007, 014, 008, 012, 009, 010

* Upgrades the Python Sidecar to **ColQwen3-4B-AWQ** for the RTX 3090 Ti.
* Implements the **503 Initializing** handshake and Red Pen visual search.

### Phase 4: Final Verification

**Prompts:** 016, 017

* Consolidated CI/CD gating and Playground refactor.