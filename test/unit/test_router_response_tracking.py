import pytest

from mcp.shared.exceptions import McpError

from bridge import config
from bridge.router import RequestRouter
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_pending_responses_incremented(monkeypatch):
    state = BridgeState()
    state.connected.set()
    state.ever_connected = True
    router = RequestRouter(state)

    async def fake_call(_method, _params, _timeout):
        async with state.pending_responses_lock:
            assert state.pending_responses == 1
        return {"ok": True}

    monkeypatch.setattr(router, "_call_session", fake_call)

    result = await router.forward("tools/list", {}, "id-1")

    assert result == {"ok": True}
    async with state.pending_responses_lock:
        assert state.pending_responses == 0


@pytest.mark.asyncio
async def test_pending_responses_decrement_on_error(monkeypatch):
    state = BridgeState()
    state.connected.set()
    state.ever_connected = True
    router = RequestRouter(state)

    async def fail_call(_method, _params, _timeout):
        raise RuntimeError("boom")

    monkeypatch.setattr(router, "_call_session", fail_call)
    monkeypatch.setattr(config, "RETRY_MAX_ATTEMPTS", 0)

    with pytest.raises(McpError):
        await router.forward("tools/list", {}, "id-1")

    async with state.pending_responses_lock:
        assert state.pending_responses == 0
