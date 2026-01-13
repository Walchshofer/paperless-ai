import asyncio
import os

import pytest

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.router import RequestRouter
from bridge.state import BridgeState


pytestmark = pytest.mark.skipif(
    not os.environ.get("SERENA_E2E"),
    reason="SERENA_E2E not set - skipping E2E tests",
)


@pytest.mark.asyncio
async def test_serena_discover_and_call_tool():
    """End-to-end test for real Serena tools/list and tools/call."""
    assert os.environ.get("SERENA_BASE"), "SERENA_BASE must be set"

    state = BridgeState()
    orderer = ResponseOrderer()
    router = RequestRouter(state)
    manager = ConnectionManager(state, orderer)

    manager.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=30.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=30.0)

        tools_result = await router.forward(
            "tools/list",
            {},
            "e2e-tools-list",
        )
        assert tools_result is not None

        tool_name = None
        tools = getattr(tools_result, "tools", [])
        for tool in tools:
            name = getattr(tool, "name", None)
            if not name and isinstance(tool, dict):
                name = tool.get("name")
            if name == "get_current_config":
                tool_name = name
                break

        if tool_name:
            call_result = await router.forward(
                "tools/call",
                {"name": tool_name, "arguments": {}},
                "e2e-call",
            )
            assert call_result is not None
    finally:
        await manager.stop()