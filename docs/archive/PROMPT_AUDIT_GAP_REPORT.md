# Prompt Audit Gap Report (Phase 3-6)

Scope: Dev-only prompts in `prompts/` (now moved to `prompts/completed/` after audit).
Goal: Identify gaps between prompt content and authoritative documentation. No behavior changes.

todo_list
- [x] `prompts/completed/000-phase-3-6-reference.md`
  - Status: Reference-only wrapper; no doc alignment issues found.
- [x] `prompts/completed/102-phase-3-visual-query-generation.md`
  - Gap: Missing Context Pack enforcement and "no raw OCR dumps" constraint.
    - Resolved in `docs/PIPELINE_STAGE_CONTRACTS.md` (explicit Stage 5.5 requirement).
  - Gap: Output schema includes `logit_bias` field not in Stage 5.5 contract.
    - Resolved in `docs/PIPELINE_STAGE_CONTRACTS.md` (logit_bias internal only).
  - Gap: Guidance authoring rules not referenced (`temperature=0.0`, `select()`, `regex()`, `guidance_json`).
    - Resolved in `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`, `docs/PROMPT_CHANGE_GUIDE.md`.
  - Gap: "SSOT Retrieval Broker" naming not in authoritative docs.
    - Resolved in `docs/EXPERT_PIPELINE_FLOW.md` (legacy alias note).
- [x] `prompts/completed/103-phase-4-visual-query-execution.md`
  - Gap: Per-query retries/backoff are specified in prompt but not in docs.
    - Resolved in `docs/PIPELINE_STAGE_CONTRACTS.md` and `docs/EXPERT_PIPELINE_DECISION_TABLE.md`.
  - Gap: Confidence fusion weights (0.6/0.4) not defined in docs.
    - Resolved in `docs/EXPERT_PIPELINE_DECISION_TABLE.md` and `docs/PIPELINE_STAGE_CONTRACTS.md`.
  - Gap: Evidence refs requirement for visual confirmations/new fields not stated.
    - Resolved in `docs/PIPELINE_STAGE_CONTRACTS.md`.
  - Gap: Overlay accuracy in pixels conflicts with normalized coordinates.      
    - Resolved in `docs/PIPELINE_STAGE_CONTRACTS.md` and `docs/VISUAL_RAG_INTEGRATION.md` (0-1 normalized).
- [x] `prompts/completed/104-phase-5-metrics-monitoring.md`
  - Gap: Metric name mismatch (`circuit_breaker_state_transitions` vs canonical `circuit_breaker_transitions_total`).
    - Resolved in `docs/OBSERVABILITY_AND_TELEMETRY.md` (canonical names list).
  - Gap: Metrics not listed in docs (user_correction_rate, extraction_accuracy_per_field_type, visual_confirmation_rate, ocr_source_attribution_rate).
    - Resolved in `docs/OBSERVABILITY_AND_TELEMETRY.md`.
- [x] `prompts/completed/105-phase-6-testing-validation.md`
  - Gap: Performance targets are not defined in authoritative docs.
    - Resolved in `docs/VISUAL_RAG_INTEGRATION.md` (Target SLOs).
  - Gap: "SSOT Retrieval Broker" naming mismatch.
    - Resolved in `docs/EXPERT_PIPELINE_FLOW.md` (legacy alias note).
  - Gap: `@agent-test-agent` not present in current skills list.
    - Resolution: Use `@agent-debug-agent` or general-purpose for test audits; no `test-agent` skill exists.

Notes for implementers:
- Prompts 102 and 103 are implemented; docs now reflect the observed behavior.
- Prompts 104 and 105 are aligned to docs and moved back to `prompts/` as implementation guardrails.

## What-if Decision Matrix (Open Questions)

### 1) logit_bias in Stage 5.5 output schema?

| Option | What if we do this? | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| Formal schema field | logit_bias travels downstream; schema expands | Exposes internal Guidance tuning to pipeline contracts | Avoid |
| Guidance-only detail | logit_bias stays in generation internals | Keeps schema stable; fewer downstream dependencies | Recommended |

Answer: Treat logit_bias as Guidance-only implementation detail. Keep Stage 5.5 schema focused on query content and evidence refs.

### 2) Stage 8 per-query retries/backoff?

| Option | What if we do this? | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| Document retries/backoff in docs | Retries become contractually required | May conflict with latency budgets; complex failure modes | Only if implemented and measured |
| Best-effort, no retries | Keeps enrichment optional and low-risk | Less robustness to transient sidecar failures | Recommended unless retries are proven |

Answer: Document bounded retries/backoff via the circuit breaker (as implemented) and keep any additional per-query retry loops out of scope.

### 3) Canonical metric names?

| Metric | What if we standardize? | Tradeoff | Recommendation |
| --- | --- | --- | --- |
| Circuit breaker transitions | `circuit_breaker_transitions_total` | Aligns with existing docs/tests | Recommended |
| Visual query success | `visual_query_success_rate` or `visual_queries_executed_total` | Must match existing telemetry naming | Use docs: prefer `visual_queries_executed_total` + derived rate |

Answer: Keep `circuit_breaker_transitions_total` as canonical. For visual query success, track `visual_queries_executed_total` and compute success rate in dashboards; document any new `visual_query_success_rate` only if it is actually emitted.
