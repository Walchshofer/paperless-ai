import pytest

from mcp.shared.exceptions import McpError

from bridge import config
from bridge.router import RequestRouter
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_forward_marks_connection_lost_on_error(monkeypatch):
    state = BridgeState()
    state.connected.set()
    state.ever_connected = True
    router = RequestRouter(state)

    async def fail_call(method, params, timeout):
        raise ConnectionError("boom")

    monkeypatch.setattr(router, "_call_session", fail_call)
    monkeypatch.setattr(config, "RETRY_MAX_ATTEMPTS", 0)

    with pytest.raises(McpError) as exc_info:
        await router.forward("tools/call", {"name": "x"}, "id-1")

    assert "Connection to Serena lost" in exc_info.value.error.message
    assert state.connection_lost.is_set()
    async with state.pending_requests_lock:
        assert "id-1" not in state.pending_requests