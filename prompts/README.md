# Implementation Prompts Directory

## Purpose
This directory contains structured implementation prompts for AI agents executing feature development tasks. Each prompt follows a standardized format to ensure consistency, traceability, and verification.

## Directory Structure
- `001-008`: Active implementation prompts (numbered sequence)
- `planning/`: Enhancement plans and architectural documents
- `completed/`: Archived prompts after successful execution
- `summaries/`: Machine-readable summaries generated after prompt completion

## Prompt Naming Convention
Format: `NNN-brief-description.md`
- NNN: Three-digit sequence number (001, 002, etc.)
- brief-description: Kebab-case summary of the prompt's objective

## Prompt Structure (Standard Format)
All implementation prompts follow this XML-like structure:

<objective>
  Clear, concise statement of what this prompt accomplishes
  Reference to the enhancement plan phase
</objective>

<context>
  Background information, current state, and references to related documentation
  Links to planning documents and previous prompts
</context>

<requirements>
  Numbered list of specific implementation requirements
  Technical specifications and constraints
</requirements>

<implementation>
  Implementation guidelines and patterns to follow
  References to existing code patterns
</implementation>

<output>
  List of files to be created or modified
  Use relative paths from project root
</output>

<verification>
  Manual verification steps to confirm implementation success
  Test commands and expected outcomes
</verification>

<lifecycle>
  Post-completion actions (summary generation, archival)
</lifecycle>

## Current Prompt Sequence

### Active Prompts (001-008)
See `EXECUTION_ORDER.md` for detailed sequencing and dependencies.

**Manual Route UI Enhancement (Prompts 001-004):**
- 001: Implement feedback persistence (PostgreSQL + pgvector)
- 002: Enhance Paperless integration (custom fields + orchestration)
- 003: Implement visual annotation UI (Red Pen drawing tool)
- 004: Implement manual feedback UI (unified editor + save logic)

**History Route Visual Enhancement (Prompts 005-008):**
- 005: Upgrade visual sidecar (image-based search capability)
- 006: Expose visual search API (Node.js gateway + client)
- 007: Implement history split layout (split-screen UI preparation)
- 008: Implement visual Red Pen (draw-to-search interaction)

## Verification Strategy
Most prompts include an inline `<verification>` section with manual verification steps. Additionally, standalone verification prompt files exist for certain implementation prompts (e.g., `006-verify-existing-logic.md` and `007-final-integration-test.md`) when dedicated verification is required. Verification is performed:
1. **During implementation:** Developer follows inline verification steps (or runs standalone verification prompts where applicable)
2. **After completion:** Summary document confirms verification results
3. **Before archival:** Prompt is moved to `completed/` only after successful verification

## Lifecycle Management

### Prompt Execution Flow
1. **Pre-execution:** Review prompt requirements and context
2. **Implementation:** Follow requirements and implementation guidelines
3. **Verification:** Execute inline verification steps
4. **Summary Generation:** Create machine-readable summary in `summaries/`
5. **Archival:** Move completed prompt to `completed/`

### Summary Document Format
Location: `prompts/summaries/NNN-brief-description-summary.md`
Content: Machine-readable summary of changes, verification results, and next steps

## Dependencies and Sequencing
See `EXECUTION_ORDER.md` for:
- Detailed dependency graph
- Parallel vs sequential execution guidance
- Integration checkpoints
- Rollback procedures

## References
- Enhancement Plans: `planning/MANUAL-ROUTE-UI-ENHANCEMENT-PLAN.md`, `planning/HISTORY-ROUTE-ENHANCEMENT-PLAN.md`
- Architecture: `docs/FRONTEND_ARCHITECTURE.md`, `docs/FEEDBACK_PERSISTENCE_STRATEGY.md`
- Execution Order: `EXECUTION_ORDER.md` (this directory)
