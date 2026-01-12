import asyncio
import importlib.util
from pathlib import Path
import sys

# Load codex-bridge module for tests
_spec_location = Path(__file__).resolve().parents[2] / "codex-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)


async def _fake_forward_factory():
    calls = {"count": 0}

    async def _fake_forward(request, *, raise_on_error=False):
        calls["count"] += 1
        if calls["count"] <= 2:
            raise asyncio.TimeoutError("simulated timeout")
        return bridge.jsonrpc_result(request.get("id"), {"ok": True})

    return _fake_forward, calls


def test_forward_retries(monkeypatch):
    async def scenario():
        # Arrange
        fake_forward, calls = await _fake_forward_factory()
        monkeypatch.setattr(bridge, "forward_request", fake_forward)

        # Avoid actual sleeps
        async def _nosleep(t):
            return None
        monkeypatch.setattr(asyncio, "sleep", _nosleep)

        # Register pending request to allow match_response to emit
        req = {"jsonrpc": "2.0", "id": 42, "method": "tools/call", "params": {}}
        bridge.state.pending_requests[42] = bridge.PendingRequest(42, asyncio.get_running_loop().create_future())

        # Act
        await bridge._forward_and_match(req)

        # Wait for delivery queue
        out = await bridge.state.response_delivery_queue.get()

        # Assert
        assert out.get("id") == 42
        assert calls["count"] == 3

    asyncio.run(scenario())
