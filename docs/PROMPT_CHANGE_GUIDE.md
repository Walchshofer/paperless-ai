# Prompt Change Guide

Prompts in paperless-ai are **production code**.

This document defines the rules and responsibilities for modifying any prompt
in the PromptRegistry or Guidance templates.

Failure to follow this guide may result in silent data corruption.

---

## Scope

This guide applies to changes in:

- PromptRegistry prompts (`services/prompts`)
- Guidance templates (Python service)
- Prompt schemas and expected outputs
- Prompt variables and constraints

---

## Core Rules

1. PromptRegistry is authoritative
2. Prompt semantics must remain compatible
3. Output schemas must not break consumers
4. All prompt changes require tests
5. Rollback must always be possible

---

## Allowed Prompt Changes

- Improving extraction accuracy
- Clarifying instructions
- Improving reasoning robustness
- Adding optional fields (schema evolution rules apply)

---

## Forbidden Prompt Changes

- Removing required fields
- Changing field meaning without schema versioning
- Introducing undocumented output formats
- Creating prompt-only behavior changes

---

## Required Process for Prompt Changes

Every prompt change MUST include:

1. **Intent Description**
   - What problem is being solved
   - Why a prompt change is required

2. **Schema Impact Analysis**
   - Confirm no breaking schema change
   - Reference `SCHEMA_EVOLUTION_GUIDE.md` if applicable

3. **Tests**
   - At least one positive test
   - At least one regression guard
   - Mocked LLM responses where applicable

4. **Fallback Verification**
   - Ensure PromptRegistry fallback still works
   - Ensure JsonRepair still produces valid output

---

## Guidance-Specific Rules

- Guidance templates may evolve independently
- PromptRegistry fallback MUST remain compatible
- V2 Guidance templates must degrade gracefully to V1
- Executor must not assume Guidance availability

---

## Review Checklist (Non-Negotiable)

Before merging a prompt change:

- [ ] Tests updated or added
- [ ] No schema regressions
- [ ] Fallback path verified
- [ ] Decision Table still holds
- [ ] Telemetry unaffected

---

## Non-Negotiable Guarantees

- Prompts are versioned implicitly by behavior
- Prompt changes are audited
- Silent prompt regressions are forbidden
