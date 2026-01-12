---
id: "77c5032b-0f68-4812-895b-5e71279f3e02"
title: "Connection Manager & SSE Lifecycle"
assignee: ""
status: 0
createdAt: "1768224280032"
updatedAt: "1768224393160"
type: ticket
---

# Connection Manager & SSE Lifecycle

## Objective

Implement the Connection Manager component that establishes and maintains the SSE connection to Serena with retry logic and graceful degradation.

## Scope

**Included:**
- SSE connection establishment using `mcp.client.sse.sse_client`
- MCP session initialization using `ClientSession`
- Tool fetching and caching
- Retry logic with exponential backoff (indefinite on startup, 10 attempts on reconnection)
- Degraded mode handling
- AsyncExitStack lifecycle management

**Excluded:**
- Request forwarding (handled in Ticket 3)
- STDIO handling (handled in Ticket 3)
- Error enrichment (handled in Ticket 4)

## Spec References

- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/7b341776-0d89-4383-82ec-a2a23840f378` - Flow 1: Connection Lifecycle
- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Component 4: Connection Manager
- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Decision 3: AsyncExitStack

## Key Deliverables

1. **connect_loop() Function**
   - Establish SSE connection to Serena
   - Initialize MCP session with protocol handshake
   - Fetch tools and update `BridgeState.tools`
   - Set `connected` and `tools_ready` events
   - Monitor connection health

2. **Retry Logic**
   - Startup: Retry indefinitely with 2s backoff
   - Reconnection: Up to 10 attempts with exponential backoff (2s, 4s, 8s, 16s, 30s max)
   - Degraded mode after retry exhaustion

3. **handle_disconnect() Function**
   - Clear `BridgeState.session`
   - Fail all in-flight requests (add to `completed_requests`)
   - Clear `response_buffer` and `completed_requests`
   - Trigger reconnection sequence

4. **fetch_tools() Function**
   - Send `tools/list` to Serena via `ClientSession.list_tools()`
   - Cache result in `BridgeState.tools`
   - Set `tools_ready` event

## Acceptance Criteria

- [ ] Bridge can establish SSE connection to Serena on startup
- [ ] Bridge retries indefinitely if Serena is unavailable at startup
- [ ] Bridge re-fetches tools after successful reconnection
- [ ] Bridge enters degraded mode after 10 failed reconnection attempts
- [ ] Connection drop clears response buffer to prevent memory leaks
- [ ] Integration tests verify connection lifecycle with mock Serena server

## Dependencies

- **Requires**: Ticket 1 (Core Infrastructure)

## Estimated Complexity

**High** - Complex async lifecycle management, retry logic, and state coordination.
