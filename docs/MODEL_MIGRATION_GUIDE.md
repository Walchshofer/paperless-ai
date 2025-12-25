# Model Configuration Migration Guide

This guide helps users migrate their existing model configurations to the new standardized system with aliases and tiered architecture.

## Breaking Changes

### vatExpert Model Now Required
**Impact**: If you use financial pipelines with VAT analysis, you must ensure `VAT_EXPERT_MODEL` is set.
**Before**: System would crash with undefined reference
**After**: Defaults to `llm-pro-finance-8b` if not specified
**Action Required**: Set `VAT_EXPERT_MODEL=llm-pro-finance-8b` in your `.env` file if using financial features

### Model Name Normalization
**Impact**: All model names are now normalized to lowercase with explicit tags.
**Before**: Mixed case usage (`qwen3-vl:8B`, `Llava-Med-v1.5`)
**After**: Consistent lowercase (`qwen3-vl:8b`, `llava-med-v1.5`)
**Action Required**: Update any custom scripts or configurations to use lowercase names

## New Features

### Model Aliases
You can now use shorter, more convenient aliases for models instead of full canonical names:

```bash
# Old way (still works):
export ROUTER_MODEL=qwen3-vl:8b
export MEDICAL_VISION_MODEL=llava-med-v1.5:latest

# New way (recommended):
export ROUTER_MODEL=qwen3-vl
export MEDICAL_VISION_MODEL=llava-med
```

### Advanced Tier Models (Optional)
New reasoning models are available for complex analysis when hardware supports them:

```bash
# Enable advanced reasoning (requires RTX 3090 Ti or better)
export ENABLE_ADVANCED_REASONING=yes
export DRAGON_MODEL=dragon-finance  # 9GB VRAM
export GPT_OSS_MODEL=gpt-oss        # 13GB VRAM
```

### Infrastructure Tier Configuration
New environment variables for embedding and orchestration models:

```bash
# Embedding model (now configurable)
export EMBEDDING_MODEL=nomic-embed-text-v1.5

# Visual retrieval (future feature)
export ENABLE_VISUAL_RETRIEVAL=yes
export VISUAL_RETRIEVAL_MODEL=tomoro-colqwen3-embed-8b
```

## Migration Steps

### Step 1: Backup Your Configuration
```bash
cp .env .env.backup
```

### Step 2: Update Model Names to Lowercase
Review your `.env` file and update any uppercase model names:

```bash
# Change this:
ROUTER_MODEL=qwen3-vl:8B

# To this:
ROUTER_MODEL=qwen3-vl:8b
```

### Step 3: Add Required vatExpert Configuration
If you use financial document processing:

```bash
# Add this line:
VAT_EXPERT_MODEL=llm-pro-finance-8b
```

### Step 4: Optionally Adopt Aliases
Replace long model names with shorter aliases:

```bash
# Before:
MEDICAL_VISION_MODEL=llava-med-v1.5
MEDICAL_ANALYSIS_MODEL=medtext-llama3:latest
FINANCIAL_ANALYSIS_MODEL=fino1-8b

# After:
MEDICAL_VISION_MODEL=llava-med
MEDICAL_ANALYSIS_MODEL=medtext
FINANCIAL_ANALYSIS_MODEL=fino1
```

### Step 5: Consider Advanced Models (Optional)
If you have sufficient hardware (RTX 3090 Ti or RTX 4090), enable advanced reasoning:

```bash
ENABLE_ADVANCED_REASONING=yes
DRAGON_MODEL=dragon-finance
```

### Step 6: Test Configuration
Restart your services and test model resolution:

```bash
# Test expert pipeline health
curl http://localhost:3000/api/expert/health

# Check logs for model resolution warnings
tail -f logs/application.log | grep -i "model"
```

## Hardware Requirements by Configuration

| Configuration | GPU | VRAM | Supported Models |
|---|---|---|---|
| **Minimal** | RTX 3080 | 10GB | Production tier only |
| **Standard** | RTX 3090 Ti | 24GB | Production + 1 advanced |
| **Advanced** | RTX 4090 | 24GB | Production + 2 advanced |
| **Full Stack** | Dual RTX 4090 | 48GB | All tiers |

## Troubleshooting

### Model Resolution Errors
If you see errors like "model not found":
1. Check that model names use lowercase
2. Verify aliases are correctly configured
3. Ensure vatExpert is defined for financial pipelines

### Performance Issues
If models are slow or failing:
1. Check VRAM usage with `nvidia-smi`
2. Reduce MAX_CONCURRENT_REQUESTS
3. Consider disabling advanced models if VRAM is limited

### Configuration Validation
Run this test to validate your configuration:

```javascript
// In Node.js REPL or test file
const { resolveModelName, getModelTier } = require('./services/utils/modelResolver');
const { MODEL_NAMES } = require('./services/prompts/PromptRegistry');

console.log('Router model:', resolveModelName(MODEL_NAMES.router));
console.log('Medical imaging tier:', getModelTier(MODEL_NAMES.medicalImaging));
console.log('vatExpert defined:', !!MODEL_NAMES.vatExpert);
```

## Rollback Plan

If issues occur after migration:

1. Restore backup configuration:
   ```bash
   cp .env.backup .env
   ```

2. Restart services:
   ```bash
   npm restart
   ```

3. Check service health:
   ```bash
   curl http://localhost:3000/health
   ```

## Support

For migration issues:
1. Check `docs/MODEL_AUDIT_ISSUES.md` for known issues
2. Review `docs/MODEL_INVENTORY.md` for model specifications
3. See `docs/ENVIRONMENT_VARIABLES.md` for complete configuration reference

## Version Compatibility

- **v1.x**: Legacy configuration still supported
- **v2.0+**: New alias system and advanced models recommended
- **v3.0+**: Visual retrieval and orchestration integration planned