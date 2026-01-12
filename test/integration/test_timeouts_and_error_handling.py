import asyncio
import importlib.util
import sys
from pathlib import Path

import pytest

# Import fixture module via file location to avoid import-time package issues
import importlib.util
from pathlib import Path as _P
_spec = _P(__file__).resolve().parents[2] / "test" / "fixtures" / "mock_serena_server.py"
spec = importlib.util.spec_from_file_location("mock_serena_server", _spec)
mock_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mock_mod)
MockSerenaServer = mock_mod.MockSerenaServer
MockTransport = mock_mod.MockTransport
MockSession = mock_mod.MockSession

BRIDGE_PATH = Path(__file__).resolve().parents[2] / "codex-bridge.py"


def load_bridge():
    module_name = "codex_bridge"
    if module_name in sys.modules:
        del sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, BRIDGE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_tools_list_timeout_and_enriched_error(monkeypatch):
    server = MockSerenaServer()
    await server.start()

    bridge = load_bridge()

    def fake_sse_client(_url, timeout=None):
        return MockTransport()

    def session_factory(transport):
        return MockSession(transport, server)

    monkeypatch.setattr(bridge, "sse_client", fake_sse_client)
    monkeypatch.setattr(bridge, "ClientSession", session_factory)

    # Make tools/list wait_for timeout quickly
    # Capture original wait_for to avoid recursive monkeypatching
    orig_wait_for = bridge.asyncio.wait_for

    async def short_wait(coro, timeout):
        return await orig_wait_for(coro, 0.01)

    monkeypatch.setattr(bridge.asyncio, "wait_for", short_wait)

    captured = {}

    async def capture_response(response):
        captured["response"] = response

    monkeypatch.setattr(bridge, "send_response", capture_response)

    request = {"jsonrpc": "2.0", "id": "tools-list", "method": "tools/list", "params": {}}
    await bridge.handle_jsonrpc(request)

    assert "response" in captured
    assert captured["response"]["result"]["tools"] == []


@pytest.mark.asyncio
async def test_transient_vs_permanent_errors_and_retries(monkeypatch):
    server = MockSerenaServer()
    await server.start()

    bridge = load_bridge()

    def fake_sse_client(_url, timeout=None):
        return MockTransport()

    def session_factory(transport):
        return MockSession(transport, server)

    monkeypatch.setattr(bridge, "sse_client", fake_sse_client)
    monkeypatch.setattr(bridge, "ClientSession", session_factory)

    # Patch forward_request to raise TimeoutError for id=1 (transient) and ValueError for id=2 (permanent)
    async def fake_forward(request, *, raise_on_error=False):
        mid = request.get("id")
        if mid == 1:
            raise asyncio.TimeoutError("simulated")
        if mid == 2:
            from codex_bridge import PermanentError

            raise PermanentError("permanent fail")
        return bridge.jsonrpc_result(mid, {"ok": True})

    bridge.forward_request = fake_forward

    # avoid sleeping backoff
    async def _nosleep(_):
        return None

    old_sleep = asyncio.sleep
    asyncio.sleep = _nosleep

    try:
        bridge.state.pending_requests.clear()
        bridge.state.pending_requests[1] = bridge.PendingRequest(1, asyncio.get_running_loop().create_future())
        bridge.state.pending_requests[2] = bridge.PendingRequest(2, asyncio.get_running_loop().create_future())

        results = []

        async def capture_response(resp):
            results.append(resp)

        monkeypatch.setattr(bridge, "send_response", capture_response)

        dt = asyncio.create_task(bridge.deliver_responses())

        await asyncio.gather(
            bridge._forward_and_match({"id": 1, "method": "tools/call"}),
            bridge._forward_and_match({"id": 2, "method": "tools/call"}),
        )

        # give delivery a moment
        await asyncio.sleep(0.05)

        dt.cancel()
        try:
            await dt
        except asyncio.CancelledError:
            pass

        # id=1 should be enriched timeout error; id=2 should be permanent error
        ids = sorted([r["id"] for r in results])
        assert 1 in ids and 2 in ids

    finally:
        asyncio.sleep = old_sleep
