# STDIO Diagnostic Results

Timestamp: 2026-01-13T22:10:00

## Summary
All three scenarios show the server task completing immediately. The STDIO
observer reports a timeout (manual TTY), a JSON parse error (piped empty
input), or a valid initialize message (piped JSON). Even when initialize is
seen, the server task still finishes right away. This points to **Scenario C**
in the ticket (server task completes immediately), likely triggered by stdin
EOF/closure (Scenario A as the underlying cause).

## Scenario 1: Manual Run (stdin open)

Command:
```
.\.venv\Scripts\python bridge\testscripts\test_stdin_lifecycle.py
```

Output:
```
== stdin availability ==
stdin.closed: false
stdin.isatty: true
stdin.readable: true
== stdio lifecycle ==
stdio.lifecycle.start
stdio.entered: true
server.run.start
stdio.read_timeout.start
read.observe.start
read.result: timeout
initialize.seen: false
server.task.done: true
stdio.duration_s: 4.006
== classification ==
scenario: C
```

## Scenario 2: Closed stdin (pipe empty)

Command:
```
"" | .\.venv\Scripts\python bridge\testscripts\test_stdin_lifecycle.py
```

Output:
```
== stdin availability ==
stdin.closed: false
stdin.isatty: false
stdin.readable: true
== stdio lifecycle ==
stdio.lifecycle.start
stdio.entered: true
server.run.start
stdio.read_timeout.start
read.observe.start
read.exception: 1 validation error for JSONRPCMessage
  Invalid JSON: EOF while parsing a value at line 2 column 0
  [type=json_invalid, input_value='\n', input_type=str]
    For further information visit
    https://errors.pydantic.dev/2.12/v/json_invalid
initialize.seen: false
Received exception from stream: 1 validation error for JSONRPCMessage
  Invalid JSON: EOF while parsing a value at line 2 column 0
  [type=json_invalid, input_value='\n', input_type=str]
    For further information visit
    https://errors.pydantic.dev/2.12/v/json_invalid
{"method":"notifications/message","params":{"level":"error","logger":
"mcp.server.exception_handler","data":"Internal Server Error"},
"jsonrpc":"2.0"}
server.task.done: true
stdio.duration_s: 3.006
== classification ==
scenario: C
```

## Scenario 3: Valid JSON-RPC input

Command:
```
$payload = '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{
  "protocolVersion":"2024-11-05",
  "capabilities":{},
  "clientInfo":{"name":"codex","version":"1.0"}
}}'
$payload | .\.venv\Scripts\python bridge\testscripts\test_stdin_lifecycle.py
```

Output:
```
== stdin availability ==
stdin.closed: false
stdin.isatty: false
stdin.readable: true
== stdio lifecycle ==
stdio.lifecycle.start
stdio.entered: true
server.run.start
stdio.read_timeout.start
read.observe.start
initialize.seen: true
read.result: message
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",
"capabilities":{"experimental":{}},
"serverInfo":{"name":"stdio-diagnostic","version":"0.1.0"}}}
server.task.done: true
stdio.duration_s: 3.006
== classification ==
scenario: C
```

## Analysis
- `server.task.done: true` in all scenarios indicates the MCP server task
  completes almost immediately after STDIO setup.
- Manual TTY shows a read timeout with no initialize seen.
- Empty pipe yields a JSON parse error and server-side error notification.
- Valid JSON shows `initialize.seen: true` and a response, but the server task
  still exits, implying STDIO closes immediately after the initialize flow.

## Root Cause Scenario
- **Scenario C (Server Task Completes Immediately)**  
  Most likely triggered by stdin EOF/closure (Scenario A) once CODEX spawns
  the process and closes the input stream after initialization.

## Recommended Fix Approach
- Keep the server task alive even if stdin closes (EOF) by:
  - Deferring shutdown if `server.run` returns without exception.
  - Adding a keepalive/monitor task that keeps the process up unless explicit
    shutdown is requested.
  - Optionally validate CODEX config to ensure STDIN is not closed after spawn.
