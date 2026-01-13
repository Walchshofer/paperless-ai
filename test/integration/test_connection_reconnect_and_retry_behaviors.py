import asyncio

import pytest

import bridge.connection as connection
from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


class _BadSSE:
    async def __aenter__(self):
        raise RuntimeError("connect failed")

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_reconnect_exhaustion_enters_degraded_mode(monkeypatch):
    state = BridgeState()
    state.ever_connected = True
    cm = ConnectionManager(state, ResponseOrderer())
    cm._ever_connected = True

    def bad_sse_client(*_args, **_kwargs):
        return _BadSSE()

    monkeypatch.setattr(connection, "sse_client", bad_sse_client)
    monkeypatch.setattr(connection.config, "MAX_RECONNECT_ATTEMPTS", 2)
    monkeypatch.setattr(connection.config, "RECONNECT_BACKOFF_BASE", 0.01)
    monkeypatch.setattr(connection.config, "RECONNECT_BACKOFF_MAX", 0.01)

    cm.start()
    try:
        await asyncio.wait_for(state.degraded.wait(), timeout=1.0)
        assert state.degraded.is_set()
    finally:
        await cm.stop()