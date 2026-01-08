# Implementation Prompts Directory

## Purpose
This directory contains structured implementation and verification prompts for AI agents executing feature development tasks.

## Directory Structure
- `001-017`: Active prompts (numbered sequence)
- `planning/`: Enhancement plans and architectural documents
- `completed/`: Archived prompts after successful execution
- `summaries/`: Machine-readable summaries generated after prompt completion

## Current Prompt Sequence

### Active Prompts (001-017)
See `EXECUTION_ORDER.md` for detailed sequencing and dependencies.

**Phase 1: Backend Foundation**
- `001-implement-feedback-persistence.md`
- `011-verification-db-schema.md`
- `002-enhance-paperless-integration.md`
- `013-verification-telemetry.md`

**Phase 2: Manual Route UI**
- `003-implement-visual-annotation-ui.md` ✅ (completed — see `prompts/summaries/003-summary.md`)
- `004-implement-manual-feedback-ui.md` ✅ (completed — see `prompts/summaries/004-summary.md`)
- `015-integration-feedback-e2e.md` ✅ (completed — see `prompts/summaries/015-feedback-e2e-summary.md`)

**Phase 3: History Route Enhancement**
- `005-upgrade-visual-sidecar.md` ✅ (completed — see `prompts/summaries/005-upgrade-visual-sidecar-summary.md`)
- `006-expose-visual-search-api.md` ✅ (completed — see `prompts/summaries/006-expose-visual-search-api-summary.md`)
- `007-verify-visual-search-api.md` 🔄 (in-progress)
- `014-verification-circuit-breaker.md`
- `008-implement-history-split-layout.md`
- `012-verification-frontend-islands.md`
- `009-implement-visual-red-pen.md`
- `010-final-integration-test.md`

**Phase 4: Final Verification & Cleanup**
- `016-verification-checklist.md`
- `017-refactor-playground.md`

## Prompt Naming Convention
Format: `NNN-brief-description.md`
- NNN: Three-digit sequence number
- brief-description: Kebab-case summary

## Prompt Structure (Standard Format)
All implementation prompts follow this XML-like structure:
- `<objective>`
- `<context>`
- `<requirements>`
- `<implementation>`
- `<output>`
- `<verification>`
- `<lifecycle>`

## Verification Strategy
- **Inline Verification:** Most implementation prompts include a `<verification>` section.
- **Standalone Verification:** Specific prompts (e.g., `007`, `010-016`) are dedicated to verification and testing of complex subsystems or integration flows.
- **Checklist:** Prompt `016` provides a consolidated checklist for all verification gates.

## Lifecycle Management
1. **Pre-execution:** Review prompt and `EXECUTION_ORDER.md`.
2. **Implementation/Verification:** Execute the prompt.
3. **Summary:** Generate a summary with a .md fileending`summaries/`.
4. **Archival:** Move to `completed/` upon success.

## References
- `EXECUTION_ORDER.md`: Authoritative dependency graph.
- `docs/`: Project documentation.