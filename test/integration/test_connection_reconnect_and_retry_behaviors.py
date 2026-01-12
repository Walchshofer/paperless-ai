import asyncio
import pytest
from aiohttp import web

import importlib.util
from pathlib import Path

import importlib.util
import sys
# Load bridge module
_spec_location = Path(__file__).resolve().parents[2] / "codex-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)


@pytest.mark.asyncio
async def test_reconnect_exhaustion_enters_degraded_mode(aiohttp_server):
    """Server responds 500 to cause connection failures and exhaustion."""

    async def bad_handler(request):
        return web.Response(status=500)

    app = web.Application()
    app.router.add_get("/sse", bad_handler)
    server = await aiohttp_server(app)
    url = str(server.make_url("/sse"))

    # Simulate repeated connection errors by monkeypatching sse_client
    called = {"count": 0}

    def _bad_sse_client(*args, **kwargs):
        called["count"] += 1
        class _Ctx:
            async def __aenter__(self):
                raise RuntimeError("connect failed")
            async def __aexit__(self, exc_type, exc, tb):
                pass
        return _Ctx()

    # Patch the mcp sse_client used by connect_to_serena
    import mcp.client.sse as sse_mod
    orig_sse = sse_mod.sse_client
    sse_mod.sse_client = _bad_sse_client
    # Also patch the imported name in the bridge module
    orig_bridge_sse = bridge.sse_client
    bridge.sse_client = _bad_sse_client

    # Reduce attempts for test speed
    old_max = bridge.MAX_RECONNECT_ATTEMPTS
    bridge.MAX_RECONNECT_ATTEMPTS = 3
    # Reduce reconnect backoff so the test finishes quickly
    old_backoff_base = bridge.RECONNECT_BACKOFF_BASE
    old_backoff_max = bridge.RECONNECT_BACKOFF_MAX
    bridge.RECONNECT_BACKOFF_BASE = 0.1
    bridge.RECONNECT_BACKOFF_MAX = 0.2

    # Run the connector and expect it to stop the bridge after failures
    connector = asyncio.create_task(bridge.connect_to_serena())
    try:
        await asyncio.wait_for(bridge.state.shutdown.wait(), timeout=10.0)
        assert bridge.state.shutdown.is_set()
    finally:
        connector.cancel()
        # Clear shutdown so later tests may start delivery tasks normally
        bridge.state.shutdown.clear()
        bridge.MAX_RECONNECT_ATTEMPTS = old_max
        bridge.RECONNECT_BACKOFF_BASE = old_backoff_base
        bridge.RECONNECT_BACKOFF_MAX = old_backoff_max
        sse_mod.sse_client = orig_sse
        bridge.sse_client = orig_bridge_sse


@pytest.mark.asyncio
async def test_timeout_on_request_does_not_block_later_responses(capsys):
    """If the first request exhausts retries, later responses still deliver."""

    # Prepare two requests where id=1 will fail permanently
    async def fake_forward(request, *, raise_on_error=False):
        msg_id = request.get("id")
        if msg_id == 1:
            # Simulate repeated timeouts by raising TimeoutError
            raise asyncio.TimeoutError("simulated")
        return bridge.jsonrpc_result(msg_id, {"ok": True})

    # Patch forward_request used in _forward_and_match
    bridge.forward_request = fake_forward

    # Avoid real sleeping backoff to speed test
    async def _nosleep(_):
        return None

    asyncio_sleep = asyncio.sleep
    asyncio.sleep = _nosleep

    try:
        # Register pending requests in order
        bridge.state.pending_requests.clear()
        bridge.state.pending_requests[1] = bridge.PendingRequest(1, asyncio.get_running_loop().create_future())
        bridge.state.pending_requests[2] = bridge.PendingRequest(2, asyncio.get_running_loop().create_future())

        # Start delivery task
        dt = asyncio.create_task(bridge.deliver_responses())

        # Fire both forwarders concurrently
        await asyncio.gather(
            bridge._forward_and_match({"id": 1, "method": "tools/call"}),
            bridge._forward_and_match({"id": 2, "method": "tools/call"}),
        )

        # Allow delivery task to process and capture stdout
        await asyncio.sleep(0.1)
        captured = capsys.readouterr()
        lines = [l for l in captured.out.splitlines() if l.strip()]
        import json
        received = [json.loads(l) for l in lines[:2]]

        # cleanup
        dt.cancel()
        try:
            await dt
        except asyncio.CancelledError:
            pass

        assert len(received) >= 2
        # first should be an error for id=1, second success for id=2
        assert received[0].get("id") == 1
        assert "error" in received[0]
        assert received[1].get("id") == 2
    finally:
        asyncio.sleep = asyncio_sleep
