# Verification Checklist — Paperless-AI Implementation

This checklist consolidates the required verification prompts and gives quick pass/fail steps for CI or manual audits.

Sections:
- Database Schema & Migration ✅ prompts/verification-db-schema.md
- Frontend Islands & Contracts ✅ prompts/verification-frontend-islands.md
- Telemetry & Metrics ✅ prompts/verification-telemetry.md
- Circuit Breaker Behaviour ✅ prompts/verification-circuit-breaker.md
- End-to-End Feedback Flow (Integration Test) ✅ prompts/integration-feedback-e2e.md

Checklist (Quick Pass/Fail Steps):

## 1) Database Schema
- [ ] `pg_vector` extension installed and versioned
- [ ] `pgcrypto`/UUID support available
- [ ] `feedback_events` table present with required columns and indexes
- [ ] `visual_overlays` embedding column and HNSW index present
- [ ] Migration and rollback scripts present and runnable (`migrations/002_create_feedback_events.sql`, `migrations/002_rollback_feedback_events.sql`)

Related docs: docs/FEEDBACK_PERSISTENCE_STRATEGY.md, docs/DATABASE_SETUP.md

## 2) Frontend Islands & Contracts
- [ ] All interactive islands have `data-island` anchors
- [ ] Each island has a Zod contract in `src/ui/contracts/*.contract.ts`
- [ ] Server validates `vm` against contract before rendering
- [ ] All interactive elements have `data-testid` attributes (kebab-case)
- [ ] Island bundles (or runtime) mount successfully in runtime tests

Related docs: docs/FRONTEND_ARCHITECTURE.md

## 3) Telemetry & Logging
- [ ] Every request has `request_id` generated if missing and returned in response headers
- [ ] `X-Request-Id` propagated to external service calls (Paperless, Visual Sidecar, Guidance)
- [ ] Structured logs include required fields (`request_id`, `document_id`, `stage`, etc.)
- [ ] `/metrics` endpoint is available and key metrics increment during tests

Related docs: docs/OBSERVABILITY_AND_TELEMETRY.md

## 4) Circuit Breaker
- [ ] `circuit_breaker_state` metric exists and is queryable
- [ ] Simulated failures open the circuit after threshold and set `context.visualSidecarAvailable=false`
- [ ] Circuit respects cooldown and transitions to HALF_OPEN then CLOSED on recovery
- [ ] Metrics `circuit_breaker_open_total`, `visual_query_timeouts_total` are present and update

Related docs: docs/VISUAL_RAG_INTEGRATION.md

## 5) End-to-End Feedback Flow
- [ ] Playwright/Cypress test performs UI feedback submission and receives success response
- [ ] API receives valid payload and updates Paperless metadata (mocked or real)
- [ ] `feedback_events` table receives a new row with correct values and `request_id` in context
- [ ] Metrics and logs reflect the ingest event

Related prompts: prompts/integration-feedback-e2e.md

---

How to use:
- Run each verification prompt's recommended steps as part of CI gating for releases that touch the related subsystems.
- Fail the PR if any of the non-optional checks are not satisfied.

Additions & Maintenance:
- When adding new islands, migrations, or telemetry events, add a corresponding verification step to this checklist and update the relevant prompt file.