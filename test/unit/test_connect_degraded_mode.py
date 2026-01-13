import asyncio

import pytest

from bridge import config
from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_connect_enters_degraded_mode(monkeypatch):
    state = BridgeState()
    state.ever_connected = True
    cm = ConnectionManager(state, ResponseOrderer())
    cm._running = True
    cm._ever_connected = True

    async def fail_connect():
        raise RuntimeError("fail")

    monkeypatch.setattr(cm, "_connect_once", fail_connect)
    monkeypatch.setattr(config, "MAX_RECONNECT_ATTEMPTS", 2)
    monkeypatch.setattr(config, "RECONNECT_BACKOFF_BASE", 0.01)
    monkeypatch.setattr(config, "RECONNECT_BACKOFF_MAX", 0.01)

    task = asyncio.create_task(cm._connect_loop())
    await asyncio.sleep(0.05)
    state.shutdown.set()
    cm._running = False
    await task

    assert state.degraded.is_set()