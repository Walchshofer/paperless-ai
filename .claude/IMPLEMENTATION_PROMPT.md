# Paperless-AI Ollama Service Refactoring Implementation

## Context

You are refactoring the `paperless-ai` codebase to fix critical runtime issues when using Ollama with large language models in a Docker environment.

### Environment
- **OS**: Windows 11 (Docker Desktop)
- **Hardware**: NVIDIA RTX 3090 Ti (24GB VRAM)
- **AI Backend**: Ollama on Windows Host (accessible via `host.docker.internal:11434`)
- **Model**: `gpt-oss:latest` (20B parameters, ~14GB model file)
- **Use Case**: Automated document tagging/titling for German medical and household PDFs

### Current Architecture
- **Service Location**: `services/ollamaService.js`
- **Utilities**: `services/serviceUtils.js` (token calculation, truncation)
- **Config**: `config/config.js`
- **Docker**: `docker-compose.yml`

## Problems to Fix

### 1. Module Loading Errors
**Symptom**: `validateDocumentContent is not a function` crashes in Docker
**Root Cause**: Split logic between `ollamaService.js` and `serviceUtils.js` causes module resolution failures in volume-mounted containers
**Solution**: Consolidate all utilities into a single monolithic service file

### 2. Timeout Issues
**Symptom**: "No response data" errors after 30s
**Root Cause**: Large models (14GB) take >30s to load into VRAM; hardcoded 30-minute timeout in axios client
**Current Code**: Line 27 in `services/ollamaService.js`
```javascript
this.client = axios.create({
    timeout: 1800000 // 30 minutes timeout
});
```
**Solution**: Dynamic timeout via `AXIOS_TIMEOUT` environment variable

### 3. Context Window Overflow
**Symptom**: Ollama crashes with context errors
**Root Cause**: Naive token calculation (`char/4`) and inverted logic in `_calculateNumCtx`
**Current Code**: Lines 486-497 in `services/ollamaService.js`
```javascript
_calculateNumCtx(promptTokenCount, expectedResponseTokens) {
    const totalTokenUsage = promptTokenCount + expectedResponseTokens;
    const maxCtxLimit = Number(config.tokenLimit);
    const numCtx = Math.min(totalTokenUsage, maxCtxLimit); // WRONG: allows full limit
    return numCtx;
}
```
**Issues**:
- Token estimation is inaccurate (should be ~3.5 chars/token for Llama/Qwen)
- Uses `Math.min` which allows sending prompts up to the full limit
- No safety buffer for model-specific constraints
- `gpt-oss` requires ~90% buffer, other models ~80%

**Solution**:
- Accurate tokenization (3.5 chars/token)
- Safety buffer: 90% for `gpt-oss`, 80% for others
- Hard limit via `TOKEN_LIMIT` env var (default: 16384)
- Smart content truncation with sentence boundary detection

### 4. Empty Response Handling
**Symptom**: Service crashes when model returns empty strings (OOM scenarios)
**Root Cause**: No validation of response content
**Solution**: Graceful error handling with validation and fallbacks

## Implementation Tasks

### Task 1: Refactor `services/ollamaService.js`

Replace the entire file with the consolidated version that:

1. **Inlines all utilities** (no external imports from serviceUtils)
   - `calculateTokens(text)` - uses 3.5 chars/token estimation
   - `truncateToTokenLimit(content, maxTokens)` - smart truncation with sentence boundaries
   - `validateDocumentContent(content, minChars)` - content validation
   - `writePromptToFile(content)` - logging with timestamp
   - `extractJsonFromResponse(responseText)` - robust JSON extraction

2. **Fixes timeout handling**
   - Read `AXIOS_TIMEOUT` from environment (default: 600000ms = 10 minutes)
   - Validate timeout is >= 5000ms
   - Apply to axios client in constructor

3. **Fixes context window calculation**
   - Accurate token counting (3.5 chars/token)
   - Model-aware safety buffers (90% for gpt-oss, 80% for others)
   - Hard limit via `TOKEN_LIMIT` (default: 16384)
   - Reserve tokens for response (512 tokens)

4. **Adds robust error handling**
   - Validate API responses before processing
   - Handle empty responses gracefully
   - Return structured error objects
   - Detailed logging for debugging

5. **Preserves all existing functionality**
   - All public methods remain unchanged
   - Compatible with existing callers
   - Maintains same return formats
   - Supports all existing features (custom fields, restrictions, etc.)

### Task 2: Clean Up Dependencies

1. **Delete** `services/serviceUtils.js` (if it exists)
   - All functionality is now inlined in `ollamaService.js`
   - Prevents confusion and module loading issues

2. **Verify** no other files import from `serviceUtils.js`
   - Search codebase for `require('./serviceUtils')`
   - Update any references found

### Task 3: Environment Variables

Document the new environment variables that must be set:

```env
# Ollama Configuration
OLLAMA_API_URL=http://host.docker.internal:11434
OLLAMA_MODEL=gpt-oss:latest

# Timeout Configuration (milliseconds)
AXIOS_TIMEOUT=600000  # 10 minutes for model loading

# Token/Context Configuration
TOKEN_LIMIT=16384     # Hard limit for context window
```

### Task 4: Verification

After implementation:

1. **Check syntax**: Ensure JavaScript is valid
2. **Verify inlining**: Confirm no external utility imports
3. **Test calculations**: Validate token math with sample inputs
4. **Review error handling**: Check all catch blocks return proper structures

## Key Implementation Details

### Token Calculation
```javascript
function calculateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    // Llama/Qwen/GPT-OSS tokenizer estimate: ~3.5 chars per token
    return Math.ceil(text.length / 3.5);
}
```

### Context Window Calculation
```javascript
_calculateNumCtx(promptTokenCount, responseTokens) {
    const total = promptTokenCount + responseTokens;
    const maxLimit = parseInt(process.env.TOKEN_LIMIT || '16384', 10);
    const factor = this.isGptOss ? 0.90 : 0.80; // Safety buffer
    const safeLimit = Math.floor(maxLimit * factor);
    return Math.min(total, safeLimit); // NOW: prevents overflow
}
```

### Content Truncation
```javascript
const maxTokens = parseInt(process.env.TOKEN_LIMIT || '16384', 10);
const contentTokenLimit = Math.max(1000, maxTokens - 1500); // Reserve for system prompt
content = truncateToTokenLimit(content, contentTokenLimit);
```

### Timeout Configuration
```javascript
constructor() {
    const timeoutMs = parseInt(process.env.AXIOS_TIMEOUT, 10);
    this.timeout = (!isNaN(timeoutMs) && timeoutMs >= 5000) ? timeoutMs : 600000;
    this.client = axios.create({ timeout: this.timeout });
}
```

## Success Criteria

After implementation, the service should:

1. ✅ Run without module loading errors in Docker
2. ✅ Handle large model loading times (>30s) without timeout
3. ✅ Respect model context windows without overflow
4. ✅ Handle empty/invalid responses gracefully
5. ✅ Maintain compatibility with all existing features
6. ✅ Provide detailed logging for debugging

## Code Reference

The complete refactored `ollamaService.js` is provided in the original request. Key changes:

- **Lines 1-14**: Inline utility functions (no external imports)
- **Lines 23-29**: Dynamic timeout configuration
- **Lines 138-140**: Fixed token calculation and context window
- **Lines 236-248**: Enhanced error handling in `_callOlamaAPI`
- **Lines 250-270**: Robust response processing with validation

## Docker Verification

After making changes, verify the build:

```bash
# Test that Docker can build with new code
docker compose build

# Run with proper volume mapping (for development)
docker compose up
```

Ensure your local changes to `services/ollamaService.js` are reflected in the container.

---

## Final Notes

This refactoring prioritizes **stability and reliability** over elegance. The monolithic approach eliminates module loading issues in Docker environments where file system behavior can be unpredictable. All changes are backward-compatible and maintain the existing API surface.
