# V2 Visual-First RAG Gap Audit

Scope: This report compares the V2 Visual-first RAG blueprint against current
documentation. It documents gaps only; it does not change runtime behavior.

Sources checked (authoritative order):
- docs/EXPERT_PIPELINE_DECISION_TABLE.md
- docs/PIPELINE_STAGE_CONTRACTS.md
- docs/VALIDATION_AND_RETRY_POLICY.md
- docs/SCHEMA_EVOLUTION_GUIDE.md
- docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md
- docs/PROMPT_CHANGE_GUIDE.md

Additional docs checked:
- docs/RAG_SYSTEMS_REFERENCE.md
- docs/VISUAL_RAG_INTEGRATION.md
- docs/EXPERT_PIPELINE_FLOW.md
- docs/OBSERVABILITY_AND_TELEMETRY.md
- services/visual-rag-sidecar/README.md

## Gap Matrix

| Blueprint requirement | Current doc coverage | Gap / conflict | Doc update needed | Status |
| --- | --- | --- | --- | --- |
| Visual-first retrieval as default (visual retriever primary, text fallback) | Retrieval routing and diagrams now documented in `docs/EXPERT_PIPELINE_DECISION_TABLE.md`, `docs/EXPERT_PIPELINE_FLOW.md`, and `docs/VISUAL_RAG_INTEGRATION.md`. | None. | None. | Resolved |
| Ingestion pipeline includes deterministic normalization + asset derivation + per-page/region visual embeddings | Asset derivation and normalization metadata are documented in `docs/EXPERT_PIPELINE_DECISION_TABLE.md`; V2 visual storage is documented in `docs/RAG_SYSTEMS_REFERENCE.md`. | None. | None. | Resolved |
| Context Pack contract for Guidance and VLM routing (document identity, priors, evidence bundle, normalization metadata, policy constraints, prefs, system state) | Context Pack requirements are documented in `docs/EXPERT_PIPELINE_DECISION_TABLE.md`, `docs/PIPELINE_STAGE_CONTRACTS.md`, and `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`. | None. | None. | Resolved |
| Guidance contracts for classification + tagging, field extraction, storage plan (separate outputs) | Guidance output contracts are documented in `docs/EXPERT_PIPELINE_DECISION_TABLE.md` and `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`. | None. | None. | Resolved |
| Autonomous filing policy engine + action orchestrator + audit log | Action orchestration and audit logging are documented in `docs/EXPERT_PIPELINE_FLOW.md`, `docs/EXPERT_PIPELINE_DECISION_TABLE.md`, and `docs/OBSERVABILITY_AND_TELEMETRY.md`. | None. | None. | Resolved |
| Postgres + pgvector schema for documents/pages/chunks/visual embeddings/actions | V2 storage schema is documented in `docs/RAG_SYSTEMS_REFERENCE.md` and vector defaults are in `docs/DATABASE_SETUP.md`. | None. | None. | Resolved |
| Vector column requirements per service are inconsistent | Per-service vector columns are documented in `docs/RAG_SYSTEMS_REFERENCE.md` and `docs/DATABASE_SETUP.md` (visual_overlays `vector(320)`, document_embeddings `vector(384)`). | Tests/scripts still reference 768 dimensions. | Update tests/scripts and any remaining references to 768 dims. | Resolved (tests updated to 320/384) |
| Retrieval queries for visual-first and hybrid fallback | Query patterns are documented in `docs/RAG_SYSTEMS_REFERENCE.md`. | None. | None. | Resolved |
| Evidence refs required across tagging/extraction/storage outputs; page/region locality | Evidence refs are required in `docs/PIPELINE_STAGE_CONTRACTS.md` and `docs/EXPERT_PIPELINE_DECISION_TABLE.md`. | None. | None. | Resolved |
| Prompt and template guardrails banning invented geometry | Geometry provenance guardrails are documented in `docs/PROMPT_CHANGE_GUIDE.md` and `docs/PIPELINE_STAGE_CONTRACTS.md`. | None. | None. | Resolved |
| RAGZ is pgvector-only; Chroma removed | Chroma references removed from `docs/RAG_SYSTEMS_REFERENCE.md`. | None. | None. | Resolved |
| Visual RAG sidecar build now requires CUDA 12.4 + flash-attn>=2.4.0 | Build requirements are documented in `services/visual-rag-sidecar/README.md` and `docs/VISUAL_RAG_INTEGRATION.md`. | None. | None. | Resolved |
| ColQwen3-only enforcement + breaking-change startup warnings | ColQwen3-only enforcement and startup warnings are documented in `services/visual-rag-sidecar/README.md` and `docs/VISUAL_RAG_INTEGRATION.md`. | None. | None. | Resolved |
| RAGZ health check validates pgvector table | `/health` semantics are documented in `docs/RAG_SYSTEMS_REFERENCE.md`. | Service currently exposes `/check_health` (code alignment pending). | Align code or add `/health` alias. | Resolved (added `/health` alias) |
| RAG pipeline separation is unclear | Service separation and vector ownership are documented in `docs/RAG_SYSTEMS_REFERENCE.md`. | None. | None. | Resolved |

## Guidance Expert Addendum

Reference consulted:
- guidance-expert/references/guidance-functions.md

Guidance-specific gaps (additive to the matrix above):

| Gap | Evidence | Doc update needed | Status |
| --- | --- | --- | --- |
| Guidance templates lack mandatory temperature guidance for classification/extraction | Guidance usage in docs does not mandate temperature=0.0 for deterministic classification or extraction | Add a "temperature=0.0 for classification/extraction" rule to `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` and stage contracts. | Resolved in `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` and `docs/PIPELINE_STAGE_CONTRACTS.md`. |
| Fixed-option fields do not require `select()` or strict regex constraints | No doc guidance to use `select()` for enum-like fields (doc_type, actions, severity) | Add template authoring rule: use `select()` for fixed-option classification; use `regex()` for identifiers (e.g., UUID, invoice numbers). | Resolved in `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` and `docs/PROMPT_CHANGE_GUIDE.md`. |
| Guidance output schema does not require `guidance_json` with explicit schema | No documented requirement for schema-driven JSON generation | Add a guidance template contract: use `guidance_json(schema=..., name="output")` for structured outputs. | Resolved in `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` and `docs/PROMPT_CHANGE_GUIDE.md`. |
| Guidance immutability pattern is undocumented | Docs do not mention capturing returned LM state | Add a developer note: capture returned LM state (`lm = model + template(...)`) and avoid in-place mutation assumptions. | Resolved in `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` and `docs/PROMPT_CHANGE_GUIDE.md`. |
| Tool-based extraction patterns are not specified | No examples for `Tool.from_callable` or `Tool.from_regex` in template guidance | Add a small tooling section and error handling pattern for tool-based extraction. | Resolved in `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` and `docs/PROMPT_CHANGE_GUIDE.md`. |

## Paperless-ngx API Addendum (code-paperless-ngx-api)

Reference consulted:
- code-paperless-ngx-api/references/paperless-ngx-api.md

Paperless API-specific gaps (additive to the matrix above):

| Gap | Evidence | Doc update needed | Status |
| --- | --- | --- | --- |
| Action orchestration lacks explicit Paperless API endpoints and ID resolution rules | Paperless updates require integer IDs for tags, correspondents, document types, and storage paths; updates are PATCH `/api/documents/{id}/` or bulk via `/api/documents/bulk_edit/` | Resolved in `docs/EXPERT_PIPELINE_FLOW.md` (Paperless API contract section). | Resolved |
| API versioning and headers are undocumented for autonomous operations | Paperless expects `Accept: application/json; version=<server_version>` and `Authorization: Token <token>` | Resolved in `docs/EXPERT_PIPELINE_FLOW.md` (Paperless API contract section). | Resolved |
| Custom field writes lack schema/typing guidance | `custom_fields` values are sent on PATCH and bulk (`modify_custom_fields`), but require schema-aligned keys | Resolved in `docs/EXPERT_PIPELINE_FLOW.md` (custom field payload shape + taxonomy fetch). | Resolved |
| Async task handling for uploads/reprocess is not documented | Uploads return `task_id` and reprocess is a bulk operation | Resolved in `docs/EXPERT_PIPELINE_FLOW.md` (tasks tracking guidance). | Resolved |

## Recent Updates

- Documented Tomoro ColQwen3 model settings (context window 32k, token budget, multi-vector output, FlashAttention 2) in `docs/model/tomoro-colqwen3.md`.
- Documented RAG service separation and per-service vector columns in `docs/RAG_SYSTEMS_REFERENCE.md` and `docs/DATABASE_SETUP.md` (visual_overlays vector(320), document_embeddings vector(384)).
- Documented visual summary metadata retention in `docs/RAG_SYSTEMS_REFERENCE.md` (summary stored in expert_metadata; boxes can follow).
- Deprecated and removed legacy `docs/architecture/postgresql-hybrid-rag.md`.
- Updated `docs/VISUAL_RAG_INTEGRATION.md` with visual-first retrieval routing, ColQwen3-only configuration, and build requirements.
- Updated `services/visual-rag-sidecar/README.md` for CUDA 12.4 and flash-attn>=2.4.0 requirements plus ColQwen3-only enforcement.
- Documented Paperless custom field payload shape in `docs/EXPERT_PIPELINE_FLOW.md`.
- Added Schema Evolution Agent guidance on vector fixture migration and `/health` alias strategy.
- Added Pipeline Orchestration guidance on visual-first routing, Context Pack enforcement, retry budgets, Guidance symmetry, and health gating.
- Updated vector integration tests/fixtures to 320 (visual overlays) and 384 (text embeddings); added `/health` alias to RAGZ for pgvector readiness checks.

## Doc Update Targets (ordered)

1. docs/EXPERT_PIPELINE_DECISION_TABLE.md (updated)
2. docs/PIPELINE_STAGE_CONTRACTS.md (updated)
3. docs/SCHEMA_EVOLUTION_GUIDE.md (no change required)
4. docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md (updated)
5. docs/PROMPT_CHANGE_GUIDE.md (updated)
6. docs/OBSERVABILITY_AND_TELEMETRY.md (updated)
7. docs/RAG_SYSTEMS_REFERENCE.md (updated)
8. docs/VISUAL_RAG_INTEGRATION.md (updated)
9. docs/DATABASE_SETUP.md (updated)
10. services/visual-rag-sidecar/README.md (updated)

## Open Questions

- (Resolved) V2 is the new default retrieval/answering path (replaces stage 8 “enrichment-only” semantics); keep a brief compatibility note for older flows.
- (Resolved) `document_actions` share the same Postgres instance as visual overlays/vectors; isolate only if governance demands it.
- (Resolved) Evidence refs are validated at stage boundaries and hard-required at orchestration/persistence to prevent unevidenced actions.

## Schema Evolution Agent Contribution

- Vector dimensions: Tests and fixtures previously asserting `vector(768)` are now aligned to service dimensions (`visual_overlays.embedding vector(320)`, `document_embeddings.embedding vector(384)`). Rollback: keep archived migrations/fixtures for reference only; do not re-run them.
- Health endpoint alignment: Added a lightweight `/health` alias delegating to `/check_health` in RAGZ to satisfy the documented contract. Rollback is a route removal.

## Pipeline Orchestration Expert Contribution

- Visual-first routing: Orchestrator must set `use_visual_rag_retrieval=true` by default and keep `use_visual_rag_ingestion` independent (ingestion may be skipped while retrieval remains on). If circuit breaker is OPEN, retrieval falls back to text-only with no retries beyond document scope.
- Context Pack enforcement: All LLM stages (extraction, reasoning, action plan) must consume the Context Pack only; raw OCR dumps are forbidden. Orchestrator should fail closed if Context Pack is missing required evidence snippets.
- Retry budget: Keep document-scoped retries bounded (≤2) and log `retry_reason` + `retry_scope=document` for visual retrieval failures; do not introduce per-page retries.
- Guidance fallback symmetry: When Guidance is disabled or unavailable, PromptRegistry must receive the same `promptId` and inputs; no alternate heuristics are permitted for visual-first routing.
- Health gating: Pipeline readiness checks must block retrieval until pgvector health passes (visual + text). If health fails mid-run, degrade to extraction-only and emit telemetry `visual_retrieval_skipped=health_check_failed`.

## Docs Agent Final Review (this section)

- Confirmed documentation alignment: visual-first retrieval routing, Context Pack requirements, evidence refs, geometry provenance, and ColQwen3-only build requirements are now present in the authoritative docs (`EXPERT_PIPELINE_DECISION_TABLE.md`, `PIPELINE_STAGE_CONTRACTS.md`, `PROMPT_CHANGE_GUIDE.md`, `PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`, `VISUAL_RAG_INTEGRATION.md`, `RAG_SYSTEMS_REFERENCE.md`, `OBSERVABILITY_AND_TELEMETRY.md`).
- Remaining documentation gaps are resolved in code: `/health` alias added and test fixtures moved to 320/384 dimensions.
- No additional doc inconsistencies found across the authoritative set.
