# Changelog

## Unreleased
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