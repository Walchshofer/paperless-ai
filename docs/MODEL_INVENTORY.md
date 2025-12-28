# Model Inventory

This document provides a comprehensive inventory of all models used in the paperless-ai system, organized by tier and domain.

## Production Tier (Active in Expert Pipelines)

These models are fully integrated and production-ready:

| Canonical Name | Aliases | Role | Domain | Type | VRAM | Status | Config Keys | Used In |
|---|---|---|---|---|---|---|---|---|
| `qwen3-vl:8b` | `qwen3-vl`, `qwen3-vl:8B` | Document classification, visual routing, OCR, handwriting recognition | System/General | Multimodal | 10GB | Active | `PLANNER_MODEL`, `ROUTER_MODEL`, `ollama.visionModel`, `ollama.plannerModel`, `ollama.routerModel` | SYS_ROUTER_V1, ExpertRegistry, PromptRegistry |
| `llava-med-v1.5` | `llava-med`, `llava-med-v1.5:latest` | Medical imaging analysis (X-ray, CT, MRI, ultrasound, microscopy) | Medical | Multimodal | 9GB | Active | `MEDICAL_VISION_MODEL`, `MEDICAL_RADIOLOGY_MODEL` | MED_RADIOLOGY_V1, ExpertRegistry |
| `medtext-llama3` | `medtext`, `medtext-llama3:latest` | Clinical text extraction, medical coding (ICD-10), entity recognition | Medical | Text | 6GB | Active | `MEDICAL_ANALYSIS_MODEL` | MED_DOCTOR_V1, MED_INTEGRATOR_V1, ExpertRegistry |
| `fino1-8b` | `fino1`, `fino1-8b-q8` | Financial reasoning, mathematical validation, table extraction, OCR correction | Financial | Text | 6GB | Active | `FINANCIAL_ANALYSIS_MODEL` | FIN_REASONER_V1, ExpertRegistry |
| `llm-pro-finance-8b` | `llm-pro-finance` | Financial extraction, multilingual finance, regulatory analysis, VAT compliance | Financial | Text | 6GB | Active | `FINANCIAL_VISION_MODEL`, `VAT_EXPERT_MODEL` | FIN_EXTRACT_V1, FIN_VAT_EXPERT_V1, ExpertRegistry |
| `sauerkraut-llama3.1:8b` | `sauerkraut`, `llama3.1` | German language general purpose, polite correspondence, fallback | General | Text | 6GB | Active | `OLLAMA_MODEL`, `GENERAL_MODEL` | GEN_FALLBACK_V1, config.js default |
| `llama3.2:latest` | `llama3.2`, `llama3` | General document processing fallback (alternative to sauerkraut) | General | Text | 6GB | Legacy | Alternative for general model | Tests, future implementations |

## Advanced Tier (Active/Optional Reasoning Models)

High-value reasoning models for complex analysis:

| Canonical Name | Aliases | Role | Domain | Type | VRAM | Status | Config Keys | Documentation |
|---|---|---|---|---|---|---|---|---|
| `dragon-finance` | `dragon`, `dragon-llm` | Advanced multilingual reasoning, medical-financial analysis, summarization, implication checking | Financial/Medical | Text (Reasoning) | 9GB | Documented | `DRAGON_MODEL` | `docs/model/dragon-finance.md` |
| `gpt-oss` | `gpt-oss-20b` | Complex reasoning, chain-of-thought, agentic tool use, coding | General | Text (Reasoning) | 13GB | Documented | `GPT_OSS_MODEL` | `docs/model/gpt-oss.md` |
| `nemotron-orchestrator:8b` | `nemotron`, `orchestrator` | Task delegation, tool selection, planning, expert routing | System | Text | 8GB | Active | `ORCHESTRATOR_MODEL` | `docs/model/nemotron-orchestrator.md` |

## Infrastructure Tier (Embedding & Retrieval)

Supporting models for RAG and vector search:

| Canonical Name | Aliases | Role | Domain | Type | VRAM | Status | Config Keys | Documentation |
|---|---|---|---|---|---|---|---|---|
| `nomic-embed-text-v1.5` | `nomic-embed` | Semantic embedding for PostgreSQL Hybrid RAG, vector similarity search | System | Embedding | 2GB | Active (RAG) | `EMBEDDING_MODEL` | PostgreSQL Hybrid RAG, document_embeddings table |
| `tomoro-colqwen3-embed-8b` | `tomoro`, `colqwen3` | Visual retrieval via late interaction, zero-loss document layout preservation | System | Embedding (Vision) | 12GB+ | Documented | `VISUAL_RETRIEVAL_MODEL` | `docs/model/tomoro-colqwen3.md` |

## OpenAI Models (Alternative Provider)

| Canonical Name | Aliases | Role | Domain | Type | VRAM | Status | Config Keys | Used In |
|---|---|---|---|---|---|---|---|---|
| `gpt-4o-mini` | `gpt-4o-mini` | OpenAI general purpose | General | Text | N/A | Active | `OPENAI_MODEL` | setupService, chatService |
| `gpt-4o` | `gpt-4o` | OpenAI advanced multimodal | General | Multimodal | N/A | Supported | None | serviceUtils compatibility list |
| `gpt-4o-audio-preview` | `gpt-4o` | OpenAI audio processing | General | Multimodal | N/A | Supported | None | serviceUtils compatibility list |

## Model Dependencies and Requirements

### Hardware Requirements by Configuration

| Configuration | GPU | VRAM | Models Supported |
|---|---|---|---|
| Minimal | RTX 3080 | 10GB | Production tier only |
| Standard | RTX 3090 Ti | 24GB | Production + 1 advanced |
| Advanced | RTX 4090 | 24GB | Production + 2 advanced |
| Full Stack | Dual RTX 4090 | 48GB | All tiers |

### Domain Coverage Matrix

| Domain | Production Models | Advanced Models | Infrastructure |
|---|---|---|---|
| Medical | llava-med-v1.5, medtext-llama3 | dragon-finance | nomic-embed-text-v1.5 |
| Financial | fino1-8b, llm-pro-finance-8b | dragon-finance | nomic-embed-text-v1.5 |
| General | sauerkraut-llama3.1:8b | gpt-oss | nomic-embed-text-v1.5 |
| System | qwen3-vl:8b | nemotron-orchestrator:8b | tomoro-colqwen3-embed-8b |

## Configuration and Aliases

Model aliases are configured in `config.modelAliases` for backward compatibility and flexibility. All canonical names use lowercase with explicit version tags.
