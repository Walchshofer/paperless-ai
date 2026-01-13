import pytest

from services.bridge.connection import ConnectionManager
from services.bridge.state import BridgeState


@pytest.mark.asyncio
async def test_runtime_disconnect_clears_tools_and_is_idempotent():
    state = BridgeState()
    # Simulate an existing connected session & tools
    state.tools = [{"name": "tool-x"}]
    state.tools_ready.set()

    cm = ConnectionManager(state)

    # Call disconnect handler as runtime disconnect (clean=False)
    await cm._handle_disconnect(clean=False)

    assert state.tools == []
    assert not state.tools_ready.is_set()

    # Calling again should be idempotent (no exception, same result)
    await cm._handle_disconnect(clean=False)
    assert state.tools == []
    assert not state.tools_ready.is_set()
