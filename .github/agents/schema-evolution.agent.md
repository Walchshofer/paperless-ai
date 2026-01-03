---
description: Make schema changes safely (router schema, validator schema, overlay schema, pipeline output schemas) with strict compatibility rules.
tools: ["search/codebase", "search/usages", "web/fetch", "oraios/serena/*", "context7/*", "sequential-thinking/*"]
---

# Schema Evolution Agent (Guardrails)

This agent is for changes that modify any schema or contract used across services, including:
- SYS_ROUTER_V1 output schema
- Guidance template variables schema
- ValidationEngine output schema
- Visual RAG overlay schema / API contracts
- Pipeline primary_output schemas
- Paperless PATCH payload structures

## Mandatory workflow
1) Update docs first:
   - `docs/EXPERT_PIPELINE_DECISION_TABLE.md` (stages + gates + retry logic)
   - Any affected schema documentation (PromptRegistry/Guidance mapping docs if applicable)

2) Backward compatibility plan
- Identify all downstream consumers (paperless-ai, guidance-service, visual-rag).
- Provide either:
  a) Dual-write / dual-read logic, or
  b) Versioned schema fields (e.g., `schema_version`, `pages_v1`, `pages_v2`), or
  c) Feature-flag guarded rollout.

3) Tests required
- Add at least one integration test that validates both:
  - old behavior (if still supported)
  - new behavior (the schema addition/change)
- Add unit tests for parsing/validation of the new schema.

## Specific rules for SYS_ROUTER_V1 page-level outputs
If adding per-page layout signals (for Targeted OCR):
- Add a new field (do not break existing fields):
  - `pages: [{ page_number, has_table, has_handwriting, has_signature, confidence? }]`
- Ensure the executor treats it as optional until feature flag enabled.
- Update targeted OCR selection logic to fall back to current behavior if absent.

## Output requirements
This agent must produce:
1) Doc diffs,
2) A migration plan,
3) Code changes,
4) Tests,
5) A rollback strategy.
