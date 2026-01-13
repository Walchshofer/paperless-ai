import asyncio
import importlib.util
import sys
from pathlib import Path


# Helper to load a fresh bridge module namespace for tests
import os

def load_bridge_module(module_name="codex_bridge_test"):
    # Ensure test stub loader is enabled for these unit tests
    os.environ.setdefault("BRIDGE_TEST_STUBS", "1")
    _spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
    spec = importlib.util.spec_from_file_location(module_name, _spec_location)
    bridge = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = bridge
    spec.loader.exec_module(bridge)
    return bridge


import pytest


@pytest.mark.asyncio
async def test_forward_request_timeout_preserves_pending_and_signals_reconnect():
    bridge = load_bridge_module("codex_bridge_forward_test")
    state = bridge.state

    # Ensure we are in a connected state (so forward_request proceeds)
    state.connected.set()

    class _BadSession:
        async def call_tool(self, name, arguments):
            raise asyncio.TimeoutError()

    state.session = _BadSession()

    # Pre-populate a pending request to ensure it does not get cleared
    state.pending_requests.clear()
    future = asyncio.get_running_loop().create_future()
    state.pending_requests[42] = bridge.PendingRequest(42, future)

    resp = await bridge.forward_request({"id": 42, "method": "tools/call", "params": {"name": "x", "arguments": {}}}, raise_on_error=False)

    assert "error" in resp
    assert resp["error"]["message"] == "Timeout waiting for Serena response"
    # The pending request should still be present (no premature clearing)
    assert 42 in state.pending_requests
    # Reconnect should have been signaled, not a full session clear
    assert state.reconnect_needed.is_set()


@pytest.mark.asyncio
async def test_connect_to_serena_enters_degraded_mode_after_exhaustion():
    bridge = load_bridge_module("codex_bridge_degraded_test")
    state = bridge.state

    # Make the sse_client always fail immediately
    async def failing_sse(*args, **kwargs):
        raise RuntimeError("connect-failed")

    bridge.sse_client = failing_sse

    # Run connector as a background task with a low max_attempts so it will
    # quickly hit the exhaustion branch. We let it run briefly and then assert
    # it has entered degraded conditions rather than setting shutdown.
    task = asyncio.create_task(bridge.connect_to_serena(max_attempts=1))
    try:
        await asyncio.sleep(0.25)
        # Connector should still be alive but not have shut down the bridge
        assert not state.shutdown.is_set()
        # The failure counter should be populated
        assert state.reconnect_failures >= 1
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
