# PromptFactory → PromptRegistry Migration Guide

Purpose: show straightforward migration patterns from legacy `PromptFactory` helpers to `PromptRegistry`.

## Key Patterns

1. buildTextPrompt(content, fields, options)
   - Migrates to: `promptRegistry.get(promptId)` + `promptRegistry.buildMessages(promptId, variables)`
   - Example:

```javascript
// Legacy
const { prompt, systemPrompt } = promptFactory.buildTextPrompt(content, fields, options);
const response = await ollama.callModel(config.ollama.model, [systemPrompt, prompt], {});

// Modern
const messages = promptRegistry.buildMessages('EXTRACTION_TEXT_V1', { ...fields, content });
const opts = promptRegistry.getOptions('EXTRACTION_TEXT_V1');
const response = await ollama.callModel(opts.model || MODEL_NAMES.general, messages, opts);
```

2. Vision prompts
   - Pass images to `buildMessages(promptId, variables, imageData)`

3. Medical prompts
   - Use `registerMedicalPrompts(promptRegistry)` during initialization and call `buildMessages()` with appropriate promptId (e.g. `MED_RADIOLOGY_V1`).

## Best practices
- Use `MODEL_NAMES` constants from `services/experts/ExpertRegistry.js` or `promptRegistry` model registry rather than hardcoded model strings.
- Keep all model names in lowercase (e.g., `qwen3-vl:8b`).
- Add tests that assert your migrated code calls `promptRegistry.getOptions()` and `buildMessages()` and pass image buffers explicitly for multimodal prompts.

## Checklist for migration
- [ ] Replace PromptFactory calls with PromptRegistry.get + buildMessages
- [ ] Replace hardcoded model strings with MODEL_NAMES or config values
- [ ] Ensure template variables use `{{variable}}` and `buildMessages()` handles substitution
- [ ] Add/adjust tests to reference `services/prompts/PromptRegistry.js`

