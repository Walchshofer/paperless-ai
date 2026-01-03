# Environment Variables Reference

This document provides a complete reference for all environment variables used in the paperless-ai system, with a focus on model configuration.

## Model Configuration Environment Variables

### Production Tier - Router/Classification
- `PLANNER_MODEL` - Multimodal planner for visual classification (default: `qwen3-vl:8b`)
- `ROUTER_MODEL` - Expert pipeline router model (default: `qwen3-vl:8b`)
- `OLLAMA_VISION_MODEL` - Default vision model for Ollama (default: `qwen3-vl:8b`)

### Router Retry Configuration
- `ROUTER_MAX_RETRIES` - Maximum retry attempts for router classification (default: `3`)
- `ROUTER_RETRY_BASE_DELAY` - Base delay in milliseconds for exponential backoff (default: `1000`)
- `ROUTER_RETRY_MAX_DELAY` - Maximum delay cap in milliseconds for exponential backoff (default: `10000`)
- `ROUTER_ENABLE_MODEL_CHECK` - Enable pre-flight model availability check (default: `yes`)
- `ROUTER_MODEL_CHECK_TIMEOUT` - Timeout for model availability check in milliseconds (default: `5000`)

Adjust these values when operating in high-latency or resource-constrained environments. For example, reduce `ROUTER_RETRY_BASE_DELAY` for faster transient retry cycles in CI tests, or increase `ROUTER_MAX_RETRIES` for unstable network conditions.

### Production Tier - Medical Domain
- `MEDICAL_VISION_MODEL` - Medical imaging analysis model (default: `llava-med-v1.6`)
- `MEDICAL_ANALYSIS_MODEL` - Clinical text extraction model (default: `medtext-llama3`)
- `MEDICAL_RADIOLOGY_MODEL` - Radiology imaging analysis model (default: `llava-med-v1.6`)

### Production Tier - Financial Domain
- `FINANCIAL_ANALYSIS_MODEL` - Financial reasoning and math validation model (default: `fino1-8b`)
- `FINANCIAL_VISION_MODEL` - Financial extraction and multilingual analysis model (default: `llm-pro-finance-8b`)
- `VAT_EXPERT_MODEL` - VAT compliance and tax analysis model (default: uses `FINANCIAL_VISION_MODEL`)

### Production Tier - General Purpose
- `GENERAL_MODEL` - General fallback model for unclassified documents (default: `sauerkraut-llama3.1:8b`)
- `OLLAMA_MODEL` - Default text model for Ollama (default: `sauerkraut-llama3.1:8b`)

### Advanced Tier - Reasoning Models (Optional, Feature-Flagged)
- `DRAGON_MODEL` - Advanced multilingual reasoning model for complex analysis (default: null, planned: `llm-pro-finance-8b`)
- `GPT_OSS_MODEL` - OpenAI-compatible reasoning model for agentic tasks (default: null, planned: `gpt-oss`)
- `ENABLE_ADVANCED_REASONING` - Feature flag to enable advanced reasoning models (default: `no`)

### Infrastructure Tier - Orchestration & Embeddings
- `ORCHESTRATOR_MODEL` - System orchestration and routing model (default: `nemotron-orchestrator:8b`)
- `EMBEDDING_MODEL` - Semantic embedding model for RAG (default: `nomic-embed-text-v1.5`)
- `VISUAL_RETRIEVAL_MODEL` - Visual document retrieval model (default: null, planned: `tomoro-colqwen3-embed-8b`)
- `ENABLE_VISUAL_RETRIEVAL` - Feature flag for visual search capabilities (default: `no`)
- `ENABLE_ORCHESTRATOR` - Feature flag for intelligent expert routing (default: `no`)
- `ORCHESTRATOR_PREVISION_NORMALIZATION_ENABLED` - Enable pre-vision image normalization tool calls (default: `no`, inherits `ORCHESTRATOR_PREVISION_TOOLS_ENABLED`)

### Guidance Service Configuration
- `GUIDANCE_MODEL` - Model for structured extraction in guidance-service (default: `sauerkraut-llama3.1:8b`)
- `OLLAMA_API_URL` - Ollama API endpoint for guidance-service container (default: `http://host.docker.internal:11434`)
  - For Docker Desktop (Windows/Mac): Use `http://host.docker.internal:11434`
  - For Docker Compose service networking: Use `http://ollama:11434` (if Ollama runs as a service named 'ollama')
  - For host network mode: Use `http://localhost:11434`

## OpenAI Integration Variables

### Model Configuration
- `OPENAI_MODEL` - OpenAI model to use as alternative provider (default: `gpt-4o-mini`)
- `OPENAI_API_KEY` - OpenAI API key for authentication (required for OpenAI features)
- `OPENAI_BASE_URL` - Custom OpenAI API base URL (optional)

### Service Configuration
- `ENABLE_OPENAI_FALLBACK` - Enable OpenAI as fallback when Ollama models fail (default: `yes`)
- `OPENAI_MAX_TOKENS` - Maximum tokens for OpenAI requests (default: `4096`)
- `OPENAI_TEMPERATURE` - Temperature setting for OpenAI models (default: `0.7`)

## Ollama Configuration Variables

### Connection Settings
- `OLLAMA_HOST` - Ollama server host (default: `http://localhost:11434`)
- `OLLAMA_TIMEOUT` - Request timeout in milliseconds (default: `300000`)

### Context Window and Token Limits
- `OLLAMA_CONTEXT_WINDOW` - Context window for text models (default: falls back to `TOKEN_LIMIT`)
- `OLLAMA_MAX_RESPONSE_TOKENS` - Max response tokens for text models (default: falls back to `RESPONSE_TOKENS`)
- `OLLAMA_VISION_CONTEXT_WINDOW` - Context window for vision models (default: falls back to `OLLAMA_CONTEXT_WINDOW`)
- `OLLAMA_VISION_MAX_RESPONSE_TOKENS` - Max response tokens for vision models (default: `2048`)
- `OLLAMA_PLANNER_CONTEXT_WINDOW` - Context window for planner/classifier models (default: falls back to `OLLAMA_VISION_CONTEXT_WINDOW`)
- `OLLAMA_PLANNER_MAX_RESPONSE_TOKENS` - Max response tokens for planner/classifier models (default: `700`)
- `OLLAMA_EXPERT_CONTEXT_WINDOW` - Context window for expert pipeline models (default: falls back to `OLLAMA_CONTEXT_WINDOW`)
- `OLLAMA_EXPERT_MAX_RESPONSE_TOKENS` - Max response tokens for expert pipeline models (default: falls back to `OLLAMA_MAX_RESPONSE_TOKENS`)
- `OLLAMA_VISION_IMAGE_TOKENS` - Token overhead per image for vision prompts (default: `1024`)
- `OLLAMA_MODEL_LIMITS_JSON` - JSON map of per-model overrides for context/response tokens (default: `{}`)
- `TRANSLATION_CONTEXT_WINDOW` - Context window for local translation (default: falls back to `OLLAMA_CONTEXT_WINDOW`)
- `TRANSLATION_MAX_TOKENS` - Max response tokens for local translation (default: `512`)

### Model Loading
- `OLLAMA_LOAD_MODELS` - Comma-separated list of models to preload on startup (optional)
- `OLLAMA_KEEP_ALIVE` - Keep-alive duration for loaded models (default: `5m`)

## System Configuration Variables

### Hardware and Performance
- `MAX_CONCURRENT_REQUESTS` - Maximum concurrent model requests (default: `3`)  
- `GPU_DEVICE` - GPU device ID for CUDA (default: `0`)
- `ENABLE_GPU` - Enable GPU acceleration (default: `yes`)

### Tag Governance
- `PIPELINE_TAG_REPLACE` - Allow clearing all tags when no existing tags resolve (default: `no`)

### Logging and Monitoring
- `LOG_LEVEL` - Logging level (default: `info`)
- `ENABLE_MODEL_METRICS` - Enable model performance metrics collection (default: `yes`)
- `METRICS_RETENTION_DAYS` - Days to retain metrics data (default: `30`)

## Database Configuration Variables

### PostgreSQL Connection
- `DATABASE_URL` - PostgreSQL connection string (required for RAG features)
- `DB_SSL` - Enable SSL for database connections (default: `false`)
- `DB_MAX_CONNECTIONS` - Maximum database connections (default: `10`)

### RAG Configuration
- `RAG_CHUNK_SIZE` - Text chunk size for embedding (default: `512`)
- `RAG_OVERLAP` - Chunk overlap size (default: `50`)
- `RAG_TOP_K` - Number of similar documents to retrieve (default: `5`)
- `RAG_SIMILARITY_THRESHOLD` - Minimum similarity score (default: `0.7`)

### PostgreSQL + pg_vector Configuration

- `POSTGRES_HOST` - PostgreSQL server host (default: `db` for Docker, `localhost` for host)
- `POSTGRES_PORT` - PostgreSQL server port (default: `5432`)
- `POSTGRES_DB` - Database name (default: `paperless`)
- `POSTGRES_USER` - Database username (required, fallback: `PAPERLESS_DBUSER`)
- `POSTGRES_PASSWORD` - Database password (required, fallback: `PAPERLESS_DBPASS`)
- `PAPERLESS_DBHOST` - Paperless-NGX database host (fallback for `POSTGRES_HOST`)
- `PAPERLESS_DBPORT` - Paperless-NGX database port (fallback for `POSTGRES_PORT`)
- `PAPERLESS_DBNAME` - Paperless-NGX database name (fallback for `POSTGRES_DB`)
- `PAPERLESS_DBUSER` - Paperless-NGX database user (fallback for `POSTGRES_USER`)
- `PAPERLESS_DBPASS` - Paperless-NGX database password (fallback for `POSTGRES_PASSWORD`)

**Requirements:**
- PostgreSQL 16+ with pg_vector extension
- Docker image: `pgvector/pgvector:pg16`
- User must have CREATE EXTENSION privilege

**Troubleshooting:**
- Check health: `curl http://localhost:3000/health/database`
- Verify extension: `docker exec paperless_db psql -U <user> -d <db> -c "SELECT extversion FROM pg_extension WHERE extname = 'vector'"`
- See `docs/DATABASE_SETUP.md` for detailed troubleshooting guide

## Security and Access Control

### Authentication
- `JWT_SECRET` - JWT signing secret (required)
- `SESSION_TIMEOUT` - Session timeout in minutes (default: `480`)
- `ENABLE_AUTH` - Enable authentication (default: `yes`)

### API Security
- `API_KEY` - API key for external service access (optional)
- `CORS_ORIGIN` - CORS allowed origins (default: `*`)
- `RATE_LIMIT_REQUESTS` - Rate limit requests per minute (default: `100`)

## Feature Flags

### Experimental Features
- `ENABLE_BETA_FEATURES` - Enable beta/experimental features (default: `no`)
- `ENABLE_DEBUG_MODE` - Enable debug logging and features (default: `no`)

### Integration Features
- `ENABLE_SLACK_INTEGRATION` - Enable Slack notifications (default: `no`)
- `ENABLE_TELEGRAM_INTEGRATION` - Enable Telegram bot integration (default: `no`)
- `ENABLE_WEBHOOKS` - Enable webhook notifications (default: `no`)

## Example Configuration Files

### Minimal Production Configuration (.env)
```bash
# Basic model configuration
PLANNER_MODEL=qwen3-vl:8b
ROUTER_MODEL=qwen3-vl:8b
ORCHESTRATOR_MODEL=nemotron-orchestrator:8b
OLLAMA_MODEL=sauerkraut-llama3.1:8b
OLLAMA_VISION_MODEL=qwen3-vl:8b

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/paperless

# Security
JWT_SECRET=your-secret-key-here
```

### Full Production Configuration (.env)
```bash
# Production tier models
PLANNER_MODEL=qwen3-vl:8b
ROUTER_MODEL=qwen3-vl:8b
ORCHESTRATOR_MODEL=nemotron-orchestrator:8b
MEDICAL_VISION_MODEL=llava-med-v1.6
MEDICAL_ANALYSIS_MODEL=medtext-llama3
FINANCIAL_ANALYSIS_MODEL=fino1-8b
FINANCIAL_VISION_MODEL=llm-pro-finance-8b
GENERAL_MODEL=sauerkraut-llama3.1:8b

# Advanced tier (optional)
ENABLE_ADVANCED_REASONING=yes
DRAGON_MODEL=llm-pro-finance-8b
GPT_OSS_MODEL=gpt-oss

# Infrastructure
EMBEDDING_MODEL=nomic-embed-text-v1.5
ENABLE_VISUAL_RETRIEVAL=yes
VISUAL_RETRIEVAL_MODEL=tomoro-colqwen3-embed-8b

# OpenAI fallback
OPENAI_API_KEY=sk-your-key-here
ENABLE_OPENAI_FALLBACK=yes

# Hardware
MAX_CONCURRENT_REQUESTS=5
GPU_DEVICE=0

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/paperless
RAG_CHUNK_SIZE=512
RAG_TOP_K=5

# Security
JWT_SECRET=your-secure-secret-here
API_KEY=your-api-key
RATE_LIMIT_REQUESTS=100
```

## Model Alias Support

The system supports model aliases for flexibility. Instead of canonical names, you can use shorter aliases:

```bash
# Using aliases
PLANNER_MODEL=qwen3-vl
ROUTER_MODEL=qwen3-vl
MEDICAL_VISION_MODEL=llava-med
FINANCIAL_ANALYSIS_MODEL=fino1

# Equivalent to canonical names
PLANNER_MODEL=qwen3-vl:8b
ROUTER_MODEL=qwen3-vl:8b
MEDICAL_VISION_MODEL=llava-med-v1.6
FINANCIAL_ANALYSIS_MODEL=fino1-8b
```

See `docs/MODEL_INVENTORY.md` for complete alias mappings.
