# External API Integration Research Summary

External API feature enables enrichment of AI prompts with data from HTTP endpoints, but a config naming bug may prevent transform functions from executing.

## Key Findings

- **Complete Feature Coverage**: All 4 AI services (Ollama, OpenAI, Custom, Azure) support external API data with identical prompt enrichment pattern: `systemPrompt += "\n\nAdditional context from external API:\n" + data`
- **500-Token Hard Limit**: External data is capped at 500 tokens across all services (hardcoded, not configurable), with automatic truncation if exceeded
- **Transform Bug Discovered**: Config stores `transformationTemplate` but service destructures `transform` - transforms may silently fail; needs verification before relying on this feature
- **Four-Layer Error Handling**: Config parse, fetch, integration, and AI service stages all have defensive try/catch - failures degrade gracefully to null data, never break document processing

## Decisions Needed

1. **Transform Bug**: Should we verify and potentially fix the `transformationTemplate` vs `transform` naming mismatch before designing prompts that rely on transforms?
2. **500-Token Limit**: Is 500 tokens sufficient for planned external API use cases, or should this be made configurable?
3. **Security Model**: Is `new Function()` acceptable for transform execution, or should predefined transform templates be considered?

## Blockers

- None blocking research completion
- Transform functionality should be verified before prompt 002 relies on it

## Next Step

Proceed to prompt 002 with understanding that:
1. External data is appended to system prompt with "Additional context from external API:" header
2. Design external APIs to return concise, prompt-ready data (under 500 tokens)
3. Reference external context explicitly in SYSTEM_PROMPT for best results
4. Test transform functionality before depending on it
