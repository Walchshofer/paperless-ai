# Model Integration Roadmap

This document outlines the phased integration plan for advanced and infrastructure tier models in the paperless-ai system.

## Phase 1: Production Tier (Current - Complete)

All production tier models are fully integrated and operational:

- ✅ `qwen3-vl:8b` - Document classification and routing
- ✅ `llava-med-v1.6` - Medical imaging analysis
- ✅ `medtext-llama3` - Clinical text extraction
- ✅ `fino1-8b` - Financial calculator (math & numeric extraction)
- ✅ `llm-pro-finance-8b` - Financial reasoning & VAT analysis
- ✅ `sauerkraut-llama3.1:8b` - General purpose German text
- ✅ `llama3.2:latest` - Alternative general purpose (LEGACY)

**Hardware Requirements**: RTX 3080 (10GB VRAM) minimum
**Status**: Production ready

## Phase 2: Advanced Tier Integration (Planned Q2 2025)

Integration of high-value reasoning models for complex analysis scenarios.

### Dragon-Finance Integration
**Model**: `llm-pro-finance-8b` (9GB VRAM)
**Role**: Advanced multilingual reasoning, medical-financial analysis, summarization, implication checking
**Integration Points**:
- Optional stage in medical/financial pipelines for complex cases
- Feature flag: `ENABLE_ADVANCED_REASONING=yes`
- Environment variable: `DRAGON_MODEL=llm-pro-finance-8b`
**Timeline**: Q2 2025
**Hardware Requirements**: RTX 3090 Ti or RTX 4090 (24GB+ VRAM)

### GPT-OSS Integration
**Model**: `gpt-oss` (13GB VRAM)
**Role**: Complex reasoning, chain-of-thought, agentic tool use, coding assistance
**Integration Points**:
- Alternative reasoning engine for complex multi-step queries
- Feature flag: `ENABLE_ADVANCED_REASONING=yes`
- Environment variable: `GPT_OSS_MODEL=gpt-oss`
**Timeline**: Q3 2025
**Hardware Requirements**: RTX 4090 (24GB VRAM)

### Nemotron-Orchestrator Integration (Completed)
**Model**: `nemotron-orchestrator:8b` (8GB VRAM)
**Role**: Task delegation, tool selection, planning, intelligent expert routing
**Integration Points**:
- System orchestrator for pipeline selection and service gating
- Prompt: `SYS_ORCHESTRATOR_V1` (ExpertPipelineExecutor)
- Environment variable: `ORCHESTRATOR_MODEL=nemotron-orchestrator:8b`
**Timeline**: Completed
**Hardware Requirements**: RTX 3090 Ti (24GB VRAM)

## Phase 3: Infrastructure Tier Integration (Planned Q3 2025)

Integration of embedding and retrieval models for enhanced RAG capabilities.

### Tomoro ColQwen3 Visual Retrieval
**Model**: `tomoro-colqwen3-embed-8b` (12GB+ VRAM)
**Role**: Visual retrieval via late interaction, zero-loss document layout preservation
**Integration Points**:
- Level 2 visual search in PostgreSQL Hybrid RAG
- Sidecar service for visual document indexing
- Feature flag: `ENABLE_VISUAL_RETRIEVAL=yes`
- Environment variable: `VISUAL_RETRIEVAL_MODEL=tomoro-colqwen3-embed-8b`
**Timeline**: Q3 2025
**Hardware Requirements**: Dedicated GPU (RTX 3090 Ti or RTX 4090)

### Enhanced Embedding Configuration
**Model**: Configurable embedding models
**Role**: Flexible semantic embedding for RAG
**Integration Points**:
- Environment variable: `EMBEDDING_MODEL=nomic-embed-text-v1.5` (or alternatives)
- Support for multiple embedding providers
- Dynamic embedding model switching
**Timeline**: Q2 2025
**Hardware Requirements**: Minimal (2GB VRAM)

## Hardware Requirements by Configuration

| Configuration | GPU | VRAM | Models Supported | Use Case |
|---|---|---|---|---|
| **Minimal** | RTX 3080 | 10GB | Production tier only | Basic document processing |
| **Standard** | RTX 3090 Ti | 24GB | Production + 1 advanced | Advanced analysis with reasoning |
| **Advanced** | RTX 4090 | 24GB | Production + 2 advanced | Full reasoning capabilities |
| **Full Stack** | Dual RTX 4090 | 48GB | All tiers | Complete ecosystem with visual retrieval |

## Implementation Strategy

### Feature Flags Approach
All advanced features use feature flags for gradual rollout:
```bash
# Phase 2 features
ENABLE_ADVANCED_REASONING=yes
ENABLE_ORCHESTRATOR=yes

# Phase 3 features
ENABLE_VISUAL_RETRIEVAL=yes
```

### Backward Compatibility
- All existing configurations continue to work
- New features are opt-in via environment variables
- Graceful degradation when advanced models unavailable

### Testing Strategy
- Unit tests for each model integration
- Performance benchmarks comparing with/without advanced models
- Memory usage monitoring and optimization
- Fallback testing when models unavailable

## Risk Mitigation

### Hardware Constraints
- VRAM monitoring and automatic model offloading
- Concurrent request limiting based on available resources
- Model warm-up and caching strategies

### Performance Impact
- Asynchronous processing for heavy models
- Request queuing and prioritization
- Caching of common inferences

### Reliability
- Health checks for all models
- Automatic fallback to simpler models
- Circuit breaker patterns for model failures

## Success Metrics

### Phase 2 Success Criteria
- Dragon-Finance improves complex medical analysis accuracy by 15%
- GPT-OSS reduces multi-step reasoning failures by 20%
- Nemotron-Orchestrator improves expert selection accuracy by 25%

### Phase 3 Success Criteria
- Visual retrieval improves document finding precision by 30%
- Configurable embeddings support 3+ embedding providers
- RAG performance improves by 20% with visual search

## Dependencies

### Phase 2 Dependencies
- Model quantization for VRAM efficiency
- Advanced prompt engineering for reasoning models
- Integration testing framework for complex pipelines

### Phase 3 Dependencies
- PostgreSQL vector extension optimization
- Visual indexing pipeline development
- Multi-modal RAG architecture design

## Timeline Summary

- **Q1 2025**: Planning and architecture design
- **Q2 2025**: Phase 2 advanced model integration
- **Q3 2025**: Phase 3 infrastructure integration
- **Q4 2025**: Performance optimization and production hardening
