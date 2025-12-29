# Environment Variables Reference

This document provides a complete reference for all environment variables used in the paperless-ai system, with a focus on model configuration.

## Model Configuration Environment Variables

### Production Tier - Router/Classification
- `PLANNER_MODEL` - Multimodal planner for visual classification (default: `qwen3-vl:8b`)
- `ROUTER_MODEL` - Expert pipeline router model (default: `qwen3-vl:8b`)
- `OLLAMA_VISION_MODEL` - Default vision model for Ollama (default: `qwen3-vl:8b`)

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
