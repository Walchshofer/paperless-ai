# future_implementations

This directory contains experimental and future implementation prototypes for the Expert Pipeline. These files are intended as **references and proof-of-concepts only**, not as production-ready code.

## ⚠️ Important Warning

**DO NOT** import or use files from this directory in production code. Always import from `services/` instead.

## Purpose

This directory serves as a development sandbox for:

- Testing new features before production integration
- Exploring alternative implementation approaches
- Maintaining experimental code that may be useful for future development
- Providing reference implementations for complex features

## Relationship to Production Code

### Import Policy
- ✅ **Correct**: `const { PromptRegistry } = require('../../services/prompts/PromptRegistry')`
- ❌ **Incorrect**: `const { PromptRegistry } = require('../future_implementations/services/prompts/PromptRegistry')`

### Code Flow
```
future_implementations/ (experimental)
    ↓ (after testing & review)
services/ (production)
    ↓ (runtime)
Application
```

## Key Differences from Production

### Model Naming Conventions
| Aspect | future_implementations | services (canonical) |
|--------|----------------------|---------------------|
| Case sensitivity | Mixed (e.g., `qwen3-vl:8B`) | Lowercase only (`qwen3-vl:8b`) |
| Suffix consistency | Inconsistent | Standardized lowercase |
| Alias handling | Basic | Comprehensive (see `config.modelAliases`) |

### Structural Differences
| Component | future_implementations | services |
|-----------|----------------------|----------|
| Prompt layouts | Experimental variations | Standardized templates |
| Stage ordering | Alternative flows | Optimized pipeline |
| Error handling | Basic | Comprehensive with retries |
| Configuration | Inline | Environment-driven |

### Medical Prompts
- `future_implementations/services/prompts/MedicalPrompts.js`: Reference implementation
- `services/prompts/MedicalPrompts.js`: Production implementation
- **Recommendation**: Use production version; reference experimental for ideas

## Contributing and Migration Process

### Step 1: Develop in Experimental
1. Create/modify files in `future_implementations/`
2. Add comprehensive tests in `test/integration/expert-pipeline.test.js`
3. Document changes and rationale

### Step 2: Testing Requirements
```bash
# Run full test suite
npm test

# Run specific component tests
npm test -- --grep "new feature"

# Performance testing
npm test -- --grep "performance"
```

### Step 3: Migration to Production
1. **Create PR** with clear description of changes
2. **Update documentation** in `docs/EXPERT_PIPELINE_GUIDE.md`
3. **Merge into `services/`** with proper imports
4. **Remove experimental version** from `future_implementations/`
5. **Update cross-references** in all documentation

### Step 4: Documentation Updates
- Update `docs/MODEL_INVENTORY.md` for model changes
- Update `docs/EXPERT_PIPELINE_GUIDE.md` for API changes
- Update `docs/MODEL_MIGRATION_GUIDE.md` for migration notes
- Update `test/README.md` for test changes

## Current Experimental Features

### Active Experiments
- [ ] Advanced reasoning models integration
- [ ] Alternative prompt architectures
- [ ] Performance optimizations
- [ ] Extended domain support

### Recently Merged
- [x] Three-tier model architecture
- [x] Comprehensive model aliasing
- [x] Enhanced error handling
- [x] Test infrastructure

## Maintenance Guidelines

### When to Add to future_implementations/
- Exploring new features that need extensive testing
- Prototyping alternative approaches
- Developing complex integrations
- Maintaining backward compatibility experiments

### When to Remove from future_implementations/
- After successful migration to `services/`
- When experiment proves unsuccessful
- When code becomes obsolete
- During periodic cleanup

### File Naming Convention
```
future_implementations/
├── services/           # Mirror production structure
│   ├── prompts/
│   ├── experts/
│   └── integration/
├── tests/             # Experimental tests
└── docs/             # Experimental documentation
```

## Testing Experimental Features

```bash
# Test experimental features (if applicable)
cd future_implementations
npm test  # If experimental test setup exists

# Always test against production integration
cd ..
npm test -- --grep "integration"
```

## Contact and Support

For questions about experimental features:
1. Check existing documentation in this README
2. Review related issues and PRs
3. Open discussion in development channels
4. Create issue for new experimental proposals

---

**Last Updated**: December 2025
**Status**: Active experimental directory