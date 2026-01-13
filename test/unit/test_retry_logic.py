import asyncio

import pytest

from bridge.router import RequestRouter
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_forward_retries_transient_errors(monkeypatch):
    state = BridgeState()
    state.connected.set()
    state.ever_connected = True
    router = RequestRouter(state)
    calls = {"count": 0}

    async def flaky_call(method, params, timeout):
        calls["count"] += 1
        if calls["count"] < 3:
            raise asyncio.TimeoutError("retry")
        return {"ok": True}

    async def no_sleep(_delay):
        return None

    monkeypatch.setattr(router, "_call_session", flaky_call)
    monkeypatch.setattr(asyncio, "sleep", no_sleep)

    result = await router.forward("tools/call", {"name": "x"}, "id-1")

    assert result == {"ok": True}
    assert calls["count"] == 3