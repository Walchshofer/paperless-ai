# Prompt Template

Use this template when creating new implementation prompts. Replace all placeholder text in [brackets].

---

<objective>
[Clear, concise statement of what this prompt accomplishes]
[Reference to the enhancement plan phase or architectural decision]
</objective>

<context>
[Background information about the current state]
[Why this change is needed]
[References to related documentation:]
- @paperless-ai/docs/[RELEVANT_DOC].md
- @paperless-ai/prompts/planning/[PLAN].md
[References to previous prompts if this is part of a sequence:]
- Previous: @paperless-ai/prompts/[NNN]-[previous-prompt].md
- Summary: @paperless-ai/prompts/summaries/[NNN]-[previous-prompt]-summary.md
</context>

<requirements>
1. **[Requirement Category 1]**:
   - [Specific requirement detail]
   - [File to modify: @paperless-ai/path/to/file.js]
   - [Expected behavior]

2. **[Requirement Category 2]**:
   - [Specific requirement detail]
   - [Technical constraints]
   - [Integration points]

3. **[Testing Requirements]**:
   - [Test file to create]
   - [Test scenarios to cover]
   - [Expected test outcomes]
</requirements>

<implementation>
- [Implementation guideline 1]
- [Pattern to follow: reference existing code]
- [Constraints to respect]
- [Error handling strategy]
</implementation>

<output>
- `./paperless-ai/[path]/[file1]` (Created/Modified)
- `./paperless-ai/[path]/[file2]` (Created/Modified)
- `./paperless-ai/test/[test-file].test.js` (Created)
</output>

<verification>
- [Manual verification step 1]
- [Test command: npm test [test-file]]
- [Expected outcome 1]
- [Expected outcome 2]
- [Browser/UI verification steps if applicable]
</verification>

<lifecycle>
1. Upon completion, generate summary: `./paperless-ai/prompts/summaries/[NNN]-[brief-description]-summary.md`
2. Move this prompt to `./paperless-ai/prompts/completed/`
3. [Optional: Update related documentation]
</lifecycle>

---

## Template Usage Notes

### Numbering
- Use next available three-digit number (e.g., 008, 009, etc.)
- Check `prompts/EXECUTION_ORDER.md` for current sequence

### File Naming
- Format: `NNN-brief-description.md`
- Use kebab-case for description
- Keep description concise (3-5 words)

### Context Section
- Always reference authoritative documentation
- Link to previous prompts if part of a sequence
- Explain current state and why change is needed

### Requirements Section
- Use numbered list with bold category headers
- Be specific about files to modify
- Include technical constraints and integration points

### Verification Section
- Provide concrete, actionable verification steps
- Include test commands with expected output
- Add manual verification steps for UI changes

### Lifecycle Section
- Always include summary generation step
- Always include archival step
- Add documentation update steps if needed

## Example Prompt Names
- `008-implement-bias-engine-integration.md`
- `009-add-telemetry-hooks.md`
- `010-migrate-to-preact-islands.md`
