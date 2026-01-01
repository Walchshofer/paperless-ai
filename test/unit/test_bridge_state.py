import asyncio

from bridge.state import BridgeState


def test_bridge_state_init_and_close():
    async def _run():
        state = BridgeState()

        assert state.session is None
        assert not state.connected.is_set()
        assert not state.tools_ready.is_set()
        assert not state.shutdown.is_set()
        assert not state.reconnect_needed.is_set()
        assert not state.connection_lost.is_set()
        assert state.ever_connected is False
        assert state.is_running()

        async with state.session_lock:
            assert state.session_lock.locked()

        await state.close()
        assert state.session is None
        assert state.tools == []
        assert not state.connected.is_set()
        assert not state.tools_ready.is_set()
        assert not state.connection_lost.is_set()
        assert state.ever_connected is False

    asyncio.run(_run())


def test_is_running_reflects_shutdown():
    state = BridgeState()
    assert state.is_running()
    state.shutdown.set()
    assert not state.is_running()