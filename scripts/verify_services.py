"""verify_services.py

Checks readiness/health endpoints for services used by e2e tests:
- Paperless API
- Visual RAG sidecar
- Text RAG
- Qdrant
- Ollama
- Postgres (direct DB check via psycopg2)

Exits with code 0 if all checks pass, non-zero otherwise.

Usage:
  python scripts/verify_services.py

Reads configuration from environment variables:
  PAPERLESS_API_URL, PAPERLESS_API_TOKEN
  VISUAL_RAG_URL
  TEXT_RAG_URL
  QDRANT_URL
  OLLAMA_URL
  POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

Outputs JSON summary to stdout and writes `scripts/verify_services.json` on success/failure.
"""

import os
import sys
import json
import time
import requests

from typing import Dict, Any


def _get_env(key: str, default: str = None) -> str:
    return os.environ.get(key) or default


def check_url(url: str, path: str = "/health", timeout: int = 5) -> Dict[str, Any]:
    full = (url.rstrip("/") + path) if path.startswith("/") else url
    try:
        r = requests.get(full, timeout=timeout)
        return {"ok": r.status_code == 200, "status_code": r.status_code, "text": r.text[:1000]}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def check_paperless(url: str, token: str) -> Dict[str, Any]:
    try:
        headers = {"Authorization": f"Token {token}"} if token else {}
        r = requests.get(f"{url.rstrip('/')}/documents/1/", headers=headers, timeout=5)
        return {"ok": r.status_code == 200, "status_code": r.status_code, "text": r.text[:1000]}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def check_postgres(host: str, port: int, db: str, user: str, password: str) -> Dict[str, Any]:
    try:
        import psycopg2
        conn = psycopg2.connect(host=host, port=port, dbname=db, user=user, password=password, connect_timeout=5)
        cur = conn.cursor()
        cur.execute("SELECT 1")
        res = cur.fetchone()
        cur.close()
        conn.close()
        return {"ok": True, "result": res}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def main():
    report = {"services": {}, "ok": True}

    PAPERLESS_API_URL = _get_env("PAPERLESS_API_URL", "http://localhost:8000/api")
    PAPERLESS_API_TOKEN = _get_env("PAPERLESS_API_TOKEN", None)
    VISUAL_RAG_URL = _get_env("VISUAL_RAG_URL", "http://127.0.0.1:8001")
    TEXT_RAG_URL = _get_env("TEXT_RAG_URL", "http://127.0.0.1:8004")
    QDRANT_URL = _get_env("QDRANT_URL", "http://127.0.0.1:6333")
    OLLAMA_URL = _get_env("OLLAMA_URL", _get_env("OLLAMA_API_URL", "http://127.0.0.1:11434"))

    POSTGRES_HOST = _get_env("POSTGRES_HOST", "localhost")
    POSTGRES_PORT = int(_get_env("POSTGRES_PORT", "5432"))
    POSTGRES_DB = _get_env("POSTGRES_DB", "paperless")
    POSTGRES_USER = _get_env("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD = _get_env("POSTGRES_PASSWORD", "")

    # Paperless
    report["services"]["paperless"] = check_paperless(PAPERLESS_API_URL, PAPERLESS_API_TOKEN)
    report["ok"] = report["ok"] and report["services"]["paperless"].get("ok", False)

    # Visual RAG (ready + health)
    report["services"]["visual_rag_ready"] = check_url(VISUAL_RAG_URL, "/ready")
    report["services"]["visual_rag_health"] = check_url(VISUAL_RAG_URL, "/health")
    report["ok"] = report["ok"] and report["services"]["visual_rag_ready"].get("ok", False)

    # Text RAG
    report["services"]["text_rag_status"] = check_url(TEXT_RAG_URL, "/status")
    report["ok"] = report["ok"] and report["services"]["text_rag_status"].get("ok", False)

    # Qdrant
    report["services"]["qdrant_health"] = check_url(QDRANT_URL, "/health")
    report["services"]["qdrant_collections"] = check_url(QDRANT_URL, "/collections")
    report["ok"] = report["ok"] and report["services"]["qdrant_health"].get("ok", False)

    # Ollama
    report["services"]["ollama_tags"] = check_url(OLLAMA_URL, "/api/tags")

    # Postgres check
    report["services"]["postgres"] = check_postgres(POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD)
    report["ok"] = report["ok"] and report["services"]["postgres"].get("ok", False)

    # Write summary file
    out_path = os.path.join(os.getcwd(), "scripts", "verify_services.json")
    try:
        with open(out_path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=2)
    except Exception:
        pass

    print(json.dumps(report, indent=2))

    if not report["ok"]:
        print("One or more checks failed. Inspect 'scripts/verify_services.json' for details.")
        sys.exit(2)

    print("All checks passed.")
    sys.exit(0)


if __name__ == "__main__":
    main()
