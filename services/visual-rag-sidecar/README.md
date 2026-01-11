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

## Endpoints

- `POST /index/document` – payload: `{"doc_id": 1, "images": ["<base64>", ...]}`
- `POST /search` – payload: `{"query": "text", "k": 5}`
- `GET /health`
