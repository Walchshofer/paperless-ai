# Pipeline Alignment TODOs

Scope: Align implementation with `docs/EXPERT_PIPELINE_DECISION_TABLE.md` and
`docs/VALIDATION_AND_RETRY_POLICY.md`. This list tracks work items and assigns
each item to an existing sub-agent for focused execution.

## Execution Plan

1) Doc-first updates (done)
2) Parallel OCR integration + validation-driven retries (core)
3) Visual query generation/execution correctness
4) Context Pack enforcement + observability hardening
5) Test coverage and regression guards

## Detailed TODOs (delegated)

1. Stage 4 parallel OCR wiring
   - Owner: pipeline-orchestration-expert
   - Tasks:
     - Add a dedicated Stage 4 `TEXT_EXTRACTION` stage with `useParallelOcr: true`
       or set `useParallelOcr: true` on the first extraction stage in
       `services/experts/pipelines/*.js`.
     - Ensure `context.document.enhanced_ocr_text` and `document._ocr_metadata`
       are set from the Parallel OCR result in
       `services/experts/ExpertPipelineExecutor.js`.
     - Normalize output keys to `ocr` + `ocr_metadata` for downstream stages.

2. Validation-driven retries (document-scoped)
   - Owner: pipeline-orchestration-expert
   - Tasks:
     - Route extraction stages through `_executeWithValidation()` to enforce
       `ValidationEngine.validate()` and bounded retries.
     - Disable or bypass stage-level `retryCount` for validation-driven
       extraction retries.
     - Ensure terminal states follow: success, accepted_with_warnings,
       manual_review_required.

3. Visual query generation (Stage 5.5) alignment
   - Owner: guidance-expert
   - Tasks:
     - Use Guidance template `visual_query_generator_de` (or domain variants)
       with PromptRegistry + JsonRepair fallback.
     - Validate minimum 3 queries and ensure `field_target` exists in schema or
       taxonomy.
     - Enforce circuit breaker gating and `context.visualSidecarAvailable`.

4. Visual query execution (Stage 8) alignment
   - Owner: pipeline-orchestration-expert
   - Tasks:
     - Replace stubbed `_executeVisualSearch()` with real `VisualSearchClient`
       calls and propagate `request_id` headers when available.
     - Deduplicate boxes per page using IoU > 0.7 and preserve query metadata.
     - Enforce dynamic K formula and concurrency limits.

5. Context Pack enforcement
   - Owner: docs-agent
   - Tasks:
     - Define Context Pack builder boundaries and required fields.
     - Ensure LLM stages only receive evidence snippets (no raw OCR dumps).

6. Observability hardening
   - Owner: debug-agent
   - Tasks:
     - Add `request_id`, `pipeline_id`, `retry_count`, `fallback_reason`,
       `ocr_source_selected` to pipeline logs where applicable.
     - Emit `retry_triggered` + `fallback_executed` events per
       `docs/OBSERVABILITY_AND_TELEMETRY.md`.

7. Tests and regression guards
   - Owner: test-agent
   - Tasks:
     - Unit tests: parallel OCR routing, validation retry loop, and visual query
       execution fallback paths.
     - Integration tests: Stage 4 -> Stage 5 -> Stage 7 flow with bounded
       retries and terminal state handling.

## Status

- Doc updates: done
- Core code changes: pending
- Tests: pending
