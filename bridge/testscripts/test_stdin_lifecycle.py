"""Manual STDIO lifecycle probe for the bridge."""
from __future__ import annotations

import json
import sys
from typing import Any

import anyio
from mcp import types
from mcp.server.stdio import stdio_server
from mcp.shared.message import SessionMessage


async def _respond_initialize(
    request: types.JSONRPCRequest,
    write_stream: Any,
) -> None:
    """Respond to an MCP initialize request with minimal capabilities."""
    response = types.JSONRPCResponse(
        jsonrpc="2.0",
        id=request.id,
        result={
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "serverInfo": {
                "name": "stdin-lifecycle-probe",
                "version": "0.1.0",
            },
        },
    )
    await write_stream.send(
        SessionMessage(types.JSONRPCMessage(response)),
    )


async def main() -> None:
    """Keep STDIO open and optionally echo an initialize response."""
    async with stdio_server() as (read_stream, write_stream):
        print(
            "entered stdio_server, waiting for input (5s)...",
            file=sys.stderr,
        )

        async def reader() -> None:
            try:
                with anyio.move_on_after(5):
                    session_message = await read_stream.receive()
            except Exception as exc:  # pragma: no cover
                print(f"receive failed: {exc}", file=sys.stderr)
                return

            if "session_message" not in locals() or session_message is None:
                print("no input received within 5s", file=sys.stderr)
                return
            if isinstance(session_message, Exception):
                print(
                    f"received exception: {session_message}",
                    file=sys.stderr,
                )
                return

            msg = session_message.message
            print(f"received: {msg}", file=sys.stderr)

            is_request = isinstance(msg, types.JSONRPCRequest)
            if is_request and msg.method == "initialize":
                await _respond_initialize(msg, write_stream)
                print("initialize response sent", file=sys.stderr)
            else:
                try:
                    response = types.JSONRPCResponse(
                        jsonrpc="2.0",
                        id=msg.id if hasattr(msg, "id") else 1,
                        result={"echo": json.loads(msg.model_dump_json())},
                    )
                    await write_stream.send(
                        SessionMessage(types.JSONRPCMessage(response)),
                    )
                    print("echo response sent", file=sys.stderr)
                except Exception as exc:  # pragma: no cover
                    print(f"echo send failed: {exc}", file=sys.stderr)

        async with anyio.create_task_group() as tg:
            tg.start_soon(reader)
            await anyio.sleep(5)
            tg.cancel_scope.cancel()

    print("exited stdio_server", file=sys.stderr)


if __name__ == "__main__":
    anyio.run(main)
