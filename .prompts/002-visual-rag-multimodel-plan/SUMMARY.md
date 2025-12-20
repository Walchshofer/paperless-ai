# Visual RAG Implementation Plan Summary

**One-liner:** Enable vision-based document analysis with Qwen3-VL using Ollama's auto-managed memory (`keep_alive` parameter) - no manual model rotation needed.

---

## Ollama Memory Management (Key Insight)

**Ollama is self-managing** - use `keep_alive` parameter to control model residency:
- `"5m"` - Keep model loaded 5 minutes (good for vision - expensive to reload)
- `"2m"` - Keep model loaded 2 minutes (good for text - lighter)
- `0` - Unload immediately after response
- `-1` - Keep indefinitely

**Monitor loaded models:** `ollama ps`

---

## Phase Overview

| Phase | Name | Objective | Effort |
|-------|------|-----------|--------|
| 1 | Vision Model Integration | Add qwen3-vl:8b with `keep_alive` memory management | 4-6 hrs |
| 2 | Quality Detection | Detect when to use vision vs text based on OCR quality | 3-4 hrs |
| 3 | Visual RAG Pipeline | Sequential analysis with auto-managed model swapping | 4-6 hrs |
| 4 | Domain Expertise Prompts | Specialized vision prompts for medical, financial, technical | 3-4 hrs |

**Total Estimated Effort:** 14-20 hours

---

## Key Design Decisions

1. **keep_alive Strategy**: Vision `"5m"` (expensive), Text `"2m"` (lighter)
2. **Thumbnail vs Full Image**: Start with thumbnails for speed
3. **Quality Threshold**: TEXT_QUALITY_THRESHOLD=60 triggers vision fallback
4. **Merge Strategy**: Vision preferred for tables/visual; text for structured content

---

## Blockers

**None** - All prerequisites satisfied:
- qwen3-vl:8b installed (6.1GB)
- gpt-oss:latest installed (13GB)
- Ollama auto-manages GPU/CPU memory
- Thumbnail caching exists

---

## Next Step

**Execute Phase 1: Vision Model Integration**

Tasks:
1. Add vision config to config/config.js
2. Create `_callOllamaVisionAPI()` with `keep_alive`
3. Add `analyzeDocumentWithVision()`
4. Test: `ollama ps` to verify model loading

**Key API format:**
```javascript
// Vision call - keep loaded longer
await client.post('/api/generate', {
  model: 'qwen3-vl:8b',
  prompt: 'Analyze this document...',
  images: [base64ImageString],
  keep_alive: "5m",  // Ollama manages memory
  options: { num_ctx: 32768, num_predict: 4096 }
});

// Text call - can unload faster  
await client.post('/api/generate', {
  model: 'gpt-oss:latest',
  prompt: prompt,
  keep_alive: "2m"
});
```

---

## Files to Modify

- `config/config.js` - Add vision model + keep_alive configuration
- `services/ollamaService.js` - Add vision API with keep_alive parameter

---

## Implementation Note

**Use Context7 MCP Server** for up-to-date Ollama API documentation when implementing code.
