Scripts for verifying and running e2e reingest checks

Files:
- `verify_services.py` - checks health/readiness endpoints and Postgres connectivity. Writes `scripts/verify_services.json`.
- `e2e_reingest_verify.py` - runs an end-to-end reingest for a Paperless doc_id: downloads PDF, posts to Visual RAG `/index/pdf`, triggers Text RAG indexing, polls Qdrant for points, queries Postgres `visual_overlays`, and saves artifacts to a timestamped `artifacts/` directory.

Python dependencies (recommended install in venv):
- requests
- python-dotenv (optional)
- psycopg2-binary

Examples:
- Verify services:
  python scripts/verify_services.py

- Run e2e for doc 74 and store artifacts:
  python scripts/e2e_reingest_verify.py --doc-id 74 --output-dir artifacts/e2e-2026-01-25 --timeout 120
