# Expert Pipeline Reference Implementations

This directory contains reference implementations of the Expert Pipeline system for comparison and documentation purposes.

## Purpose

These files serve as:
- **Reference documentation** for the expert pipeline architecture
- **Comparison baseline** to verify active implementations match design specifications
- **Historical record** of the original design intent

## Relationship to Active Code

The active, production implementations are located in:
- `services/experts/ExpertRegistry.js` - Canonical registry
- `services/experts/ExpertPipelineExecutor.js` - Canonical executor
- `services/integration/DocumentProcessor.js` - Integration layer

## Key Differences

The reference implementations may differ from active code in:
- Model names (e.g., `llama3.2:latest` vs `sauerkraut-llama3.1:8b`)
- Configuration sources (hardcoded vs environment variables)
- HTTP client libraries (node-fetch vs axios)

## Usage

Do NOT import from this directory. Always use:
```javascript
const { expertRegistry } = require('./services/experts/ExpertRegistry');
const { ExpertPipelineExecutor } = require('./services/experts/ExpertPipelineExecutor');
```

## Maintenance

These files should be updated when major architectural changes occur to the expert pipeline system.
