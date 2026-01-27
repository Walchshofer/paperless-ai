# Changelog

## Unreleased
- Fix: Add `config.getRaw` / `config.__getOriginal` helper to expose the unproxied configuration for safe enumeration (e.g., `modelAliases`) and update `services/utils/modelResolver` to prefer raw alias maps; this prevents missing keys when config exports are proxied.
- Bridge: guard initialize handler registration for MCP SDKs that removed
  `set_request_handler`; initialize is handled by ServerSession.
- Bridge: log MCP SDK debug output when LOG_LEVEL=DEBUG and mark
  initialization on first request for observability.
- Bridge: stop persistent logging to default file (`bridge_debug.log`). Logs now go to stderr by default; set `CODEX_BRIDGE_LOG_FILE` to enable file logging.
- Fix: `SetupService.validateConfig` now reads values from proxied config objects using `getRaw` / `__getOriginal` where available (e.g., `PAPERLESS_API_URL` / `paperless.apiUrl`), preventing validation errors when consumers pass the proxied `config` module. Added unit tests for `saveConfig` to stub network validators and cover proxied config paths.
