# Audit Scope Clarification

## Purpose
This document clarifies the correct interpretation of the prompt sequence for audit purposes, resolving the mismatch identified in the comprehensive audit report.

## Corrected Prompt Sequence Understanding

### Implementation Prompts (001-007)
All prompts in the active sequence are **implementation prompts** with inline verification:

| Prompt | Type | Verification Method |
|--------|------|---------------------|
| 001 | Implementation | Inline `<verification>` section |
| 002 | Implementation | Inline `<verification>` section |
| 003 | Implementation | Inline `<verification>` section |
| 004 | Implementation | Inline `<verification>` section |
| 005 | Implementation | Inline `<verification>` section |
| 006 | Implementation | Inline `<verification>` section |
| 007 | Implementation | Inline `<verification>` section |

### Verification Strategy
- **Primary:** Inline verification within each implementation prompt
- **Secondary:** Summary documents confirm verification results
- **Tertiary:** Integration checkpoints in `EXECUTION_ORDER.md`

### No Separate Verification Prompts
The prompt sequence does **NOT** include separate verification prompt files by default; however, in cases where dedicated verification is warranted, standalone verification prompts may be introduced. Current standalone verification prompts:
- `006-verify-existing-logic.md` (standalone verification for the visual search API)
- `007-final-integration-test.md` (standalone final integration verification for history split layout + visual search)

## Audit Compliance Checklist

### For Each Implementation Prompt
- [ ] Follows structure defined in `prompts/README.md`
- [ ] Includes `<objective>` section
- [ ] Includes `<context>` section with references
- [ ] Includes `<requirements>` section with numbered list
- [ ] Includes `<implementation>` section with guidelines
- [ ] Includes `<output>` section with file paths
- [ ] Includes `<verification>` section with actionable steps
- [ ] Includes `<lifecycle>` section with summary/archival steps

### For Prompt Sequence
- [ ] Dependencies documented in `EXECUTION_ORDER.md`
- [ ] Parallel execution opportunities identified
- [ ] Integration checkpoints defined
- [ ] Rollback procedures documented

### For Verification
- [ ] Inline verification steps are concrete and actionable
- [ ] Test commands provided where applicable
- [ ] Expected outcomes clearly stated
- [ ] Manual verification steps for UI changes included

## Architectural Compliance

### Documentation References
Each prompt must reference relevant authoritative documentation:
- `docs/FEEDBACK_PERSISTENCE_STRATEGY.md` (for feedback-related prompts)
- `docs/FRONTEND_ARCHITECTURE.md` (for UI-related prompts)
- `docs/VISUAL_RAG_INTEGRATION.md` (for Visual RAG prompts)
- `docs/OBSERVABILITY_AND_TELEMETRY.md` (for telemetry requirements)

### Pattern Compliance
Prompts must follow established patterns:
- Database: PostgreSQL with pgvector, UUID primary keys
- Frontend: Preact Islands for complex components (per FRONTEND_ARCHITECTURE.md)
- API: RESTful endpoints with proper validation
- Testing: Mocha + Node assert, integration tests where applicable

## Future Audit Recommendations

### Pre-Audit Steps
1. Read `prompts/README.md` for current structure
2. Review `prompts/EXECUTION_ORDER.md` for dependencies
3. Check `prompts/AUDIT_RESOLUTION.md` for historical context
4. Verify inline verification pattern is maintained

### Audit Focus Areas
1. **Structure Compliance:** Verify all prompts follow template
2. **Dependency Accuracy:** Confirm EXECUTION_ORDER.md is current
3. **Verification Completeness:** Check inline verification steps are actionable
4. **Documentation References:** Ensure authoritative docs are referenced
5. **Pattern Consistency:** Verify architectural patterns are followed

### Red Flags
- Prompts missing `<verification>` section
- Dependencies not documented in EXECUTION_ORDER.md
- References to non-existent documentation
- Deviations from established patterns without justification
- Missing summary generation in `<lifecycle>` section

## References
- Prompt Structure: `prompts/README.md`
- Execution Order: `prompts/EXECUTION_ORDER.md`
- Audit Resolution: `prompts/AUDIT_RESOLUTION.md`
- Template: `prompts/PROMPT_TEMPLATE.md`
