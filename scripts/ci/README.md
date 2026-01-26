CI preflight utilities

- `preflight-checks.sh` : Attempts to verify that required services for E2E tests are ready (Visual-RAG, Qdrant, Text-RAG, Paperless, Postgres).
  - It wraps `scripts/verify_services.py` and performs retries with exponential backoff.
  - On final failure, it emits diagnostics including `scripts/verify_services.json` (if present) and `docker logs` for `visual_rag` and `paperless_qdrant` to aid CI triage.

Usage example (CI):

  bash scripts/ci/preflight-checks.sh --timeout 300
