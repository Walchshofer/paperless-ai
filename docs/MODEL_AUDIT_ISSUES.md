# Model Audit Issues

This document catalogs all identified issues from the comprehensive model audit, organized by severity and impact.

## Critical Issues

### 1. Missing Definition: vatExpert Model
**Severity**: Critical - Causes runtime errors
**Location**: `services/prompts/PromptRegistry.js:909`, `services/experts/ExpertRegistry.js:349`
**Description**: `MODEL_NAMES.vatExpert` is referenced in code but not defined in the MODEL_NAMES object (lines 66-79).
**Impact**: Runtime errors when financial pipelines with VAT analysis are executed.
**Recommendation**: Add `vatExpert: process.env.VAT_EXPERT_MODEL || process.env.FINANCIAL_VISION_MODEL || config.expertModels?.financial?.vision || 'llm-pro-finance-8b'` to MODEL_NAMES.

### 2. Naming Inconsistency: Model Case Variations
**Severity**: High - Configuration confusion
**Location**: Documentation vs Code
**Description**:
- Documentation uses `:8B` (uppercase) in `docs/EXPERT_PIPELINE_GUIDE.md:43`
- Code uses `:8b` (lowercase) in `services/prompts/PromptRegistry.js:67`
**Impact**: User confusion, potential configuration mismatches.
**Recommendation**: Standardize all code to lowercase `:8b` format, document conventions clearly.

### 3. Alias Confusion: Multiple Variants for Same Model
**Severity**: Medium - Maintenance burden
**Location**: Throughout codebase
**Description**: Multiple variants exist for same models:
- `llava-med-v1.5` vs `llava-med-v1.5:latest`
- `medtext-llama3` vs `medtext-llama3:latest`
- `qwen3-vl:8b` vs `qwen3-vl:8B`
**Impact**: Code duplication, inconsistent references.
**Recommendation**: Define canonical names and implement alias mapping system.

### 4. Model Type Ambiguity: FINANCIAL_VISION_MODEL
**Severity**: Medium - Semantic confusion
**Location**: Environment variables
**Description**: `FINANCIAL_VISION_MODEL` env var points to text-only model `llm-pro-finance-8b`.
**Impact**: Misleading naming, potential user confusion.
**Recommendation**: Rename to `FINANCIAL_GENERAL_MODEL` for clarity, or clarify that it handles both text and vision tasks.

## Integration Gaps

### 5. Advanced Models Not Integrated
**Severity**: Medium - Feature limitation
**Location**: Model documentation exists but no integration
**Description**: High-value models documented but not wired into pipelines:
- `dragon-finance` (9GB VRAM) - Advanced reasoning for complex analysis
- `gpt-oss` (13GB VRAM) - Reasoning model for agentic tasks
- `nemotron-orchestrator:8b` (8GB) - System 2 router for expert delegation
**Impact**: Missing advanced capabilities for complex document analysis.
**Recommendation**: Create integration roadmap with feature flags for gradual rollout.

### 6. Visual Retrieval Not Integrated
**Severity**: Low - Future feature
**Location**: `docs/model/tomoro-colqwen3.md`
**Description**: `tomoro-colqwen3-embed-8b` (ColPali) documented for Level 2 visual search but not implemented.
**Impact**: Limited visual search capabilities.
**Recommendation**: Integrate as optional sidecar service with PostgreSQL Hybrid RAG.

### 7. Embedding Model Hardcoded
**Severity**: Low - Configuration limitation
**Location**: RAG service
**Description**: `nomic-embed-text-v1.5` used in RAG but not configurable via environment variables.
**Impact**: Cannot switch embedding models without code changes.
**Recommendation**: Add `EMBEDDING_MODEL` env var to config for flexibility.

### 8. Missing Orchestrator Integration
**Severity**: Low - Architecture limitation
**Location**: DocumentProcessor
**Description**: `nemotron-orchestrator` designed as System 2 router but no entry point in processing pipeline.
**Impact**: No intelligent expert routing based on query complexity.
**Recommendation**: Add optional orchestrator mode to DocumentProcessor for expert delegation.

## Resolution Status

| Issue | Status | Resolution Plan | Timeline |
|---|---|---|---|
| vatExpert Definition | Pending | Add to MODEL_NAMES objects | Immediate |
| Naming Inconsistencies | Pending | Standardize to lowercase, update docs | Immediate |
| Alias System | Pending | Implement modelAliases config + resolver utility | Immediate |
| FINANCIAL_VISION_MODEL Rename | Pending | Consider rename in future version | v2.0 |
| Advanced Models Integration | Planned | Phase 2 roadmap implementation | Q2 2025 |
| Visual Retrieval Integration | Planned | Phase 3 infrastructure integration | Q3 2025 |
| Embedding Model Config | Pending | Add EMBEDDING_MODEL env var | Immediate |
| Orchestrator Integration | Planned | Add to DocumentProcessor | Q2 2025 |

## Testing Requirements

After fixes:
1. Verify all MODEL_NAMES properties are defined
2. Test model resolution with aliases
3. Validate financial pipeline with VAT analysis
4. Check for any remaining case sensitivity issues
5. Test advanced model feature flags (when null)

## Migration Impact

- **Breaking Changes**: vatExpert now required for financial pipelines
- **Non-breaking**: Alias system provides backward compatibility
- **Documentation**: Updated naming conventions and configuration guides