# Native ColQwen3 Visual RAG (TomoroAI/tomoro-colqwen3-embed-4b)

This bundle contains the scripts from the provided tutorial:

- `requirements.txt`
- `Dockerfile`
- `main.py`

## Build

```bash
docker build -t colqwen3-native-rag .
```

## Run (with persistent index volume)

```bash
docker run --gpus all -p 8001:8001   -e INDEX_DIR=/data/indices   -v $(pwd)/indices:/data/indices   colqwen3-native-rag
```

> **Note (Stateful vs Stateless):** This sidecar is *stateful* by default — it persists per-document tensor files (`.pt`) into `INDEX_DIR` and additionally syncs mean-pooled vectors to Qdrant as the single source of truth. To operate as a *stateless* compute-only service, remove or set `INDEX_DIR` to a host path you manage externally and change ingestion to persist vectors directly to Qdrant; see `docs/ENVIRONMENT_VARIABLES.md` for guidance.

## Endpoints

- `POST /index/document` – payload: `{"doc_id": 1, "images": ["<base64>", ...]}`
- `POST /search` – payload: `{"query": "text", "k": 5}`
- `GET /health`
