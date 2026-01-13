import asyncio

import pytest
from mcp.shared.exceptions import McpError

from bridge import config
from bridge.router import RequestRouter
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_timeout_error_enriched(monkeypatch):
    state = BridgeState()
    state.connected.set()
    state.ever_connected = True
    router = RequestRouter(state)

    async def fail_call(method, params, timeout):
        raise asyncio.TimeoutError("slow")

    monkeypatch.setattr(router, "_call_session", fail_call)
    monkeypatch.setattr(config, "RETRY_MAX_ATTEMPTS", 0)

    with pytest.raises(McpError) as exc_info:
        await router.forward("tools/call", {"name": "x"}, "id-1")

    message = exc_info.value.error.message
    assert "Bridge timeout" in message