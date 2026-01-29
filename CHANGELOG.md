# Changelog

## Unreleased

### Feat: Frontend Refactoring & Manual Route Enhancements (Epic 4c9b7999)
- **Visual Search Panel**: Integrated a split-view panel into `OverlayViewerIsland` to display visually similar regions using Visual RAG MaxSim retrieval.
- **Bi-directional Chat Integration**:
  - Added "Send to Chat" functionality for visual regions and text excerpts.
  - Implemented clickable visual references in chat responses that navigate to Manual mode and highlight document regions.
- **In-Document Search**: Replaced static text preview with `DocumentContentIsland`, supporting regex search, case-sensitivity, and auto-scrolling to matches.
- **Advanced Export**: New `ExportPanelIsland` allowing users to export visual regions (PNG/PDF), text (TXT/PDF), and annotations (JSON).
- **Zoom & Pan**: Added robust zoom/pan controls to `OverlayViewerIsland` for better document inspection.
- **Model Selection**: Enhanced `ChatWorkspaceIsland` to support multi-provider model selection (Ollama, OpenAI, Azure, Custom).
- **Architecture**: Enforced strict Zod-validated View Model (VM) contracts across all refactored routes.
- Fix: Add `config.getRaw` / `config.__getOriginal` helper to expose the unproxied configuration for safe enumeration (e.g., `modelAliases`) and update `services/utils/modelResolver` to prefer raw alias maps; this prevents missing keys when config exports are proxied.
- Bridge: guard initialize handler registration for MCP SDKs that removed
  `set_request_handler`; initialize is handled by ServerSession.
- Bridge: log MCP SDK debug output when LOG_LEVEL=DEBUG and mark
  initialization on first request for observability.
- Bridge: stop persistent logging to default file (`bridge_debug.log`). Logs now go to stderr by default; set `CODEX_BRIDGE_LOG_FILE` to enable file logging.
- Fix: `SetupService.validateConfig` now reads values from proxied config objects using `getRaw` / `__getOriginal` where available (e.g., `PAPERLESS_API_URL` / `paperless.apiUrl`), preventing validation errors when consumers pass the proxied `config` module. Added unit tests for `saveConfig` to stub network validators and cover proxied config paths.
- Fix: `ChatRepository.appendMessage` now computes `message_index` using nullish coalescing to avoid reusing index 0 when prior max index is 0 (fixes off-by-one/falsy check). (`services/repositories/chatRepository.js`)
- Fix: `ChatService` now hydrates persisted chat history on initialization when `chatPersistence` is enabled and returns `history` in the initialize response; added documentation in `docs/CHAT_HISTORY_PERSISTENCE.md` and unit tests to verify rehydration. (`services/chatService.js`)
- Docs: Added `docs/MODEL_RESOLUTION.md` to document model alias resolution API and usage.
- Feat(Settings): Integrate `ModelResolutionService` with the Settings route
  - GET `/settings` now exposes `availableModels` and a normalized `expertModels` array on the view-model to make provider model choices available to the UI.
  - Model validation is permissive when provider discovery returns an empty or unreachable model list to avoid blocking initial setup; explicit rejections only occur when the provider list indicates the model is unavailable.
  - Added `ModelResolutionService.clearCache()` and call it after successful settings save so model discovery reflects new configuration immediately.
  - Normalized `expertModels` shape to `{ category, role, model }` and updated contracts/tests accordingly.
  - Added unit tests covering permissive validation and cache clearing.

### Fix: Enhanced global error handler, friendly error page, and structured logging (2026-01-29)
- **Error handling**: Added a 404 middleware and an enhanced global error handler that distinguishes status codes, logs structured context (method, URL, user when available, stack), and exposes error details only in `development`.
- **API behavior**: API routes (`/api/*`) now return JSON errors (`{ error: 'internal_error' | 'not_found', message: '...' }`).
- **User experience**: Added `views/error.ejs` to render a friendly error page (details shown only in development).
- **Tests**: Added `test/routes/error.handler.test.js` to guard 404, 500 HTML rendering, and API JSON responses.
- **Docs**: Added `docs/ERROR_HANDLING.md` describing the error page and logging behavior.

### Fix: Robust build-time gRPC validation for bias-engine (2026-01-29)
- **Build-Time Generation**: Enforced gRPC binding generation during the Docker build process for `bias-engine`.
- **Robust Validation**: Updated `setup_grpc.sh` to include `set -e` and explicit checks for existence and validity of generated files.
- **Dockerfile Enhancement**: Added cross-platform line-ending fixes and fail-fast build logic if proto generation fails.
- **Simplified Runtime**: Removed fragile runtime fallback generation from `grpc_server.py` to improve production reliability.
- **CI/CD Quality Gate**: Added `.github/workflows/bias-engine-proto-check.yml` to verify proto compilation and Python imports on every PR.
- **Testing**: Added unit tests in `containers/bias-engine/guidance/tests/` covering proto modules and gRPC servicer logic.
- **Documentation**: Updated `README.md`, `USAGE_GUIDE.md`, and `README_PATCH.md` to reflect the optimized build process and troubleshooting steps.
