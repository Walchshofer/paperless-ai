# Prompts Settings Design

**Status**: Implemented
**Last Updated**: 2026-02-07
**Implementation Verified**: 2026-02-07

## Overview

This document captures the design decisions for two new settings features:
1. **Expert Model Token Limits** - expose Ollama model token limits in Developer Settings
2. **Prompts Management** - new admin interface for editing PromptRegistry templates

## 1. Expert Model Token Limits

### Research Findings

Five tiers of token limit settings exist for local Ollama models, partially exposed in code but NOT in UI:

| Tier | Context Window Env Var | Max Response Env Var | Default Context | Default Response |
|------|----------------------|---------------------|----------------|-----------------|
| **Text (Base)** | `OLLAMA_CONTEXT_WINDOW` | `OLLAMA_MAX_RESPONSE_TOKENS` | `TOKEN_LIMIT` (128k) | `RESPONSE_TOKENS` (4096) |
| **Vision** | `OLLAMA_VISION_CONTEXT_WINDOW` | `OLLAMA_VISION_MAX_RESPONSE_TOKENS` | text context (capped 32k) | 2048 |
| **Planner** | `OLLAMA_PLANNER_CONTEXT_WINDOW` | `OLLAMA_PLANNER_MAX_RESPONSE_TOKENS` | vision context (capped 32k) | 2048 |
| **Expert** | `OLLAMA_EXPERT_CONTEXT_WINDOW` | `OLLAMA_EXPERT_MAX_RESPONSE_TOKENS` | text context | text response |
| **Translation** | `TRANSLATION_CONTEXT_WINDOW` | (none) | text context | - |

Additional: `OLLAMA_VISION_IMAGE_TOKENS` (default 1024) - overhead per image.

**Config Source**: `C:\Users\pwalc\MyApps\paperless-ai\config\config.js` lines 130-141

Current Developer Settings (`src/islands/DeveloperSettingsIsland.tsx`) only expose `TOKEN_LIMIT` and `RESPONSE_TOKENS` (base tier).

### Design Decision

Add new section to DeveloperSettingsIsland: **"Ollama Model Token Limits"**

**Fields**:
- Base Text Model:
  - Context Window (OLLAMA_CONTEXT_WINDOW)
  - Max Response Tokens (OLLAMA_MAX_RESPONSE_TOKENS)
- Vision Models:
  - Context Window (OLLAMA_VISION_CONTEXT_WINDOW, capped 32k)
  - Max Response Tokens (OLLAMA_VISION_MAX_RESPONSE_TOKENS)
  - Image Token Overhead (OLLAMA_VISION_IMAGE_TOKENS)
- Planner Models:
  - Context Window (OLLAMA_PLANNER_CONTEXT_WINDOW, capped 32k)
  - Max Response Tokens (OLLAMA_PLANNER_MAX_RESPONSE_TOKENS)
- Expert Models:
  - Context Window (OLLAMA_EXPERT_CONTEXT_WINDOW)
  - Max Response Tokens (OLLAMA_EXPERT_MAX_RESPONSE_TOKENS)
- Translation:
  - Context Window (TRANSLATION_CONTEXT_WINDOW)

**UI Grouping**: Collapsible sections per tier with clear labels indicating these are local Ollama model limits.

**API**: Uses existing `/api/settings/save` endpoint for persisting Ollama limits to runtime.env.

**Implementation**: `C:\Users\pwalc\MyApps\paperless-ai\src\islands\DeveloperSettingsIsland.tsx:285-329`

---

## 2. Prompts Management

### Research Findings

**PromptRegistry** (`services/prompts/PromptRegistry.js`) is the canonical source of truth for expert pipeline prompts.

**15 Registered Prompts**:

| ID | Domain | Model | Category |
|----|--------|-------|----------|
| SYS_ROUTER_V1 | System | router (qwen3-vl:8b) | routing |
| SYS_ORCHESTRATOR_V1 | System | orchestrator | routing |
| VIS_SIGNAL_ANALYZER_V1 | System | router | routing |
| VIS_OCR_V1 | System | router | extraction |
| MED_RADIOLOGY_V1 | Medical | medicalImaging | - |
| MED_DOCTOR_V1 | Medical | medicalText | - |
| MED_INTEGRATOR_V1 | Medical | medicalText | - |
| FIN_EXTRACT_V1 | Financial | financeGeneral | - |
| FIN_REASONER_V1 | Financial | financeReasoning | - |
| FIN_VAT_EXPERT_V1 | Financial | vatExpert | - |
| LEGAL_ORCHESTRATOR_V1 | Legal | orchestrator/router | - |
| LEGAL_EXTRACTOR_V1 | Legal | legalExpert | - |
| GEN_FALLBACK_V1 | General | general | - |
| VISUAL_QUERY_GENERATOR_V1 | System | general | - |
| OCR_GUIDED_CROSS_VALIDATE_V1 | System | general | validation |

**Prompt Structure**:
- `id` (string)
- `version` (string)
- `domain` (DomainType enum)
- `model` (MODEL_NAMES key)
- `modelType` (multimodal | text_only)
- `systemPrompt` (string)
- `userTemplate` (string) - uses `{{variable_name}}` syntax
- `config` (object):
  - `temperature` (number)
  - `maxTokens` (number)
  - `topK` (number)
  - `topP` (number)

**Legacy Prompts in config.js**:
- `specialPromptPreDefinedTags` (line 550)
- `mustHavePrompt` (line 565)

**Current State**: No prompt management API or UI exists.

### Design Decision

#### New Sidebar Category: "Prompts"

Add "Prompts" to settings sidebar navigation (admin-only).

#### New Island: PromptsSettingsIsland

**Location**: `src/islands/PromptsSettingsIsland.tsx`

**Features**:
1. **List View** - prompts grouped by domain (System, Medical, Financial, Legal, General)
2. **Expandable Editor** - click prompt to expand editor inline
3. **Editable Fields**:
   - System Prompt (textarea, monospace font)
   - User Template (textarea, monospace font)
   - Temperature (number input, 0.0-1.0)
   - Max Tokens (number input, positive integer)
   - Top K (number input, positive integer)
   - Top P (number input, 0.0-1.0)
4. **Read-Only Fields**:
   - ID (badge)
   - Version (badge)
   - Domain (badge)
   - Model (badge)
   - Model Type (badge)
   - Template Variables (auto-detected from `{{...}}` in systemPrompt + userTemplate, displayed as tags)
5. **Actions**:
   - Save Changes (per prompt)
   - Reset to Default (per prompt)
   - Test Prompt (optional future feature)

**UI Layout**:
```
┌─────────────────────────────────────┐
│ Prompts Management                  │
├─────────────────────────────────────┤
│ ▼ System (4)                        │
│   ├─ SYS_ROUTER_V1 [Edit]           │
│   ├─ SYS_ORCHESTRATOR_V1 [Edit]     │
│   └─ ...                             │
│                                      │
│ ▼ Medical (3)                       │
│   ├─ MED_RADIOLOGY_V1 [Edit]        │
│   └─ ...                             │
│                                      │
│ ▼ Financial (3)                     │
│ ▼ Legal (2)                         │
│ ▼ General (1)                       │
└─────────────────────────────────────┘

[Expanded View for SYS_ROUTER_V1]
┌─────────────────────────────────────┐
│ SYS_ROUTER_V1                       │
│ Version: 1.0.0  Domain: System      │
│ Model: qwen3-vl:8b  Type: multimodal│
│                                      │
│ System Prompt:                      │
│ ┌─────────────────────────────────┐ │
│ │ <|begin_of_text|>...            │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                      │
│ User Template:                      │
│ ┌─────────────────────────────────┐ │
│ │ <|start_header_id|>user...      │ │
│ └─────────────────────────────────┘ │
│                                      │
│ Template Variables:                 │
│ [source_system] [filename]          │
│ [resolution] [file_size]            │
│                                      │
│ Configuration:                      │
│ Temperature: [0.2]  MaxTokens: [1024] │
│ Top K: [40]  Top P: [0.9]           │
│                                      │
│ [Save Changes] [Reset to Default]   │
└─────────────────────────────────────┘
```

#### New API: `/api/prompts`

**Location**: `routes/api/prompts.js`

**Endpoints**:

```javascript
GET /api/prompts
// Returns all registered prompts
// Response: { prompts: [{ id, version, domain, model, ... }] }

GET /api/prompts/:id
// Returns specific prompt by ID
// Response: { id, version, domain, model, systemPrompt, userTemplate, config }

PUT /api/prompts/:id
// Update prompt (systemPrompt, userTemplate, config only)
// Body: { systemPrompt?, userTemplate?, config? }
// Response: { success: true, prompt: {...} }

POST /api/prompts/:id/reset
// Reset prompt to built-in default
// Response: { success: true, prompt: {...} }

POST /api/prompts/:id/test
// [Future] Test prompt with sample data
// Body: { variables: {...}, imageData?: base64 }
// Response: { success: true, messages: [...], options: {...} }
```

**Implementation Details**:
- Use `promptRegistry.get()`, `promptRegistry.register({ overwrite: true })` for mutations
- Persist custom prompts to `data/prompts.json` (loaded at startup)
- Validate prompt structure before accepting updates
- Auto-detect template variables using regex `/\{\{([^}]+)\}\}/g`
- Admin-only (use `requireAdmin` middleware)

#### Prompt Persistence

**Storage**: `data/prompts.json`

**Structure**:
```json
{
  "overrides": {
    "SYS_ROUTER_V1": {
      "systemPrompt": "...",
      "userTemplate": "...",
      "config": { "temperature": 0.2, ... }
    }
  },
  "metadata": {
    "lastModified": "2026-02-07T10:30:00Z",
    "modifiedBy": "admin"
  }
}
```

**Load Strategy**:
- Load built-in prompts from PromptRegistry first
- Load overrides from `data/prompts.json` if exists
- Apply overrides using `promptRegistry.register({ overwrite: true })`

**Reset Strategy**:
- Remove override from `data/prompts.json`
- Re-register built-in default from module exports

---

## Implementation Status

### Phase 1: Expert Model Token Limits ✅
- [x] Extend `DeveloperSettingsIsland.tsx` with new section (lines 85-120, 590-820)
- [x] Uses `/api/settings/save` endpoint (lines 285-329)
- [x] All 10 new env vars exposed in UI
- [x] Visual tier grouping with "capped 32k" badges
- [x] Manual save workflow with restart notification

**Location**: `C:\Users\pwalc\MyApps\paperless-ai\src\islands\DeveloperSettingsIsland.tsx:590-820`

### Phase 2: Prompts API ✅
- [x] Create `routes/api/prompts.js` (lines 1-213)
- [x] Implement GET `/api/prompts` (list all with domain counts)
- [x] Implement GET `/api/prompts/:id` (get one)
- [x] Implement PUT `/api/prompts/:id` (update)
- [x] Implement POST `/api/prompts/:id/reset` (reset to default)
- [x] Add template variable auto-detection helper (`extractTemplateVars`)
- [x] Wire up to Express app (`server.js:803`)
- [ ] POST `/api/prompts/:id/test` (future feature - not implemented)

**Location**: `C:\Users\pwalc\MyApps\paperless-ai\routes\api\prompts.js:1-213`

### Phase 3: Prompts Persistence ✅
- [x] Inline implementation in `routes/api/prompts.js` (no separate service)
- [x] Implement `loadOverrides()` from `data/prompts.json` (lines 24-31)
- [x] Implement `saveOverrides()` (lines 34-41)
- [x] Override removal in reset handler (lines 199)
- [x] Add startup loader in `server.js` (lines 1465-1490)

**Note**: Persistence logic is inline in API routes rather than separate service file.

### Phase 4: Prompts UI ✅
- [x] Create `src/islands/PromptsSettingsIsland.tsx` (lines 1-448)
- [x] Implement grouped list view (by domain)
- [x] Implement expandable editor (single-expand behavior)
- [x] Implement save/reset actions
- [x] Add template variable detection and display
- [x] Contract: `src/ui/contracts/Settings.Prompts.contract.ts`
- [x] Admin-only access enforced in API

**Location**: `C:\Users\pwalc\MyApps\paperless-ai\src\islands\PromptsSettingsIsland.tsx:1-448`

### Phase 5: Testing ⚠️
- [ ] Unit tests for prompt persistence
- [ ] Integration tests for `/api/prompts` endpoints
- [ ] E2E test for prompt editing workflow
- [ ] Verify override persistence across restarts
- [ ] Verify reset restores built-in defaults

**Status**: Testing not yet implemented

---

## File Paths Reference

| Component | Path |
|-----------|------|
| PromptRegistry (source) | `C:\Users\pwalc\MyApps\paperless-ai\services\prompts\PromptRegistry.js` |
| Config (token limits) | `C:\Users\pwalc\MyApps\paperless-ai\config\config.js` |
| Settings API (extend) | `C:\Users\pwalc\MyApps\paperless-ai\routes\api\settings.js` |
| New Prompts API | `C:\Users\pwalc\MyApps\paperless-ai\routes\api\prompts.js` |
| Developer Settings Island | `C:\Users\pwalc\MyApps\paperless-ai\src\islands\DeveloperSettingsIsland.tsx` |
| New Prompts Island | `C:\Users\pwalc\MyApps\paperless-ai\src\islands\PromptsSettingsIsland.tsx` |
| Prompt Overrides Storage | `C:\Users\pwalc\MyApps\paperless-ai\data\prompts.json` |

---

## Implementation Notes

### Actual Implementation vs Design

**Prompts Persistence**:
- Design specified separate `services/prompts/PromptPersistence.js` service
- Implementation uses inline functions in `routes/api/prompts.js` (lines 17-41)
- Functions: `extractTemplateVars()`, `loadOverrides()`, `saveOverrides()`, `formatPrompt()`
- **Rationale**: Simpler architecture; persistence logic tightly coupled to API routes

**Field Name Handling**:
- API supports both `userTemplate` and legacy `userPromptTemplate` for backward compatibility
- UI and contract use `userTemplate` exclusively
- See `routes/api/prompts.js:47,144` for dual-field handling

**Startup Loading**:
- Prompts loaded from `data/prompts.json` in server startup sequence
- Location: `C:\Users\pwalc\MyApps\paperless-ai\server.js:1465-1490`
- Silent fallback if file doesn't exist (normal on first run)
- Logs count of loaded overrides: `[PromptOverrides] Loaded N prompt override(s)`

**API Endpoint Mount**:
- Mounted at `server.js:803`: `app.use('/api/prompts', promptsApiRoutes)`
- Requires authentication and admin role for all endpoints

**Environment Variables**:
All 10 new Ollama limit variables are exposed in Developer Settings:
- `OLLAMA_CONTEXT_WINDOW`
- `OLLAMA_MAX_RESPONSE_TOKENS`
- `OLLAMA_VISION_CONTEXT_WINDOW`
- `OLLAMA_VISION_MAX_RESPONSE_TOKENS`
- `OLLAMA_VISION_IMAGE_TOKENS`
- `OLLAMA_PLANNER_CONTEXT_WINDOW`
- `OLLAMA_PLANNER_MAX_RESPONSE_TOKENS`
- `OLLAMA_EXPERT_CONTEXT_WINDOW`
- `OLLAMA_EXPERT_MAX_RESPONSE_TOKENS`
- `TRANSLATION_CONTEXT_WINDOW`

---

## Non-Goals

- OpenAI/Azure prompt customization (Ollama local models only)
- Prompt versioning/history (single active version per prompt)
- Multi-user prompt editing (admin-only, single writer)
- Prompt import/export (covered by general settings export in P4.2)
- Visual prompt builder (manual JSON editing only)
- Inline prompt testing (future feature)

---

## Security Considerations

- Admin-only access enforced via `requireAdmin` middleware
- No user input interpolation into prompts (template variables only)
- Prompt validation to prevent malicious templates
- File system writes restricted to `data/prompts.json`

---

## Performance Considerations

- Prompts loaded once at startup (no runtime registry changes)
- Override file read/write only on admin changes (infrequent)
- No caching needed (registry is in-memory singleton)

---

## Backward Compatibility

- Built-in prompts remain default if no overrides exist
- Legacy `PromptFactory` unaffected (deprecated, separate code path)
- Inline prompts in config.js (`specialPromptPreDefinedTags`, `mustHavePrompt`) remain unchanged
- Existing env vars for token limits remain functional
- API supports both `userTemplate` and legacy `userPromptTemplate` field names

---

## Verification Summary

**Implementation Audit Date**: 2026-02-07

### ✅ Fully Implemented

**Ollama Model Token Limits**:
- All 5 tier groups (Text, Vision, Planner, Expert, Translation)
- All 10 environment variables
- Visual tier badges and caps
- Manual save workflow with restart notification

**Prompts API**:
- All CRUD endpoints (GET list, GET one, PUT update, POST reset)
- Template variable auto-detection
- Admin-only access control
- Persistence to `data/prompts.json`
- Startup loading

**Prompts UI**:
- Domain-grouped accordion
- Inline expandable editor
- Template variable display
- Save/Reset actions
- Modified indicators
- Unsaved changes protection

### ⚠️ Deviations from Design

1. **Persistence Architecture**: Inline functions in API routes instead of separate service file
   - **Impact**: None; simpler architecture
   - **Location**: `routes/api/prompts.js:17-41`

2. **Field Name Compatibility**: Dual support for `userTemplate` / `userPromptTemplate`
   - **Impact**: None; backward compatibility
   - **Location**: `routes/api/prompts.js:47,144`

### ❌ Not Implemented

1. **POST `/api/prompts/:id/test`** - Test prompt with sample data
   - **Status**: Future feature (marked as "[Future]" in design)
   - **Impact**: None; optional debugging feature

2. **Testing Suite**:
   - Unit tests for persistence
   - Integration tests for API
   - E2E tests for UI workflow
   - **Impact**: Manual testing required for validation

### 📋 Future Work

- Implement prompt testing endpoint
- Add comprehensive test coverage
- Consider prompt version history (multi-version support)
- Explore prompt import/export beyond general settings export
