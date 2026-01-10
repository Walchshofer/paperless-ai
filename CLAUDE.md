# Claude Code Project Memory

## Multi-container Docker setup

The Docker deployment files for this project live outside this repository:

- **docker-compose.env**: `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env`
- **docker-compose.yml**: `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml`

This compose file defines the full multi-container stack for Paperless-ngx plus
paperless-ai and its AI sidecars. paperless-ai is built from `../paperless-ai`,
and the Visual RAG sidecar is built from
`../paperless-ai/services/visual-rag-sidecar`.

### Build Context Strategy
The Visual RAG sidecar uses a **parent-directory build context** to enable access to both repositories:

```yaml
visual-rag:
  build:
    context: ..  # Parent directory (contains both paperless-ai and paperless-ngx)
    dockerfile: paperless-ai/services/visual-rag-sidecar/Dockerfile
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

| # | Service | Container | Host Port(s) | Purpose |
|---|---------|-----------|--------------|---------|
| 1 | webserver | paperless_webserver | 8000 | Paperless-ngx Web UI and API |
| 2 | db | paperless_db | 5432 | PostgreSQL with pgvector |
| 3 | broker | paperless_broker | internal | Redis message broker |
| 4 | gotenberg | paperless_gotenberg | internal | PDF conversion |
| 5 | tika | paperless_tika | internal | Document analysis |
| 6 | paperless-ai | paperless_ai | 3000 | AI automation bridge and UI |
| 7 | visual-rag | visual_rag | 8001 | Visual RAG sidecar (GPU) |
| 8 | bias-engine | bias_engine | 50051, 8003 | gRPC logit bias + metrics |
| 9 | guidance-service | guidance-service | 8002 | Deterministic JSON extraction |
| 10 | prometheus | paperless_prometheus | 9091 | Metrics collection |
| 11 | grafana | paperless_grafana | 3001 | Metrics visualization |

Notes:
- visual-rag requires NVIDIA GPU support and persists model cache and indices.
- guidance-service connects to Ollama via `http://host.docker.internal:11434`.

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

## Monitoring

- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin)
