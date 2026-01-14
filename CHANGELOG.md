# Changelog

## Unreleased
- Bridge: guard initialize handler registration for MCP SDKs that removed
  `set_request_handler`; initialize is handled by ServerSession.
- Bridge: log MCP SDK debug output when LOG_LEVEL=DEBUG and mark
  initialization on first request for observability.
