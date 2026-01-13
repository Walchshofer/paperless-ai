import pytest

from mcp.shared.exceptions import McpError

from bridge import config
from bridge.router import RequestRouter
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_forward_reports_degraded_mode():
    state = BridgeState()
    state.degraded.set()
    state.ever_connected = True
    state.reconnect_failures = config.MAX_RECONNECT_ATTEMPTS
    router = RequestRouter(state)

    with pytest.raises(McpError) as exc_info:
        await router.forward("tools/list", {}, "id-1")

    assert "retries exhausted" in exc_info.value.error.message