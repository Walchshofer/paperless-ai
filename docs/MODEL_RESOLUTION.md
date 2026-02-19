# Model Resolution Service

This document describes the ModelResolutionService utilities and how to use them.

Overview
- Purpose: centralize model alias resolution and tier mapping so callers can request models by alias (case-insensitive) or exact names and get canonical model identifiers in return.

Public API (logical functions provided by `services/utils/modelResolver.js`)
- getModelAliases() -> returns a plain object mapping alias -> canonicalModelName
- resolveModelName(name) -> returns canonical model name for given input (alias or exact name) or null if not found
- getModelTier(modelName) -> returns a tier classification (e.g., 'production', 'expert') if available

Usage
- Prefer `resolveModelName` when accepting freeform user input or configuration values that may use friendly aliases.
- The service reads the effective alias table from the project's `config` object via the safe `getRaw()` accessor when available, ensuring enumerations work even if `config` is a proxied module.

Examples
- resolveModelName('llava-med') -> 'llava-med-v1.6'
- resolveModelName('LLAVA-MED') -> 'llava-med-v1.6'

## Dynamic Registry Pattern (Expert Models)

The system employs a Dynamic Registry Pattern to decouple prompt templates from specific model strings. This is managed via `services/prompts/PromptRegistry.js` and reconciled against the `config.expertModels` Source of Truth.

### Dynamic Resolution Flow
1. **Source of Truth**: `config/config.js` defines the `expertModels` object, pulling from environment variables (e.g., `MEDICAL_VISION_MODEL`).
2. **Registry Mapping**: `PromptRegistry.js` maps logical constants (e.g., `MODEL_NAMES.multimodalVision`) to these config entries.
3. **Runtime Lookup**: API routes (`routes/api/prompts.js`) resolve the model name and its associated limits (context window, token budget) based on the document's domain.

### Advantages
- **Decoupling**: Prompts reference `MODEL_NAMES.multimodalVision` instead of hardcoded strings like `'qwen3-vl:8b'`.
- **Environment Parity**: Swap models across dev/prod by changing a single environment variable without touching code.
- **Failover**: Dynamic lookups allow graceful fallback to general models if an expert model is unavailable.

Notes
- The implementation is case-insensitive for alias lookup.
- Keep the config aliases in `config` updated to maintain expected mappings. Use `config.getRaw('modelAliases')` to access the raw map for enumerations.
- **Source of Truth**: All model assignments and limits MUST be reconciled through `config.expertModels`.

For more details, see `services/utils/modelResolver.js` and `services/prompts/PromptRegistry.js`.