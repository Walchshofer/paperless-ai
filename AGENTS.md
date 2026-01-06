# Agent Instructions for paperless-ai

## Doc-first guardrails
- Read and follow `docs/EXPERT_PIPELINE_DECISION_TABLE.md` and
  `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` before changes.
- Authoritative docs (must follow):
  - `docs/EXPERT_PIPELINE_DECISION_TABLE.md`
  - `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md`
  - `docs/PIPELINE_STAGE_CONTRACTS.md`
  - `docs/VALIDATION_AND_RETRY_POLICY.md`
  - `docs/SCHEMA_EVOLUTION_GUIDE.md`
  - `docs/PROMPT_CHANGE_GUIDE.md`
  - `docs/ARCHITECTURE_OVERVIEW.md`
  - `docs/OBSERVABILITY_AND_TELEMETRY.md`
  - `docs/ENVIRONMENT_VARIABLES.md`
- If guidance conflicts with these docs, the docs win; ask for clarification.
- Ignore `docs/archive/` as non-authoritative.

## Architecture and scope
- Follow `.github/architecture/pipeline-contract.md`,
  `.github/architecture/service-boundaries.md`, and
  `.github/architecture/coding-standards.md` for any change.
- Allowed: paperless-ai orchestration logic, retries, telemetry, header
  propagation; guidance-service provider plumbing (LiteLLM), cache namespace
  header support, request-id propagation; Visual OCR/OCR selection if compliant
  with the decision table; PromptRegistry templates/configs.
- Not allowed without explicit instruction: changing precedence ordering,
  bypassing PromptRegistry, or changing fallback mapping semantics.

## Prompt safety rules
- Preserve stage contracts; Guidance is optional, PromptRegistry is authoritative.
- Keep required schema fields and output format guarantees; do not weaken
  evidence-backed constraints.
- Any prompt change must add or update tests and note intended behavior change
  and risk.
- If prompt changes expand token usage, add or adjust summarization or evidence
  budgeting guards.

## Quality gates
- Add Mocha + Node assert tests for new behavior.
- If behavior changes, update telemetry/logging (request-id, retry scope,
  fallback reason).
- Provide a checklist mapping changes back to
  `docs/EXPERT_PIPELINE_DECISION_TABLE.md`.

## Required output format (for changes)
- Short plan
- File-by-file diff summary
- Code changes
- Tests
- Decision table checklist

## Multi-container runtime
- Compose files live in `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml`
  and `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env`.
- Services include: webserver, db (pgvector), broker, gotenberg, tika,
  paperless-ai, visual-rag sidecar, guidance-service, bias-engine, prometheus,
  grafana.
- paperless-ai uses `PAPERLESS_API_URL` (webserver) and sidecar endpoints via
  `VISUAL_RAG_URL` and `GUIDANCE_SERVICE_URL`.
- visual-rag sidecar needs NVIDIA GPU support and persists model cache and
  indices on volumes.
- guidance-service connects to host Ollama via `OLLAMA_API_URL`
  (`http://host.docker.internal:11434`).
- **Build Safety**: Always build services with the correct context (service dir)
  to ensure the correct `requirements.txt` is used. Prefer `docker-compose build`.

## Repo layout and tooling
- Node/Express app entrypoint: `server.js`.
- Tests: `npm test` (Mocha + Node assert), `npm run test:integration` for
  sidecar-enabled runs.
- Instruction files auto-apply by glob in `.github/instructions/`.
- Agent files live in `.github/agents/` and include @docs, @implement, @test,
  @debug, @schema-evolution, @pipeline-orchestration, @guidance-expert,
  @paperless-api-expert, and @optimize.
- `docker-compose.env` contains secrets; never paste or commit credentials or
  API tokens.
