---
applyTo: "test/**/*.js"
description: Testing standards for Mocha test files
---

# Testing Standards

## Framework & Tools
- Runner: **Mocha**
- Assertions: **Node.js built-in `assert`**
- Environment bootstrap: `test/setup-env.js`

## File Structure
- Test files must end with `.test.js`
- Each test file must begin with: `/* eslint-env mocha */`

## Directory Layout
```
test/
├── unit/           # Isolated tests for utilities/helpers
├── integration/    # End-to-end pipeline coordination tests
├── services/       # Service client tests (telemetry, rag, guidance)
├── fixtures/       # Mock documents, JSON responses, base64 samples
└── setup-env.js    # Environment bootstrap
```

## Naming Convention
```javascript
describe('ComponentName', function() {
    describe('Feature Group', function() {
        it('should handle specific scenario', function() {
            // Test implementation
        });
    });
});
```

## Timeouts
- Default timeout: 30 seconds
- AI-simulated flows: 30-60 seconds (set explicitly)
- Integration tests: 60 seconds
- Re-ingest / e2e tests: 120 seconds (or configurable via env `E2E_TIMEOUT`) - reingest flows may involve IO and sidecar processing and require extended timeouts

## Mock Services
- Prefer lightweight mock classes (e.g., `MockOllamaService`)
- Avoid heavy mocking libraries
- Use `test/fixtures/mocks.js` for shared mocks
- Use `createTestImageBase64()` for vision tests

## Test Structure (AAA Pattern)
```javascript
it('should process document correctly', async function() {
    // Arrange
    const input = createTestDocument();
    const service = new MockService();
    
    // Act
    const result = await service.process(input);
    
    // Assert
    assert.strictEqual(result.status, 'success');
});
```

## Required Test Coverage
- Guidance success path (valid JSON output)
- Guidance failure → PromptRegistry fallback → JsonRepair
- Validator-driven retries (document-scoped)
- Visual OCR vs Tesseract selection threshold behavior
- Negative tests (timeouts, unavailable services)
- Re-ingestion e2e: verify single-doc reingest path (original PDF → Qdrant points in `visual_pages`/`visual_overlays` and `document_embeddings` where applicable → Postgres `vector_id` mapping) and cleanup
- Qdrant collection assertions: tests that verify collection presence and distance/dimension semantics (skip when `QDRANT_HOST` not set)

## Commands
```bash
# All tests
npm test

# Grep specific
npm test -- --grep "Expert Pipeline"

# Integration tests
npm run test:integration
```
