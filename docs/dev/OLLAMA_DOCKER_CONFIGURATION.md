# Ollama Docker Configuration Guide

## Overview

This guide explains how to configure paperless-ai to work with Ollama running on your Windows host from within a Docker container, specifically optimized for large language models.

## Environment Setup

### Windows Host Configuration

1. **Ollama Installation**: Ollama should be running on your Windows host
2. **Model**: `gpt-oss:latest` (20B parameters, ~14GB model file)
3. **Hardware**: NVIDIA RTX 3090 Ti (24GB VRAM)
4. **Docker**: Docker Desktop on Windows 11

### Network Configuration

From within the Docker container, access your host Ollama instance using:
```
http://host.docker.internal:11434
```

This is Docker's special DNS name that resolves to the host machine's IP address.

## Environment Variables

### Required Variables

```env
# AI Provider Selection
AI_PROVIDER=ollama

# Ollama Configuration
OLLAMA_API_URL=http://host.docker.internal:11434
OLLAMA_MODEL=gpt-oss:latest
```

### New Timeout Configuration

Large models (14GB+) can take significant time to load into VRAM. Configure the timeout accordingly:

```env
# Timeout in milliseconds (default: 600000 = 10 minutes)
# Increase if you see timeout errors during model loading
AXIOS_TIMEOUT=600000
```

**Recommendations**:
- Models < 7B: 300000 (5 minutes)
- Models 7B-13B: 600000 (10 minutes)
- Models 20B+: 900000 (15 minutes)

### New Token/Context Configuration

Control the context window size to prevent overflow errors:

```env
# Maximum tokens for context window (default: 16384)
# Adjust based on your model's capabilities
TOKEN_LIMIT=16384
```

**Model-Specific Recommendations**:
- `gpt-oss`: Uses 90% safety buffer automatically
- Other models: Uses 80% safety buffer automatically
- Llama 2/3: 4096-8192
- Qwen: 8192-32768
- Mixtral: 32768

## Token Calculation

The refactored service uses accurate token estimation for Llama-based models:

### Calculation Method
```javascript
// ~3.5 characters per token for Llama/Qwen/GPT-OSS models
tokens = Math.ceil(text.length / 3.5)
```

This is more accurate than the previous 4.0 chars/token estimation.

### Context Window Safety

The service automatically applies safety buffers:

```javascript
// GPT-OSS models: Use 90% of TOKEN_LIMIT
// Other models: Use 80% of TOKEN_LIMIT

effectiveLimit = TOKEN_LIMIT * safetyFactor
contextSize = Math.min(promptTokens + responseTokens, effectiveLimit)
```

Example with TOKEN_LIMIT=16384:
- **gpt-oss**: Max context = 14,745 tokens (16384 * 0.90)
- **Other models**: Max context = 13,107 tokens (16384 * 0.80)

## Content Truncation

If your document exceeds the token limit, the service automatically truncates it:

### Smart Truncation Logic

1. Calculate maximum allowed tokens: `TOKEN_LIMIT - 1500` (reserve for system prompt)
2. Convert to characters: `maxChars = maxTokens * 3.5`
3. Truncate content to max characters
4. Find last sentence boundary (period) within 80% of limit
5. Truncate at sentence boundary for better context

```javascript
// Example: TOKEN_LIMIT = 16384
contentTokenLimit = 16384 - 1500 = 14884 tokens
maxChars = 14884 * 3.5 = 52094 characters

// Smart truncation at sentence boundary
truncated = content.substring(0, 52094)
lastPeriod = truncated.lastIndexOf('.')
if (lastPeriod > 41675) { // 80% of maxChars
    truncated = content.substring(0, lastPeriod + 1)
}
```

## Error Handling

### Timeout Errors

If you see:
```
Timeout (600000ms). Model loading?
```

**Solutions**:
1. Increase `AXIOS_TIMEOUT` in your .env file
2. Ensure Ollama is running on your host
3. Pre-load the model: `ollama run gpt-oss:latest` on host
4. Check Docker can reach host.docker.internal

### Context Window Errors

If you see Ollama crashes or context errors:

**Solutions**:
1. Reduce `TOKEN_LIMIT` to match your model's capabilities
2. Check your model's actual context window size
3. Enable content truncation logging to see actual sizes
4. Consider using a model with larger context window

### Empty Response Errors

If you see:
```
Empty response from Ollama
```

**Possible Causes**:
1. Model ran out of memory (OOM)
2. Context window exceeded despite safety buffer
3. Ollama crashed or restarted
4. Network connectivity issue

**Solutions**:
1. Reduce `TOKEN_LIMIT`
2. Monitor GPU memory usage during inference
3. Check Ollama logs on host
4. Restart Ollama service

## Monitoring and Debugging

### Enable Debug Logging

The service automatically logs important information:

```
[INFO] Ollama Service initialized. Model: gpt-oss:latest, Timeout: 600000ms
[DEBUG] Starting document analysis for ID: 12345
[DEBUG] Tokens: 5234, Context: 5746, Model: gpt-oss:latest
[DEBUG] Use existing data: yes, External API: none
[SUCCESS] Analysis completed in 45.32s
```

### Prompt Logging

All prompts and responses are logged to:
```
logs/prompts/prompt_<timestamp>.log
```

Use these logs to:
- Verify token counts are accurate
- Debug response parsing issues
- Tune your prompts
- Monitor context window usage

### Key Metrics to Monitor

1. **Token Count**: Should be realistic for your document size
2. **Context Size**: Should be <= TOKEN_LIMIT * safety_factor
3. **Processing Time**: First run will be slower (model loading)
4. **Response Quality**: Check for truncated or incomplete responses

## Docker Compose Configuration

Update your `docker-compose.yml` to pass environment variables:

```yaml
services:
  paperless-ai:
    image: clusterzx/paperless-ai
    container_name: paperless-ai
    network_mode: bridge
    restart: unless-stopped
    environment:
      - OLLAMA_API_URL=${OLLAMA_API_URL}
      - OLLAMA_MODEL=${OLLAMA_MODEL}
      - AXIOS_TIMEOUT=${AXIOS_TIMEOUT:-600000}
      - TOKEN_LIMIT=${TOKEN_LIMIT:-16384}
      # ... other variables
```

## Performance Tips

### 1. Pre-load Models

On your Windows host, pre-load the model to avoid first-request delays:
```bash
ollama run gpt-oss:latest
# Type /bye to exit but keep model in memory
```

### 2. Adjust Context Window

For better performance with large documents:
- Smaller context = faster inference
- Larger context = better understanding
- Find the sweet spot for your use case

### 3. Monitor VRAM Usage

Use GPU monitoring tools to track VRAM:
- Task Manager (Windows 11)
- GPU-Z
- nvidia-smi (if CUDA toolkit installed)

Ensure you have headroom for:
- Model weights (~14GB for gpt-oss)
- Context memory (~1-2GB)
- OS overhead (~1GB)

## Troubleshooting

### Cannot Connect to Ollama

**Symptoms**: Connection refused errors

**Solutions**:
1. Verify Ollama is running: `ollama list` on Windows host
2. Check firewall allows port 11434
3. Test from container: `docker exec -it paperless-ai curl http://host.docker.internal:11434/api/ps`

### Model Not Found

**Symptoms**: Model not available errors

**Solutions**:
1. Pull model on host: `ollama pull gpt-oss:latest`
2. List available models: `ollama list`
3. Update OLLAMA_MODEL in .env to match exact model name

### Slow Performance

**Symptoms**: Analysis takes > 2 minutes per document

**Solutions**:
1. Ensure GPU acceleration is working
2. Reduce TOKEN_LIMIT to reduce context size
3. Truncate documents more aggressively
4. Consider smaller model variant
5. Pre-load model as described above

## Testing

### Quick Test

Test the configuration:

```bash
# Start services
docker compose up -d

# Check logs
docker compose logs -f paperless-ai

# Look for:
# [INFO] Ollama Service initialized. Model: gpt-oss:latest, Timeout: 600000ms
```

### Full Test

1. Upload a test document to Paperless
2. Trigger AI analysis
3. Monitor logs for token counts and timing
4. Verify results are accurate
5. Check response time is acceptable

## Summary

The refactored Ollama service provides:
- ✅ Accurate token calculation (3.5 chars/token)
- ✅ Model-aware safety buffers (90% for gpt-oss, 80% for others)
- ✅ Configurable timeouts for large model loading
- ✅ Configurable context window limits
- ✅ Smart content truncation at sentence boundaries
- ✅ Robust error handling and recovery
- ✅ Comprehensive logging for debugging

For optimal results with large models, start with these settings:

```env
AXIOS_TIMEOUT=600000
TOKEN_LIMIT=16384
```

Then adjust based on your specific model and performance requirements.
