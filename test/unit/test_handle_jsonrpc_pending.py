import asyncio

import pytest

from bridge.router import RequestRouter
from bridge.state import BridgeState


class _BlockingSession:
    def __init__(self, event: asyncio.Event) -> None:
        self.event = event

    async def call_tool(self, name, arguments):
        await self.event.wait()
        return {"name": name, "arguments": arguments}


@pytest.mark.asyncio
async def test_forward_registers_and_clears_pending():
    event = asyncio.Event()
    state = BridgeState()
    router = RequestRouter(state)

    async with state.session_lock:
        state.session = _BlockingSession(event)
    state.connected.set()

    task = asyncio.create_task(
        router.forward("tools/call", {"name": "foo"}, "req-1")
    )

    await asyncio.sleep(0)
    async with state.pending_requests_lock:
        assert "req-1" in state.pending_requests

    event.set()
    await task

    async with state.pending_requests_lock:
        assert "req-1" not in state.pending_requests