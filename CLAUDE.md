# Claude Code Project Memory

## Docker Configuration

The Docker deployment files for this project are located outside this repository:

- **docker-compose.env**: `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env`
- **docker-compose.yml**: `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml`

These files control the full paperless-ai stack configuration.

## Service Architecture

| # | Service | Container | Port | Purpose |
|---|---------|-----------|------|---------|
| 1 | webserver | paperless_webserver | 8000 | Paperless-ngx Web UI & API |
| 2 | db | paperless_db | 5432 | PostgreSQL with pgvector |
| 3 | broker | paperless_broker | - | Redis message broker |
| 4 | gotenberg | paperless_gotenberg | - | PDF conversion |
| 5 | tika | paperless_tika | - | Document analysis |
| 6 | paperless-ai | paperless_ai | 3000 | AI automation bridge |
| 7 | visual-rag | visual_rag | 8001 | Vision pipeline |
| 8 | bias-engine | bias_engine | 50051, 8003 | gRPC logit bias for constrained generation |
| 9 | guidance-service | guidance-service | 8002 | Deterministic JSON extraction |
| 10 | prometheus | paperless_prometheus | 9091 | Metrics collection |
| 11 | grafana | paperless_grafana | 3001 | Metrics visualization |

## Key Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BIAS_ENGINE_URL` | `bias-engine:50051` | gRPC endpoint for bias engine |
| `BIAS_ENGINE_ENABLED` | `yes` | Enable constrained generation |
| `TOKENIZER_MODEL` | `gpt2` | Tokenizer for bias computation |
| `GUIDANCE_SERVICE_URL` | `http://guidance-service:8002` | Guidance service endpoint |
| `VISUAL_RAG_URL` | `http://visual-rag:8001` | Visual RAG endpoint |

## Monitoring

- **Prometheus**: http://localhost:9091
- **Grafana**: http://localhost:3001 (admin/admin)
