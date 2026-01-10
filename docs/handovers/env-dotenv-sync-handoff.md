# Handoff: Centralize env management (docker-compose.env → .env compatibility)

**Author:** GitHub Copilot
**Date:** 2026-01-10
**To:** implement-agent

---

## Summary ✅
We consolidated environment variable handling with `paperless-ngx/docker-compose.env` as the single source of truth and added tools and tests to ensure legacy `docker-compose` (hyphen) clients receive a concrete `.env` file for interpolation. Changes made so far:

- Added POSIX and PowerShell generator scripts:
  - `scripts/sync_dotenv_from_compose_env.sh` (resolves ${VAR:-fallback} values)
  - `scripts/sync_dotenv_from_compose_env.ps1` (PowerShell variant)
- Updated `scripts/validate_env.sh` to auto-generate `paperless-ngx/.env` if missing
- Added unit test: `test/unit/env-sync.test.js` (verifies `.env` generation and resolved values)
- Updated docs: `docs/ENVIRONMENT_VARIABLES.md` with compatibility note
- Generated `paperless-ngx/.env` in working tree for developer testing (kept out of git by `.gitignore`)

All sensitive values remain defined in `paperless-ngx/docker-compose.env` (single source of truth). The generated `.env` is derived and ignored by git.

---

## Gaps & Outstanding Work ⚠️
1. Compose file parity
   - Verify `paperless-ngx/docker-compose.yml` explicitly maps critical envs for the `visual-rag` service via `environment:` block (e.g., `MEDIA_DIR`, `INDEX_DIR`, `VISUAL_RAG_INDEX_NAME`, `DEFAULT_INDEX_NAME`, `BIAS_ENGINE_LOG_LEVEL`). This avoids interpolation mismatches across compose client variants.
   - If `env_file:` is used, ensure it points to `docker-compose.env` (NOT to `.env`) and that `docker-compose.yml` uses explicit `environment:` entries when needed.

2. CI validation
   - Add a GitHub Actions job `validate-env` that runs:
     - `scripts/sync_dotenv_from_compose_env.sh` (or PowerShell variant on Windows runners)
     - `scripts/validate_env.sh` (or `python scripts/validate_env_py.py`)
   - Fail the job if required envs are missing or empty; this prevents PRs that accidentally remove essential envs.

3. Invocation policy
   - Add a Makefile / npm script / `README` snippet recommending which command to run for local builds:
     - Preferred: `docker compose --env-file paperless-ngx/docker-compose.env build` (modern CLI)
     - Legacy: run `scripts/sync_dotenv_from_compose_env.sh` first, then `docker-compose build` (hyphen client)

4. Test coverage & CI
   - Ensure `test/unit/env-sync.test.js` runs in CI. Configure test step to run unit tests via existing Mocha test runner.

5. Windows robustness
   - The PowerShell generator had an initial parsing bug (fixed). Verify `pwsh -NoProfile -File scripts/sync_dotenv_from_compose_env.ps1` runs successfully on Windows CI runners.

6. Hardcoded secret scan
   - Although the authoritative file contains secrets, run a quick audit to ensure no other files commit secrets in plaintext (we found tokens in `docker-compose.env` only; ensure no committed `.env` files or other copies exist). Consider adding a GitHub Action secret-scan job.

---

## Acceptance criteria (what `implement-agent` should deliver) ✅
1. `docker-compose build --no-cache` (legacy hyphen client) shows **no** warnings for these variables:
   - MEDIA_DIR, INDEX_DIR, VISUAL_RAG_INDEX_DIR, VISUAL_RAG_INDEX_NAME, DEFAULT_INDEX_NAME, BIAS_ENGINE_LOG_LEVEL
2. `python scripts/validate_env_py.py` returns OK in CI and locally. The generator script produces a `.env` with resolved, non-empty values (no `${...}` patterns).
3. A GitHub Actions job `validate-env` exists and runs on PRs and main branch, failing when required vars are missing or empty.
4. `test/unit/env-sync.test.js` runs in the CI test suite and passes.
5. Documentation updated with the exact commands and rationale (`docs/ENVIRONMENT_VARIABLES.md` and `docs/handovers/env-dotenv-sync-handoff.md`).

---

## Implementation plan (step-by-step) 🛠️
Priority order (short tasks first):

1. Verify and, if needed, update `paperless-ngx/docker-compose.yml`:
   - Under `services.visual-rag.environment` add:
     ```yaml
     MEDIA_DIR: ${MEDIA_DIR}
     INDEX_DIR: ${INDEX_DIR}
     VISUAL_RAG_INDEX_NAME: ${VISUAL_RAG_INDEX_NAME}
     DEFAULT_INDEX_NAME: ${DEFAULT_INDEX_NAME}
     BIAS_ENGINE_LOG_LEVEL: ${BIAS_ENGINE_LOG_LEVEL}
     ```
   - Keep `env_file: docker-compose.env` as global envs if present.

2. Add CI job `.github/workflows/validate-env.yml` that:
   - Runs on PRs
   - Runs `scripts/sync_dotenv_from_compose_env.sh` (or PS variant)
   - Runs `scripts/validate_env.sh` (or `python scripts/validate_env_py.py`)
   - Runs `npm test` / `npm run test:unit` to ensure `env-sync.test.js` runs

3. Add a short `Makefile` or npm scripts in `package.json`:
   - `make env-sync` or `npm run env:sync` to run sync scripts
   - `make env-validate` or `npm run env:validate` to run validator

4. Add a small integration check in `test/smoke` or `scripts` that runs `docker-compose build --no-cache` inside a smoke job on a runner that has docker-compose available (optional, can be gated to a self-hosted runner).

5. Add secret-scan job to detect accidental secrets committed to the repo (optional but recommended).

---

## Risks & Mitigations ⚠️
- Risk: Committing a generated `.env` by mistake.
  - Mitigation: `.gitignore` already ignores `.env*` and generator header warns not to edit directly.
- Risk: Windows CI runner failing due to PowerShell differences.
  - Mitigation: Add Windows test in CI to execute `sync_dotenv_from_compose_env.ps1` and validate output.
- Risk: Duplicate or inconsistent envs across files.
  - Mitigation: Add CI guard that the `docker-compose.env` contains required vars and fail PRs that remove them.

---

## Who should do what next ▶️
- **implement-agent**: implement the `docker-compose.yml` environment mapping, add CI `validate-env` workflow, add `Makefile`/npm script, and ensure `env-sync` unit test runs in CI.
- **debug-agent**: after implementation, re-run `docker-compose build --no-cache` and the Visual RAG smoke tests to confirm warnings are gone and sidecar has `INDEX_DIR`, `MEDIA_DIR` and index names populated.

---

If anything is unclear or you want me to create the CI workflow and compose edits for you, say the word and I’ll proceed to implement them. 🎯
