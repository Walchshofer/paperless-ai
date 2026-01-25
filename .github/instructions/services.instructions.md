---
applyTo: "services/**/*.js"
description: Service layer coding standards for paperless-ai
---

# Service Layer Standards

## Service Directory Structure
```
services/
├── experts/           # Expert pipeline stages
├── prompts/           # PromptRegistry and templates
├── guidance/          # Guidance service client
├── ollama/            # Ollama service client
├── rag/               # RAG service client
├── visual-rag/        # Visual RAG service
├── feedback/          # Feedback collection
├── integration/       # External integrations
├── tools/             # Utility tools
└── utils/             # Shared utilities
```

## Service Patterns

### Factory Pattern
Use `aiServiceFactory.js` for creating AI service instances:
```javascript
const service = aiServiceFactory.create(config);
```

### Service Interface
Every service should implement:
- Health check method
- Graceful shutdown
- Error surfacing (not silent failures)

### Ingestion & Qdrant Responsibilities
- Services that ingest or upsert vectors must implement a Qdrant-aware health check that validates collection presence and vector configuration (size/distance).
- On successful Qdrant upsert, services must mirror minimal metadata to Postgres and populate a `vector_id` UUID linking the relational row to the Qdrant point.
- If Qdrant upsert fails, implement a deferred ingest queue and record retryable failure metrics. Do not write embedding vectors into Postgres (respect the no-pgvector runtime rule).

### Cross-Service Communication
- Always propagate `X-Request-Id` header
- Set explicit timeouts
- Handle connection failures gracefully

## Pipeline Contracts

### Stage Responsibilities
- Stages must be deterministic
- Stages must not mutate global state
- Stages must not invoke retries directly
- Orchestration decides recovery, not stages

### Execution Order
Follow `EXPERT_PIPELINE_DECISION_TABLE.md`:
1. Classification (SYS_ROUTER_V1)
2. Orchestration
3. Pre-Vision Normalization
4. Visual OCR (if enabled)
5. Extraction
6. Reasoning (advisory)
7. Validation

## PromptRegistry (services/prompts/)

### Authority Rules
- PromptRegistry is the source of truth
- Guidance is an optional optimization
- Fallback: Guidance → PromptRegistry → JsonRepair

### Prompt Changes
- Preserve output schema guarantees
- Include test update with any prompt change
- Document intended behavior change

## Guidance Client (services/guidance/)

### Fallback Behavior
```javascript
// Always implement fallback chain
try {
    result = await guidanceService.generate(template, vars);
} catch (error) {
    // Fallback to PromptRegistry
    result = await promptRegistry.generate(promptId, vars);
    result = jsonRepair(result);
}
```

### Caching
- Support namespace header for cache isolation
- Cache keys must be deterministic

## Validation (ExtractionValidator.js)

### Severity Levels
- HIGH: Missing required fields
- MEDIUM: Low confidence fields
- LOW: Optional field issues

### Retry Rules
- Retries must be document-scoped
- Maximum 2 retries
- Never retry at stage level manually
