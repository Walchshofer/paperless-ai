import asyncio
import importlib.util
import os
from pathlib import Path

# Ensure bridge uses test stubs
os.environ.setdefault("BRIDGE_TEST_STUBS", "1")
_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
import sys
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)

import pytest


@pytest.mark.asyncio
async def test_forward_request_preserves_pending_on_error():
    # Ensure primitives are bound to this loop
    bridge.state.ensure_async_primitives()

    # Register a pending request to simulate an in-flight call
    pending = bridge.PendingRequest("id-1", asyncio.get_running_loop().create_future())
    async with bridge.state.pending_requests_lock:
        bridge.state.pending_requests["id-1"] = pending

    # Create a bad session that raises when a tool is called
    class BadSession:
        async def call_tool(self, name, args):
            raise RuntimeError("boom")

    # Inject the bad session and mark connected
    async with bridge.state.session_lock:
        bridge.state.session = BadSession()
    bridge.state.connected.set()

    # Forward a tools/call request (should return an error but leave pending)
    req = {"id": "id-1", "method": "tools/call", "params": {"name": "tool-a", "arguments": {}}}
    res = await bridge.forward_request(req, raise_on_error=False)

    assert "error" in res

    # Pending request should still be present (we didn't clear it)
    async with bridge.state.pending_requests_lock:
        assert "id-1" in bridge.state.pending_requests

    # Reconnect flag should be set so connector will attempt to re-establish
    assert bridge.state.reconnect_needed.is_set()
