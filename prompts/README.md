# Implementation Prompts Directory

## 🛑 BREAKING CHANGE: Native Protocol Alpha-9
As of 2026-01, the system has migrated to a **Hybrid SOT** (PostgreSQL + Qdrant). All prompts have been updated to support the **RTX 3090 Ti** hardware profile and **ColQwen3-4B-AWQ** models.

---

## Current Status Tracker

### Phase 5: Qdrant Migration
- `018-qdrant-migration.md` 🔄 (In-Progress)

### Phase 1: Backend Foundation
- `001-implement-feedback-persistence.md` 🔄 (Pending Alpha-9 Detox)
- `011-verification-db-schema.md` 🔄 (Pending Alpha-9 Detox)
- `002-enhance-paperless-integration.md` 🔄 (Pending Alpha-9 Detox)
- `013-verification-telemetry.md` 🔄 (Pending Alpha-9 Detox)

### Phase 2: Manual Route UI
- `003-implement-visual-annotation-ui.md` 🔄 (**RE-OPENED** for Alpha-9 Detox)
- `004-implement-manual-feedback-ui.md` 🔄 (**RE-OPENED** for Alpha-9 Detox)
- `015-integration-feedback-e2e.md` 🔄 (**RE-OPENED** for Alpha-9 Detox)

### Phase 3: History Route Enhancement
- `005-upgrade-visual-sidecar.md` 🔄 (**RE-OPENED** for Alpha-9 Detox)
- `006-expose-visual-search-api.md` 🔄 (**RE-OPENED** for Alpha-9 Detox)
- `007-verify-visual-search-api.md` 🔄 (In-Progress)
- `014-verification-circuit-breaker.md` 🔄 (Pending)
- `008-implement-history-split-layout.md` 🔄 (Pending)
- `009-implement-visual-red-pen.md` 🔄 (Pending)

### Phase 4: Final Verification
- `016-verification-checklist.md` 🔄 (Pending)
- `017-refactor-playground.md` 🔄 (Pending)

---

## Verification Strategy
- **Inline Verification:** Every implementation prompt contains a `<verification>` section for immediate testing.
- **Standalone Verification:** Prompts 007, 010-016 are dedicated to hardware stress, circuit breaking, and E2E validation.
- **Master Checklist:** Prompt 016 serves as the final production-readiness gate.

---

## Prompt Structure
All prompts follow the standard format:
- `<objective>`: Clear goal.
- `<context>`: Hardware and SOT background.
- `<requirements>`: Technical specifications.
- `<implementation>`: Pattern and "Detox" guidelines.
- `<output>`: Expected file artifacts.
- `<verification>`: Actionable test steps.
- `<lifecycle>`: Archival and summary instructions.
