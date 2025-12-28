# paperless-ai

**One-liner**: Local-first document intelligence for paperless-ngx using MOE routing, localized templates, and deterministic extraction.

## Problem
The current pipeline lacks a unified localization strategy for prompts and routing across expert models. This leads to inconsistent responses, higher costs, and degraded output quality when model and prompt languages are misaligned.

## Success Criteria
How we know it worked:
- [ ] Template registry supports EN/DE variants for key intents with deterministic selection by expert native language.
- [ ] Router + translator flow consistently produces aligned prompts (content and template language match model).
- [ ] Evaluation harness and A/B tests confirm improved quality for expert models with EN prompts + EN context.

## Constraints

- Local-first stack (Ollama, Docker Compose) remains the default runtime.
- Must integrate with existing paperless-ngx workflows and guidance-service.
- Avoid breaking existing ingestion and extraction pipelines.

## Out of Scope

- Replacing OCR engines or core paperless-ngx ingestion.
- Full UI redesign or new front-end flows.
