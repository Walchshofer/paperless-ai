# Test Environment

This document describes how the paperless-ai test environment is configured and
what to expect when running local test suites.

## Source of Truth (Multi-Container)
The authoritative environment file for the multi-container stack is:
- `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env`

Use it consistently when starting services or inspecting configuration:
`docker compose --env-file docker-compose.env ...`

## Test Runner Commands
- `npm test` (Mocha unit + integration tests)
- `npm run test:integration` (sidecar-enabled integration runs)
- `npm run test:performance` (perf suites in `test/performance/`)
- `npm run test:coverage` (c8 coverage summary + lcov output)

## Test Environment Defaults
The test harness initializes defaults in `test/setup-env.js`:
- `GUIDANCE_ENABLED` defaults to `true`.
- `GUIDANCE_SERVICE_ENABLED` defaults to `no` unless explicitly set.
- `RAG_SERVICE_URL` defaults to `http://localhost:8800`.
- `RAG_SERVICE_ENABLED` is considered disabled unless set to `true`.
- Model defaults for routing and extraction are set for tests:
  - `ROUTER_MODEL=qwen3-vl:8b`
  - `MEDICAL_VISION_MODEL=llava-med-v1.6`
  - `MEDICAL_ANALYSIS_MODEL=medtext-llama3`
  - `FINANCIAL_ANALYSIS_MODEL=fino1-8b`
  - `FINANCIAL_REASONING_MODEL=llm-pro-finance-8b`
  - `GENERAL_MODEL=sauerkraut-llama3.1:8b`
- `ORCHESTRATOR_MODEL` and `OLLAMA_EMBEDDING_MODEL` are intentionally left unset
  so tests can validate default behavior.

## Database Setup for Tests
The test harness attempts to ensure the `visual_overlays.embedding` column
exists (for Visual RAG integration tests):
1. Prefer `VisualOverlayRepository` pool if available.
2. Fall back to a direct `pg` connection using:
   - `POSTGRES_HOST`/`POSTGRES_PORT`/`POSTGRES_DB`
   - `POSTGRES_USER` (fallback: `PAPERLESS_DBUSER`)
   - `POSTGRES_PASSWORD` (fallback: `PAPERLESS_DBPASS`)

If credentials are missing, the setup logs a warning and continues.

## Integration Test Notes
- `test/integration/bias-engine.test.js` runs against local mock servers by
  default. Set `BIAS_ENGINE_TEST_MODE=external` to use live services.
- Guidance health checks can be exercised via the mock unless external mode is
  enabled.

## Environment Consolidation
All environment variables for the multi-container stack should live in
`docker-compose.env`. Other `.env` files are pointers only to avoid duplication.
Do not keep separate runtime configuration in `.env.example`, `.env`, or
`docker-compose_test.env`.
