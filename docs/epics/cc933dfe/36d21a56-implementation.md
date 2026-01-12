Enabled CI gating for E2E tests on PRs. The E2E job runs only when the `SERENA_E2E` secret is set to `true` and a `SERENA_BASE` URL (secret) is configured. The job performs a health check against `${{ secrets.SERENA_BASE }}/health` before running the single guarded E2E test.

Notes:
- This avoids running E2E by default in PRs that do not have access to a real Serena instance.
- To run E2E in CI, set repository secret `SERENA_E2E=true` and `SERENA_BASE` to the Serena base URL.
