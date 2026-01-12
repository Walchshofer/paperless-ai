Added E2E test (guarded by SERENA_E2E env) and a PR-level Python coverage job that enforces >= 80% coverage for `codex-bridge.py`.

- E2E test: `test/e2e/test_serena_e2e.py` (skipped unless `SERENA_E2E` env var set and `SERENA_BASE` configured)
- CI: `.github/workflows/python-coverage.yml` runs python tests and checks `codex-bridge.py` coverage >= 80%

Local validation: all bridge unit + integration tests pass and local coverage for `codex-bridge.py` is >=80%.
