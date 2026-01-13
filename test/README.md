# Test Suite Documentation

This directory contains the comprehensive test suite for the paperless-ai expert pipeline system.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --grep "PromptRegistry"
npm test -- --grep "Model Resolution"
npm test -- --grep "ExpertPipelineExecutor"
npm test -- --grep "DocumentProcessor"

# Run with verbose output
npm test -- --reporter spec --verbose

# Run with coverage (if istanbul/mocha-istanbul is installed)
npm test -- --coverage

# Run the CODEX Serena bridge integration test (Python)
pytest test/integration/codex-serena-bridge.test.py -v  # uses codex-serena-bridge.py for testing
```

## Test Structure

```
test/
├── integration/
│   └── expert-pipeline.test.js    # Main test suite
├── fixtures/
│   ├── documents.js               # Test document samples
│   └── mocks.js                   # Mock services
└── README.md                      # This file
```

## Test Coverage

### PromptRegistry Tests
- Registration and retrieval of prompts
- Message building for Ollama API
- Domain and model type filtering
- Template variable substitution
- Multimodal prompt handling

### ExpertRegistry Tests
- Pipeline registration and routing
- Condition-based execution
- Model resolution integration
- Error handling and fallbacks

### ExpertPipelineExecutor Tests
- Full pipeline execution
- Retry logic and error recovery
- Metrics collection
- Timeout handling
- Result merging strategies

### DocumentProcessor Tests
- End-to-end document processing
- Classification accuracy
- Integration with all pipeline stages
- Performance and resource usage

### Model Resolution Tests
- Alias mapping functionality
- Tier identification (production/advanced/infrastructure)
- Model availability checking
- Configuration integration

### Service Index Tests
- Export verification
- Initialization and factory functions
- Dependency injection
- Health checks

## Mock Services

The test suite uses mock implementations to isolate components:

- **MockOllamaService**: Simulates Ollama API responses
- **TestDocuments**: Sample documents for various domains
- **createTestImageBase64()**: Generates minimal PNG for vision tests

## Adding New Tests

1. **Unit Tests**: Add to existing describe blocks in `expert-pipeline.test.js`
2. **Integration Tests**: Add new describe blocks for end-to-end scenarios
3. **Fixtures**: Add test data to `fixtures/documents.js` or `fixtures/mocks.js`
4. **Mock Services**: Extend `MockOllamaService` for new response patterns

### Test Naming Convention

```javascript
describe('ComponentName', function() {
    describe('Feature Group', function() {
        it('should handle specific scenario', function() {
            // Test implementation
        });
    });
});
```

## Continuous Integration

Tests are designed to run in CI environments:

- No external dependencies (Ollama not required)
- Fast execution (< 30 seconds)
- Deterministic results
- Comprehensive error reporting

## Debugging Failed Tests

```bash
# Run with detailed output
npm test -- --reporter spec --verbose

# Run single test
npm test -- --grep "exact test name"

# Debug with Node.js inspector
npm test -- --inspect --grep "test name"
```

## Performance Benchmarks

The test suite includes performance assertions:

- Pipeline execution time limits
- Memory usage thresholds
- Concurrent request handling
- Model loading times

## Maintenance

- Update test expectations when APIs change
- Add new test cases for bug fixes
- Review and update mock responses as needed
- Maintain test documentation
