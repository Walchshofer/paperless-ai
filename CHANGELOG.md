# Changelog

## Unreleased
- Bridge: guard initialize handler registration for MCP SDKs that removed
  `set_request_handler`; initialize is handled by ServerSession.
- Bridge: log MCP SDK debug output when LOG_LEVEL=DEBUG and mark
  initialization on first request for observability.
- Bridge: stop persistent logging to default file (`bridge_debug.log`). Logs now go to stderr by default; set `CODEX_BRIDGE_LOG_FILE` to enable file logging.
