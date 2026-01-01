# Baseline Behavior Documentation - Pre Visual RAG Migration

**Date:** 2025-12-20
**Branch:** backup/pre-visual-rag
**Commit:** dd19679

## Current `analyzeDocument()` Behavior

### Method Signature
```javascript
async analyzeDocument(content, existingTags = [], existingCorrespondentList = [], existingDocumentTypesList = [], id, customPrompt = null, options = {})
```

### Flow
1. **Validation**: Validates content with `validateDocumentContent()` (min 50 chars)
2. **Truncation**: Truncates content to token limit (default: 16384 tokens - 1500 = 14884 tokens for content)
3. **Thumbnail Caching**: Downloads and caches thumbnail if available (via `_handleThumbnailCaching()`)
4. **External API Data**: Validates and includes external API data if provided
5. **Prompt Building**: Builds prompt using `_buildPrompt()` with system prompt and content
6. **Context Calculation**: Calculates `num_ctx` based on system + user prompt tokens
7. **API Call**: Calls `_callOllamaAPI()` with text-only model
8. **Response Processing**: Parses JSON response via `_processOllamaResponse()`
9. **Normalization**: Normalizes fields via `_normalize()`
10. **Logging**: Writes prompt and response to logs

### Key Characteristics
- **Text-only analysis**: Uses only OCR text content
- **Single model**: Uses configured `OLLAMA_MODEL` (typically sauerkraut-llama3.1:8b or gpt-oss)
- **No vision analysis**: Thumbnails downloaded but not used for analysis
- **JSON output**: Extracts: title, correspondent, tags, document_type, document_date, language, custom_fields
- **Timeout**: 600000ms (10 minutes) default
- **Context window**: 80% of TOKEN_LIMIT for non-GPT-OSS, 90% for GPT-OSS

### Current Config Parameters
```javascript
ollama: {
  apiUrl: process.env.OLLAMA_API_URL || 'http://localhost:11434',
  model: process.env.OLLAMA_MODEL || 'sauerkraut-llama3.1:8b'
}
```

### Models Currently Used
- **gpt-oss:latest** (13GB) - Primary text analysis model
- **qwen3-vl:8b** (6.1GB) - Installed but not used

### Verification Criteria
After migration, existing functionality must:
- Continue to extract all core fields correctly
- Maintain same JSON output structure
- Handle custom prompts correctly
- Process external API data correctly
- Maintain backward compatibility with existing configurations

### Known Issues (Pre-Migration)
- Scanned documents with poor OCR quality may have incomplete extraction
- Tables and complex layouts may not parse correctly from text
- No automatic quality assessment of text content
- No fallback mechanism when text analysis fails

## Phase 0 Completion Checklist

- [x] **0.1** Freeze ADR as authoritative spec (visual-rag-multimodel-plan.md exists)
- [x] **0.2** Review fieldRegistry.json and profiles.json - all current custom fields are represented
- [x] **0.3** Verify qwen3-vl:8b is installed: CONFIRMED (6.1GB, installed 2 days ago)
- [x] **0.4** Create backup branch: backup/pre-visual-rag created
- [x] **0.5** Document current analyzeDocument() behavior as baseline: THIS FILE

**Phase 0 Status:** COMPLETE
