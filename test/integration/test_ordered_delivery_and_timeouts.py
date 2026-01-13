import asyncio

import pytest
from mcp.shared.exceptions import McpError

from bridge.router import RequestRouter
from bridge.state import BridgeState


class _BlockingSession:
    def __init__(self, event: asyncio.Event) -> None:
        self.event = event

    async def call_tool(self, name, arguments):
        await self.event.wait()
        return {"name": name, "arguments": arguments}


@pytest.mark.asyncio
async def test_connection_lost_unblocks_waiters():
    event = asyncio.Event()
    state = BridgeState()
    state.connected.set()
    state.ever_connected = True

    async with state.session_lock:
        state.session = _BlockingSession(event)

    router = RequestRouter(state)

    task = asyncio.create_task(
        router.forward("tools/call", {"name": "x"}, "req-1")
    )
    await asyncio.sleep(0)
    state.connection_lost.set()

    with pytest.raises(McpError) as exc_info:
        await task

    assert "Connection to Serena lost" in exc_info.value.error.message