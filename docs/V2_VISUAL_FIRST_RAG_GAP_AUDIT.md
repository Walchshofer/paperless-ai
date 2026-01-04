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
- services/visual-rag-sidecar/README.md

## Gap Matrix

| Blueprint requirement | Current doc coverage | Gap / conflict | Doc update needed |
| --- | --- | --- | --- |
| Visual-first retrieval as default (visual retriever primary, text fallback) | Visual RAG is stage 8 enrichment and optional, post-extraction; Visual RAG ingestion is conditional (docs/EXPERT_PIPELINE_DECISION_TABLE.md:252, docs/EXPERT_PIPELINE_FLOW.md:61, docs/VISUAL_RAG_INTEGRATION.md:47) | Docs describe Visual RAG as optional enhancement, not default retrieval. No retrieval pipeline diagram. | Add v2 retrieval pipeline (visual default, text fallback) to decision table and flow docs; update Visual RAG integration to include retrieval routing. |
| Ingestion pipeline includes deterministic normalization + asset derivation + per-page/region visual embeddings | Stage 3 covers normalization (rotate/crop/scale); stage 4 covers OCR and element detection (docs/EXPERT_PIPELINE_DECISION_TABLE.md:32) | Missing asset derivation (page images, thumbnails), missing visual embedding storage (page/region). | Extend ingestion documentation with asset derivation and visual indexing steps, plus normalization metadata contract. |
| Context Pack contract for Guidance and VLM routing (document identity, priors, evidence bundle, normalization metadata, policy constraints, prefs, system state) | No canonical context pack defined; Guidance docs focus on fallback mapping (docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md:129) | Missing input contract and evidence bundle constraints. | Add Context Pack spec and reference it from pipeline stages and Guidance templates. |
| Guidance contracts for classification + tagging, field extraction, storage plan (separate outputs) | Guidance mapping table lists extraction/reasoning templates only (docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md:136) | No schema-defined contracts for storage plan or tagging actions. | Add contract schemas and template mappings for tagging and storage plan. |
| Autonomous filing policy engine + action orchestrator + audit log | Post-analysis tooling updates metadata (docs/EXPERT_PIPELINE_FLOW.md:55); log fields define request-level audit only (docs/OBSERVABILITY_AND_TELEMETRY.md:11) | Missing structured action plan, reversible actions, and action audit log. | Add action orchestration section and audit log schema plus telemetry events. |
| Postgres + pgvector schema for documents/pages/chunks/visual embeddings/actions | Database docs only cover pgvector availability (docs/DATABASE_SETUP.md:11); RAG reference lists sidecar endpoints (docs/RAG_SYSTEMS_REFERENCE.md:16) | No DDL for v2 tables or indexes. | Add v2 schema section (documents, document_pages, text_chunks, visual_pages, visual_regions, document_actions). |
| Vector column requirements per service are inconsistent | Code uses visual overlays `vector(320)` and RAGZ `vector(384)` while docs/tests still reference 768 (e.g., scripts/test_visual_rag_integration.js:49, scripts/verify_vector_db.js:47, guidance_service/tests/test_pgvector_integration.py:77) | Vector dimensions and column expectations are unclear across services. | Document per-service vector columns (visual_overlays vs document_embeddings), remove legacy 768 references, and note re-ingest requirements. |
| Retrieval queries for visual-first and hybrid fallback | RAG reference lists API endpoints and integration points only (docs/RAG_SYSTEMS_REFERENCE.md:16) | No query examples or retrieval contract. | Add SQL and query patterns for visual-first retrieval and hybrid fallback. |
| Evidence refs required across tagging/extraction/storage outputs; page/region locality | Evidence is only stated for stage 8; validation has no page locality (docs/EXPERT_PIPELINE_DECISION_TABLE.md:280, docs/EXPERT_PIPELINE_DECISION_TABLE.md:305) | Evidence requirements and page locality are not specified outside stage 8. | Extend stage contracts to require evidence refs for all autonomous outputs and define page/region locality schema. |
| Prompt and template guardrails banning invented geometry | Prompt change rules do not mention geometry constraints (docs/PROMPT_CHANGE_GUIDE.md:12) | No documented guardrail preventing LLM-invented geometry. | Add geometry provenance rule to prompt change guide and relevant stage contracts. |
| RAGZ is pgvector-only; Chroma removed | RAGZ still documented as "Chroma legacy → Postgres + pgvector" and migration guidance references Chroma (docs/RAG_SYSTEMS_REFERENCE.md:20, docs/RAG_SYSTEMS_REFERENCE.md:100) | Docs imply Chroma still exists and that embeddings can be migrated from it. | Update RAG systems reference to describe pgvector-only pipeline and remove Chroma references. |
| Visual RAG sidecar build now requires CUDA 12.4 + flash-attn>=2.4.0 | Sidecar README lists CUDA 12.1+ and generic flash-attn troubleshooting (services/visual-rag-sidecar/README.md:38, services/visual-rag-sidecar/README.md:158) | Version-specific build requirements are missing. | Update sidecar README to state CUDA 12.4 requirement and flash-attn minimum version/build notes. |
| ColQwen3-only enforcement + breaking-change startup warnings | Docs state ColQwen3 use and that ColQwen2 is deprecated (docs/VISUAL_RAG_INTEGRATION.md:74, services/visual-rag-sidecar/README.md:155) | No doc mentions hard rejection of `vidore/colqwen2-v1.0` or startup warnings. | Add explicit compatibility break notes in Visual RAG integration and sidecar README. |
| RAGZ health check validates pgvector table | RAGZ endpoints list does not include health semantics (docs/RAG_SYSTEMS_REFERENCE.md:20) | Health check contract and pgvector validation are undocumented. | Add `/health` contract and pgvector readiness checks to RAG systems reference. |
| RAG pipeline separation is unclear | Visual RAG and RAGZ are listed but not explicitly separated as distinct services with different vector settings | Service boundaries and vector responsibilities are ambiguous. | Add a "Service Separation" section that states: Visual RAG sidecar (visual embeddings/index) vs RAGZ (text embeddings) with distinct tables and dimensions. |

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

## Recent Updates

- Documented Tomoro ColQwen3 model settings (context window 32k, token budget, multi-vector output, FlashAttention 2) in `docs/model/tomoro-colqwen3.md`.
- Documented RAG service separation and per-service vector columns in `docs/RAG_SYSTEMS_REFERENCE.md` and `docs/DATABASE_SETUP.md` (visual_overlays vector(320), document_embeddings vector(384)).
- Documented visual summary metadata retention in `docs/RAG_SYSTEMS_REFERENCE.md` (summary stored in expert_metadata; boxes can follow).
- Deprecated and removed legacy `docs/architecture/postgresql-hybrid-rag.md`.

## Doc Update Targets (ordered)

1. docs/EXPERT_PIPELINE_DECISION_TABLE.md
2. docs/PIPELINE_STAGE_CONTRACTS.md
3. docs/SCHEMA_EVOLUTION_GUIDE.md
4. docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md
5. docs/PROMPT_CHANGE_GUIDE.md
6. docs/OBSERVABILITY_AND_TELEMETRY.md
7. docs/RAG_SYSTEMS_REFERENCE.md
8. docs/VISUAL_RAG_INTEGRATION.md
9. docs/DATABASE_SETUP.md
10. services/visual-rag-sidecar/README.md

## Open Questions

- Should v2 be documented as a parallel pipeline (V2) or as a replacement of
  existing Visual RAG stage 8 semantics?
- Is the action/audit log intended to live in the same Postgres instance as
  visual overlays and vector data?
- Should evidence refs be enforced at validation time or only at orchestration
  time?
