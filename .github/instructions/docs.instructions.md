---
applyTo: "docs/**/*.md"
description: Documentation standards for project documentation
---

# Documentation Standards

## Authoritative Documents
The following files are the source of truth. Code MUST align with these:

1. `docs/EXPERT_PIPELINE_DECISION_TABLE.md` - Pipeline gates, retries, contracts
2. `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` - PromptRegistry authority
3. `docs/PIPELINE_STAGE_CONTRACTS.md` - Stage responsibilities
4. `docs/VALIDATION_AND_RETRY_POLICY.md` - Retry logic
5. `docs/SCHEMA_EVOLUTION_GUIDE.md` - Schema changes
6. `docs/ARCHITECTURE_OVERVIEW.md` - System architecture
7. `docs/OBSERVABILITY_AND_TELEMETRY.md` - Logging standards
8. `docs/ENVIRONMENT_VARIABLES.md` - Configuration
9. `docs/QDRANT_MIGRATION.md` - Qdrant collection definitions, SOT, and re-ingestion guidance (VECTOR STORE Tier-0 doc)

## Doc-First Rule
- Documentation changes come **before** code changes
- If implementation affects runtime behavior, update docs first
- Changes affecting vector storage (Qdrant) or re-ingestion MUST update `docs/QDRANT_MIGRATION.md` and include an automated re-ingestion e2e test as part of the PR (see `test/e2e/reingest-verify.spec.js` example)

## Markdown Guidelines

### Structure
- Use headings to organize content (H1 for title, H2 for sections)
- Use bullet points for lists
- Include code blocks with language specifiers
- Use tables for structured data

### Diagrams
- Use Mermaid for flow diagrams where helpful
- Keep diagrams simple and focused

### Code Examples
```javascript
// Always include language identifier
const example = true;
```

### Links
- Use relative links for internal docs
- Verify links are valid before committing

## Writing Style
- Use present tense (is, does) instead of past tense
- Write factual statements and direct commands
- Use active voice
- Write in second person (you) for instructions
- Be concise but complete

## Archived Content
- Files under `docs/archive/` are non-authoritative
- Do not reference archived files as current guidance

## JSDoc/Swagger Standards
For API documentation, follow `docs/jsdoc_standards.md`:
- Every route must have `@swagger` documentation
- Include summary, description, tags, parameters, responses
- Use OpenAPI 3.0.0 specification
