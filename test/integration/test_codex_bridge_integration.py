import pytest

import mcp.types as types

from bridge.router import RequestRouter
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_tools_list_uses_cached_tools():
    state = BridgeState()
    state.connected.set()
    async with state.session_lock:
        state.session = object()
    state.tools = [
        types.Tool(
            name="search_code",
            description="test",
            inputSchema={},
        )
    ]
    state.tools_ready.set()

    router = RequestRouter(state)
    result = await router.forward("tools/list", {}, "id-1")

    assert isinstance(result, types.ListToolsResult)
    assert result.tools[0].name == "search_code"