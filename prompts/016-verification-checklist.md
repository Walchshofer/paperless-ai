# Verification Checklist — Paperless-AI Implementation

<objective>
Provide a consolidated, CI-friendly checklist that references verification prompts and enables fast pass/fail gating for changes touching DB, frontend islands, telemetry, circuit breaker, and feedback E2E flows.
</objective>

<context>
This file consolidates verification steps created as individual prompts for auditability and CI gating. It is intended to be referenced by reviewers and CI jobs implementing verification gates.
References:
- prompts/011-verification-db-schema.md
- prompts/012-verification-frontend-islands.md
- prompts/013-verification-telemetry.md
- prompts/014-verification-circuit-breaker.md
- prompts/015-integration-feedback-e2e.md
</context>

<requirements>
1. CI must be able to run fast verification checks (lint, contract parse) and optionally run longer E2E tests in a separate gated job.
2. Each verification item must be traceable to a prompt file and have explicit pass/fail criteria.
3. Test infra must expose a `POSTGRES_URL`, `PAPERLESS_MOCK_URL`, and `METRICS_URL` for CI runs.
</requirements>

<implementation>
- Add a GitHub Actions job `verification-fast` to run quick checks (contract validations, simple DB queries, static assertions).
- Add a job `verification-e2e` for Playwright flows that runs only on the release branch or when E2E changes are detected.
- Use small utility scripts to run DB checks and metrics validation in CI (e.g., `scripts/check-db.js`, `scripts/check-metrics.js`).
- Ensure the checklist is updated in PR templates and PR reviewers run or reference it during review.
</implementation>

<output>
- `.github/workflows/verification-fast.yml` (Created/Proposed)
- `.github/workflows/verification-e2e.yml` (Created/Proposed)
- `scripts/check-db.js`, `scripts/check-metrics.js` (Created/Proposed)
</output>

<verification>
- Run `verification-fast` locally or in CI to confirm contract parsing and quick DB checks pass.
- Run `verification-e2e` in a staging environment to confirm Playwright E2E passes and DB rows are written as expected.
- Ensure PRs that touch related subsystems include a checklist linking to the executed verification jobs.
</verification>

<lifecycle>
1. When a verification fails in CI, block the PR and record a reproducible failure case.
2. Update this checklist when adding new islands, migrations, or telemetry events.
3. Archive completed checks in `prompts/completed/` and add a summary to `prompts/summaries/`.
