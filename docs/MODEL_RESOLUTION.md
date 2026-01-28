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

Notes
- The implementation is case-insensitive for alias lookup.
- Keep the config aliases in `config` updated to maintain expected mappings. Use `config.getRaw('modelAliases')` to access the raw map for enumerations.

For more details, see `services/utils/modelResolver.js`.