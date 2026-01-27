# Claude Code Project Memory

## Multi-container Docker setup

The Docker deployment files for this project are located in this repository:

- **docker-compose.env**: `C:\Users\pwalc\MyApps\paperless-ai\docker-compose.env`
- **docker-compose.yml**: `C:\Users\pwalc\MyApps\paperless-ai\docker-compose.yml`

This compose file defines the full multi-container stack for Paperless-ngx plus
paperless-ai and its AI sidecars.

### Build Context Strategy
The services are built using the repository root as context:

```yaml
visual-rag:
  build:
    context: .
    dockerfile: containers/visual-rag/Dockerfile
```

**Why parent context?**
- Allows Dockerfile to reference `paperless-ai/` code and dependencies
- Enables access to shared resources across both repositories
- Prevents "COPY failed: file not found" errors during multi-repo builds

**Best Practice**: Always build from `paperless-ngx/` directory:
```bash
cd C:\Users\pwalc\MyApps\paperless-ngx
docker-compose build visual-rag
```

This ensures the context path `..` correctly resolves to the parent directory containing both `paperless-ai/` and `paperless-ngx/` repositories.

## Service Architecture

| # | Service | Container | Host Port(s) | Container Path | Purpose |
|---|---------|-----------|--------------|----------------|---------|
| 1 | webserver | paperless_webserver | 8000 | N/A | Paperless-ngx Web UI and API |
| 2 | db | paperless_db | 5432 | N/A | PostgreSQL (Metadata SOT) |
| 2b | qdrant | paperless_qdrant | 6333 | N/A | Vector Store (Qdrant) |
| 3 | broker | paperless_broker | internal | N/A | Redis message broker |
| 4 | gotenberg | paperless_gotenberg | internal | N/A | PDF conversion |
| 5 | tika | paperless_tika | internal | N/A | Document analysis |
| 6 | paperless-ai | paperless_ai | 3000 | N/A | AI automation bridge and UI |
| 7 | visual-rag | visual_rag | 8001 | containers/visual-rag/ | Visual RAG sidecar (GPU) |
| 8 | bias-engine | bias_engine | 50051, 8003 | containers/bias-engine/ | gRPC logit bias + metrics |
| 9 | guidance-service | guidance-service | 8002 | containers/guidance-service/ | Deterministic JSON extraction |
| 10 | prometheus | paperless_prometheus | 9091 | monitoring/ | Metrics collection |
| 11 | grafana | paperless_grafana | 3001 | monitoring/ | Metrics visualization |
| 12 | text-rag | text_rag | 8004 | containers/text-rag/ | Text semantic search & retrieval |

Notes:
- All Python sidecar containers are located in `containers/` directory
- visual-rag requires NVIDIA GPU support and persists model cache and indices
- guidance-service connects to Ollama via `http://host.docker.internal:11434`
- text-rag provides multilingual text semantic search with 384-dim embeddings

## Key Environment Variables

All runtime variables are centralized in `docker-compose.env` (contains secrets;
do not copy into docs or logs).

| Variable | Default | Description |
|----------|---------|-------------|
| `PAPERLESS_API_URL` | `http://webserver:8000/api` | Paperless-ngx API base URL |
| `PAPERLESS_MEDIA_ROOT` | `/usr/src/paperless/media` | Media path inside paperless-ai |
| `OLLAMA_API_URL` | `http://host.docker.internal:11434` | Host Ollama endpoint |
| `BIAS_ENGINE_URL` | `bias-engine:50051` | gRPC endpoint for bias engine |
| `GUIDANCE_SERVICE_URL` | `http://guidance-service:8002` | Guidance service endpoint |
| `VISUAL_RAG_URL` | `http://visual-rag:8001` | Visual RAG sidecar endpoint |
| `TEXT_RAG_URL` | `http://text-rag:8004` | Text RAG service endpoint |

## Monitoring

- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin)

This codebase will outlive you. Every shortcut you take becomes
someone else's burden. Every hack compounds into technical debt
that slows the whole team down.

You are not just writing code. You are shaping the future of this
project. The patterns you establish will be copied. The corners
you cut will be cut again.

Fight entropy. Leave the codebase better than you found it.