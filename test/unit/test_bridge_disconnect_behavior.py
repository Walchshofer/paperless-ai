import pytest

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_disconnect_clears_tools_and_sets_lost():
    state = BridgeState()
    state.tools = [{"name": "tool-x"}]
    state.tools_ready.set()
    state.connected.set()
    state.ever_connected = True

    cm = ConnectionManager(state, ResponseOrderer())
    await cm._handle_disconnect(
        clean=False,
        reason="connection_error",
        notify=True,
    )

    assert state.tools == []
    assert not state.tools_ready.is_set()
    assert state.connection_lost.is_set()


@pytest.mark.asyncio
async def test_disconnect_no_notify_skips_lost_flag():
    state = BridgeState()
    state.tools = [{"name": "tool-x"}]
    state.tools_ready.set()

    cm = ConnectionManager(state, ResponseOrderer())
    await cm._handle_disconnect(
        clean=True,
        reason="shutdown",
        notify=False,
    )

    assert state.tools == []
    assert not state.tools_ready.is_set()
    assert not state.connection_lost.is_set()