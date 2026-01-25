---
applyTo: "**/*.js"
description: JavaScript coding standards for paperless-ai Node.js codebase
---

# JavaScript Coding Standards

## General Principles
- Prefer explicit, deterministic logic over cleverness
- Avoid implicit behavior changes; if behavior changes, update docs first
- Preserve pipeline precedence and fallback contracts

## Code Style (Prettier Config)
- Use semicolons: `true`
- Use single quotes: `true`
- Tab width: 2 spaces
- Trailing commas: ES5 style

## ESLint Configuration
- Source type: CommonJS (`require`/`module.exports`)
- Globals: Node.js + Browser
- Prettier integration enabled

## Logging & Observability
- No silent fallbacks: always log reason codes
- Reason codes: `guidance_timeout`, `guidance_unavailable`, `validator_low_confidence`, etc.
- All retries must be bounded; no infinite loops
- Propagate `X-Request-Id` header in cross-service calls

## Service Patterns
- Use factory pattern for service creation (`aiServiceFactory.js`)
- Services must implement health check methods
- Use `serviceUtils.js` for shared utilities

## Error Handling
- Surface errors; let orchestration decide recovery
- Include context in error messages (document ID, stage name)
- Use structured logging via `logger.js` / `loggerService.js`

## Async/Await
- Prefer `async/await` over raw Promises
- Always handle rejections with try/catch
- Set explicit timeouts for external calls

## Pipeline Contracts
- Stages must be deterministic
- Stages must not mutate global state
- Stages must not invoke retries directly
- Stages must not assume Guidance availability

### Qdrant / Vector Store Contracts
- Services interacting with Qdrant must validate required collections and their vector configuration (size, distance) during startup and health checks.
- Text RAG: `document_embeddings` — 384d Cosine. Visual RAG: `visual_pages` — 320d Dot; `visual_overlays` — 320d Cosine.
- Services performing upserts must also mirror minimal payload metadata to Postgres and write the `vector_id` (UUID) for auditability. Do not store embedding vectors in Postgres (no `pgvector` columns at runtime).
- Any Qdrant collection mismatch (dimension or distance) is a critical error and must fail fast with clear logs and metrics.

## PromptRegistry Rules
- PromptRegistry is authoritative; Guidance is optional optimization
- Prompt edits must preserve output schema guarantees
- Any prompt change must include a test update
