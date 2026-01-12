---
id: "75e3f5ca-2134-4269-895a-8a75d040e666"
title: "Core Infrastructure & State Management"
assignee: ""
status: 0
createdAt: "1768224262093"
updatedAt: "1768224393143"
type: ticket
---

# Core Infrastructure & State Management

## Objective

Implement the foundational infrastructure for the v4.0 bridge: state management, configuration, logging, and basic async scaffolding.

## Scope

**Included:**
- `BridgeState` class with asyncio synchronization primitives (Events, Locks)
- Configuration loading from environment variables
- Logging infrastructure (stderr-only, no stdout pollution)
- Basic async main loop structure
- Graceful shutdown handling

**Excluded:**
- Connection to Serena (handled in Ticket 2)
- Request routing logic (handled in Ticket 3)
- Error handling and retries (handled in Ticket 4)

## Spec References

- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Data Model section (BridgeState, configuration)
- `spec:cc933dfe-2d44-4bf7-9acf-59674d03f4b1/e73e3f6d-2801-4830-85b4-f76ee5cb3efd` - Constraints section (STDIO purity, 79-char limit)

## Key Deliverables

1. **BridgeState Class**
   - `session: Optional[ClientSession]`
   - `connected: asyncio.Event`
   - `tools: List[Dict]`, `tools_ready: asyncio.Event`
   - `shutdown: asyncio.Event`, `reconnect_needed: asyncio.Event`
   - `session_lock: asyncio.Lock`

2. **Configuration Constants**
   - Load from environment variables with defaults
   - `SERENA_SSE_URL`, `SERENA_API_KEY`, `LOG_LEVEL`
   - Timeout policy map (nested dict structure)
   - Retry configuration

3. **Logging Functions**
   - `log(message)` - writes to stderr only
   - Timestamp formatting
   - Log level filtering

4. **Main Entry Point**
   - `async_main()` - sets up event loop
   - `main()` - entry point that calls `asyncio.run()`
   - Signal handling for graceful shutdown

## Acceptance Criteria

- [ ] BridgeState class implemented with all required fields
- [ ] Configuration loaded from environment variables with documented defaults
- [ ] Logging writes to stderr only (no stdout pollution)
- [ ] Bridge can start and shut down gracefully
- [ ] Code adheres to 79-character line limit per `file:AGENTS.md`
- [ ] Unit tests for BridgeState initialization and configuration loading

## Dependencies

None (foundational ticket)

## Estimated Complexity

**Medium** - Straightforward infrastructure setup, but requires careful attention to async patterns and logging discipline.
