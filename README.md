# Paperless-AI — Intelligent Document Processing

An AI-powered document processing system built on top of [Paperless-ngx](https://github.com/paperless-ngx/paperless-ngx), featuring domain-specific expert pipelines, automatic document normalization, and visual RAG capabilities.

## Features

### 🤖 Expert Pipeline System
- **Multi-domain routing**: Automatic classification and routing to specialized experts (Financial, Medical, Legal, General)
- **Vision-language models**: Uses `qwen3-vl:8b` for multimodal document analysis
- **Structured extraction**: Guidance-based extraction with schema validation
- **Custom field mapping**: Automatic population of Paperless-ngx custom fields

### 📐 Automatic Document Normalization (NEW)
- **Geometry correction**: Automatic rotation, cropping, and rescaling for optimal OCR quality
- **Persistent storage**: Normalized images stored to disk for consistent retrieval
- **Stage 3 integration**: Runs automatically during Expert Pipeline processing
- **Batch processing**: Background jobs for normalizing document backlogs
- **Visual indicators**: Workspace viewer shows normalization status and source

**Benefits**:
- Improved OCR accuracy (15-30% improvement on skewed/rotated documents)
- Better visual RAG retrieval quality
- Consistent document appearance in workspace viewer
- Reduced processing time on subsequent accesses

**Configuration**:
```bash
# Enable/disable automatic normalization
ENABLE_AUTO_NORMALIZATION=true

# Storage location (container path)
NORMALIZED_IMAGES_DIR=/app/data/normalized

# Batch job limit
NORMALIZATION_BATCH_LIMIT=50
```

See [AUTOMATIC_NORMALIZATION_PLAN.md](docs/AUTOMATIC_NORMALIZATION_PLAN.md) for implementation details.

### 🔍 Visual RAG
- **ColQwen3 embeddings**: Multi-vector visual embeddings for layout-aware retrieval
- **Hybrid SOT**: Qdrant as vector source of truth, PostgreSQL for metadata
- **Multi-format support**: PDFs, images, and video frame indexing

### 📊 Monitoring & Observability
- **Prometheus metrics**: Pipeline stages, normalization operations, disk usage
- **Health endpoints**: Real-time status for all services
- **Grafana dashboards**: Pre-configured visualizations (ops setup required)

## Quick Start (Windows)

### Prerequisites
- Docker Desktop with WSL2
- NVIDIA GPU with 24GB VRAM (RTX 3090 Ti recommended)
- Ollama running on host (`http://host.docker.internal:11434`)

### 1. Clone and Configure

```powershell
git clone <repository-url>
cd paperless-ai

# Copy environment template
cp docker-compose.env.example docker-compose.env

# Edit docker-compose.env with your settings
# Key variables: PAPERLESS_API_TOKEN, HF_TOKEN (for private models)
```

### 2. Build and Run

```powershell
# Start all services
docker compose --env-file docker-compose.env up --build

# Or start specific services
docker compose --env-file docker-compose.env up paperless-ai visual-rag qdrant postgres
```

### 3. Verify Services

```powershell
# Check paperless-ai health
curl http://localhost:3000/health

# Check normalization health
curl http://localhost:3000/api/normalization/health

# Check Prometheus metrics
curl http://localhost:3000/metrics | grep paperless_ai_normalization
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Paperless-AI Stack                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────────┐  │
│  │ Paperless-ngx│───▶│ paperless-ai │───▶│ Expert Pipeline │  │
│  │   (Port 8000)│    │  (Port 3000) │    │   (Stage 1-5)   │  │
│  └──────────────┘    └──────────────┘    └─────────────────┘  │
│                              │                      │           │
│                              ▼                      ▼           │
│                    ┌──────────────────┐  ┌──────────────────┐  │
│                    │ Visual RAG       │  │ Normalization    │  │
│                    │ (ColQwen3)       │  │ (Stage 3)        │  │
│                    │ Port 8001        │  │ qwen3-vl:8b      │  │
│                    └──────────────────┘  └──────────────────┘  │
│                              │                      │           │
│                              ▼                      ▼           │
│                    ┌──────────────────┐  ┌──────────────────┐  │
│                    │ Qdrant           │  │ Disk Storage     │  │
│                    │ (Vectors)        │  │ /app/data/       │  │
│                    │ Port 6333        │  │ normalized/      │  │
│                    └──────────────────┘  └──────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Documentation

### Core Architecture
- [ARCHITECTURE_OVERVIEW.md](docs/ARCHITECTURE_OVERVIEW.md) - System architecture
- [EXPERT_PIPELINE_DECISION_TABLE.md](docs/EXPERT_PIPELINE_DECISION_TABLE.md) - Pipeline routing logic
- [PIPELINE_STAGE_CONTRACTS.md](docs/PIPELINE_STAGE_CONTRACTS.md) - Stage contracts (authoritative)

### Features
- [AUTOMATIC_NORMALIZATION_PLAN.md](docs/AUTOMATIC_NORMALIZATION_PLAN.md) - Normalization implementation
- [VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md](docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md) - Visual RAG design
- [QDRANT_MIGRATION.md](docs/QDRANT_MIGRATION.md) - Hybrid SOT architecture

### Configuration
- [ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) - All environment variables (authoritative)
- [EXPERT_PIPELINE_CUSTOM_FIELDS.md](docs/EXPERT_PIPELINE_CUSTOM_FIELDS.md) - Custom fields reference
- [DATABASE_SETUP.md](docs/DATABASE_SETUP.md) - PostgreSQL setup

### Development
- [AGENTS.md](AGENTS.md) - Agent workflow and guardrails
- [CODEX_SERENA_BRIDGE.md](docs/CODEX_SERENA_BRIDGE.md) - Serena integration
- [ERROR_HANDLING.md](docs/ERROR_HANDLING.md) - Error handling patterns

## Testing

```powershell
# Run all tests
npm test

# Run specific test suites
npm test -- test/unit/PreVisionNormalizer.test.js
npm test -- test/integration/normalization-pipeline.test.js

# Run with coverage
npm run test:coverage

# Integration tests (requires sidecar)
npm run test:integration
```

## API Endpoints

### Document Processing
- `POST /api/documents/:id/process` - Process document through Expert Pipeline
- `GET /api/documents/:id/metadata` - Get extracted metadata

### Normalization
- `GET /api/normalized/:docId/:page` - Serve normalized images (persisted or on-demand)
- `GET /api/normalization/health` - Normalization statistics and health
- `POST /api/normalization/trigger` - Manually trigger normalization
- `POST /api/normalization/batch` - Run batch normalization job

### Visual RAG
- `POST /api/visual-rag/query` - Visual similarity search
- `GET /api/visual-rag/normalized/:docId` - On-demand normalized rendering

### Monitoring
- `GET /health` - Service health check
- `GET /metrics` - Prometheus metrics endpoint

## Metrics

### Normalization Metrics
- `paperless_ai_normalization_total` (Counter) - Total operations with labels: `status`, `trigger`
- `paperless_ai_normalization_latency_seconds` (Histogram) - Latency by `stage`
- `paperless_ai_normalization_pending` (Gauge) - Documents pending normalization
- `paperless_ai_normalization_disk_mb` (Gauge) - Disk usage for normalized images

### Pipeline Metrics
- `paperless_ai_pipeline_executions_total` - Pipeline executions
- `paperless_ai_pipeline_duration_seconds` - Pipeline duration
- `paperless_ai_stage_executions_total` - Per-stage execution counts

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

### Key Principles
- **Doc-first**: Update docs before code changes
- **Authoritative docs**: Follow `EXPERT_PIPELINE_DECISION_TABLE.md` and `PIPELINE_STAGE_CONTRACTS.md`
- **79-char limit**: Python code must adhere to Flake8 standards
- **Testing**: All behavior changes require tests (Mocha + Node assert for JS, PyTest for Python)

## License

See [LICENSE](LICENSE) for details.

## Support

- Issues: [GitHub Issues](../../issues)
- Documentation: [docs/](docs/)
- Community: [Discussions](../../discussions)