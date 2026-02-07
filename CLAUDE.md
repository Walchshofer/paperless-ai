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
- broker (Redis) serves dual purpose: Paperless-ngx message queue + Visual Query Cache

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
| `REDIS_URL` | `redis://broker:6379` | Redis endpoint for Visual Query Cache |

### Ollama Model Token Limits

Configurable via Developer Settings UI (`/settings` > Developer Settings > Ollama Model Limits):

| Variable | Default | Tier | Description |
|----------|---------|------|-------------|
| `OLLAMA_CONTEXT_WINDOW` | 128000 | Text (Base) | Context window for text models |
| `OLLAMA_MAX_RESPONSE_TOKENS` | 4096 | Text (Base) | Max response tokens for text models |
| `OLLAMA_VISION_CONTEXT_WINDOW` | 32768 | Vision | Context window for vision models (capped 32k) |
| `OLLAMA_VISION_MAX_RESPONSE_TOKENS` | 2048 | Vision | Max response tokens for vision models |
| `OLLAMA_VISION_IMAGE_TOKENS` | 1024 | Vision | Token overhead per image in vision context |
| `OLLAMA_PLANNER_CONTEXT_WINDOW` | 32768 | Planner | Context window for planner models (capped 32k) |
| `OLLAMA_PLANNER_MAX_RESPONSE_TOKENS` | 2048 | Planner | Max response tokens for planner models |
| `OLLAMA_EXPERT_CONTEXT_WINDOW` | 128000 | Expert | Context window for expert models |
| `OLLAMA_EXPERT_MAX_RESPONSE_TOKENS` | 4096 | Expert | Max response tokens for expert models |
| `TRANSLATION_CONTEXT_WINDOW` | 128000 | Translation | Context window for translation models |

**Note**: These limits apply to locally-hosted Ollama models only. Cloud providers (OpenAI, Azure) manage their own token limits.

## Visual Query Cache

Visual RAG queries are cached in Redis to reduce latency and improve performance.

### Cache Strategy
- **Storage**: Redis (reuses `broker` service)
- **Key Format**: SHA256(query + documentId + domain)
- **TTL**: 24 hours
- **Eviction**: LRU (Least Recently Used)

### Implementation
- **Service**: `VisualQueryCache` (`services/visual-rag-client/VisualQueryCache.js`)
- **Integration**: All `VisualSearchClient` methods (search, searchImage, searchImageAlpha9)
- **Graceful Degradation**: Cache failures don't break queries

### Statistics
```javascript
const stats = visualSearchClient.getCacheStats();
// { hits, misses, hitRate, totalRequests, enabled, connected }
```

### Performance Targets
- Cache hit rate > 60%
- Latency reduction > 50% on cache hits
- Cache lookup overhead < 5ms

### Configuration
```bash
# Enable/disable caching (default: enabled)
const client = new VisualSearchClient({ cacheEnabled: true });

# Redis connection
REDIS_URL=redis://broker:6379
```

## Prompts Management API

Admin-only API for managing expert pipeline prompt templates.

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prompts` | List all registered prompts with domain counts |
| GET | `/api/prompts/:id` | Get specific prompt by ID |
| PUT | `/api/prompts/:id` | Update prompt (systemPrompt, userTemplate, config) |
| POST | `/api/prompts/:id/reset` | Reset prompt to built-in default |

### Prompt Structure

```javascript
{
  id: "SYS_ROUTER_V1",
  version: "1.0.0",
  domain: "System",  // System | Medical | Financial | Legal | General
  model: "qwen3-vl:8b",
  modelType: "multimodal",  // multimodal | text_only
  systemPrompt: "...",
  userTemplate: "...",  // Uses {{variable}} syntax
  config: {
    temperature: 0.2,
    maxTokens: 2048,
    topK: 40,
    topP: 0.9
  },
  templateVariables: ["source_system", "filename", ...],
  isModified: false  // true if custom override exists
}
```

### Persistence

- **Storage**: `data/prompts.json`
- **Load Time**: Server startup (`server.js:1465-1490`)
- **Format**: `{ overrides: { PROMPT_ID: { systemPrompt, userTemplate, config } }, metadata: { lastModified } }`
- **UI**: `/settings` > Prompts (admin-only)

### UI Features

- Domain-grouped accordion (System, Medical, Financial, Legal, General)
- Inline editor with template variable detection
- Modified indicator (orange dot) for customized prompts
- Save Changes / Reset to Default actions
- Unsaved changes warning

**Implementation**:
- API: `C:\Users\pwalc\MyApps\paperless-ai\routes\api\prompts.js`
- UI: `C:\Users\pwalc\MyApps\paperless-ai\src\islands\PromptsSettingsIsland.tsx`
- Contract: `C:\Users\pwalc\MyApps\paperless-ai\src\ui\contracts\Settings.Prompts.contract.ts`

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