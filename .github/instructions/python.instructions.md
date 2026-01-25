---
applyTo: "**/*.py"
description: Python coding standards for guidance-service and rag-service
---

# Python Coding Standards

## Services Using Python
- `guidance_service/` - Guidance AI framework service
- `rag_service/` - RAG (Retrieval Augmented Generation) service

## General Principles
- Follow PEP 8 style guide
- Use type hints for function signatures
- Write clear docstrings for public functions

## Flake8 / Line Length
- Maximum line length: **79 characters** (PEP 8 standard)
- Use parentheses for line continuation over backslashes
- Break long strings with implicit concatenation or parentheses
```python
# Good: parentheses for continuation
result = some_function(
    argument_one, argument_two,
    argument_three
)

# Good: implicit string concatenation
long_message = (
    "This is a very long message that needs "
    "to be split across multiple lines."
)
```

## Guidance Service Specific

### Provider Abstraction
- Keep model identity stable for caching
- Provider plumbing must not affect cache keys

### JSON Validation
- Validate final JSON before returning for constrained templates
- Use validators in `guidance_service/validators/`

### Timeouts
- Server timeout <= client timeout - buffer
- Avoid long-running requests after client timeout

### Template Patterns
```python
# Use context managers for roles
with system():
    lm += "System prompt"
with user():
    lm += "User input"
with assistant():
    lm += gen(name="response", max_tokens=100)
```

### Generation Rules
- Always use `name=` parameter with `gen()`
- Use `temperature=0.0` for classification/extraction
- Prefer `select()` over `gen()` for fixed options
- Never modify model state in place: `lm2 = lm + delta`

## RAG Service Specific

### FastAPI Patterns
- Use dependency injection via `dependencies.py`
- Define models in `models.py`
- Use settings from `settings.py`

### Indexing
- Handle indexing operations in `indexing.py`
- Manage state via `state.py`

#### Qdrant Collection Validation
- RAG services must ensure the presence and correct configuration of Qdrant collections prior to accepting indexing/upsert requests.
- Validate collection vector size and distance semantics (e.g., `document_embeddings` 384 Cosine, `visual_pages` 320 Dot, `visual_overlays` 320 Cosine).
- Implement graceful deferred ingest behavior when Qdrant is unavailable and record metrics for retry orchestration.

## Logging
- Use structured logging (JSON format)
- Include request IDs for tracing
- Use `logging_utils.py` for consistent formatting

## Testing
- Tests in respective `tests/` directories
- Use pytest for Python tests
- Mock external services appropriately
