# Visual RAG Sidecar Service

A FastAPI service that provides visual document retrieval using ColQwen2/ColPali via the Byaldi library. This service indexes PDF pages as images and enables semantic search that understands document layout, tables, charts, and formatting.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Compose                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  paperless-  │───▶│  visual-rag  │◀───│    ollama    │  │
│  │     ai       │    │   :8001      │    │   (shared    │  │
│  │   :3000      │    │              │    │    GPU)      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  paperless-  │    │  /data/      │                      │
│  │     ngx      │    │  indices/    │                      │
│  │   :8000      │    │              │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Visual Document Retrieval**: Search documents by visual content (tables, charts, layouts)
- **ColQwen2 Model**: Uses state-of-the-art vision-language model for embedding
- **PDF Page Indexing**: Indexes each PDF page as an image
- **Late Interaction Search**: MaxSim scoring for high-quality retrieval
- **GPU Optimized**: Designed to share GPU with Ollama on RTX 3090 Ti

## Requirements

- **GPU**: NVIDIA GPU with 12GB+ VRAM (RTX 3090 Ti recommended)
- **CUDA**: 12.1+
- **Docker**: With NVIDIA Container Toolkit

## API Endpoints

### Health & Status

```bash
# Health check
curl http://localhost:8001/health

# Indexing status
curl http://localhost:8001/status
```

### Document Indexing

```bash
# Index a single PDF
curl -X POST http://localhost:8001/index/document \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "documents/originals/invoice.pdf", "doc_id": 123}'

# Index a directory of PDFs
curl -X POST http://localhost:8001/index/directory \
  -H "Content-Type: application/json" \
  -d '{"directory": "documents/originals", "recursive": true}'
```

### Search

```bash
# Visual search
curl -X POST http://localhost:8001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "invoice total at the bottom", "k": 5}'
```

### Index Management

```bash
# Clear index
curl -X DELETE http://localhost:8001/index
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VISUAL_RAG_MODEL` | `vidore/colqwen2-v1.0` | ColQwen2 model to use |
| `INDEX_DIR` | `/data/indices` | Directory for storing indices |
| `MEDIA_DIR` | `/media/paperless` | Directory containing PDFs |
| `DEFAULT_INDEX_NAME` | `paperless_visual` | Name of the index |
| `STORE_COLLECTION` | `false` | Store base64 images in index |
| `HOST` | `0.0.0.0` | Service host |
| `PORT` | `8001` | Service port |
| `MAX_SPLIT_SIZE_MB` | `512` | PyTorch CUDA memory split size |

## Docker Compose Integration

The service is configured in `paperless-ngx/docker-compose.yml`:

```yaml
visual-rag:
  build:
    context: ../paperless-ai/services/visual-rag-sidecar
    dockerfile: Dockerfile
  container_name: visual_rag
  restart: unless-stopped
  ports:
    - "8001:8001"
  environment:
    - NVIDIA_VISIBLE_DEVICES=all
    - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
  volumes:
    - visual_model_cache:/root/.cache/huggingface
    - ./data/visual_indices:/data/indices
    - ./media:/media/paperless:ro
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Install PyTorch with CUDA
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Install poppler (for PDF processing)
# Ubuntu: sudo apt-get install poppler-utils
# macOS: brew install poppler

# Run the service
python main.py
```

## Model Information

**ColQwen2 (vidore/colqwen2-v1.0)**
- Architecture: ColPali / ColQwen (Vision-Language Retriever)
- Methodology: Late Interaction (MaxSim)
- Size: ~8.5 GB
- VRAM: 12GB+ recommended
- Strength: Zero-loss visual retrieval (finds charts, layouts, handwriting without OCR)

## Troubleshooting

### Out of Memory (OOM)
If you get CUDA OOM errors when running alongside Ollama:
1. Increase `MAX_SPLIT_SIZE_MB` environment variable
2. Reduce Ollama's context window
3. Use model quantization (future feature)

### Slow Model Loading
First load downloads 8.5GB model. Subsequent loads use cached model in `/root/.cache/huggingface` volume.

### PDF Processing Errors
Ensure poppler-utils is installed. Check that PDF files are valid and not corrupted.

## References

- [Byaldi GitHub](https://github.com/AnswerDotAI/byaldi)
- [ColPali GitHub](https://github.com/illuin-tech/colpali)
- [ColPali Paper](https://arxiv.org/abs/2407.01449)
