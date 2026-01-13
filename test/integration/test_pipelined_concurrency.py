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

BRIDGE_PATH = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"


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
async def test_multiple_in_flight_and_ordering(monkeypatch):
    server = MockSerenaServer()
    await server.start()

    bridge = load_bridge()

    def fake_sse_client(_url, timeout=None):
        return MockTransport()

    def session_factory(transport):
        return MockSession(transport, server)

    monkeypatch.setattr(bridge, "sse_client", fake_sse_client)
    monkeypatch.setattr(bridge, "ClientSession", session_factory)

    # Connect
    t = asyncio.create_task(bridge.connect_to_serena(max_attempts=1))
    await asyncio.wait_for(bridge.state.connected.wait(), timeout=1.0)

    # Prepare pending requests
    bridge.state.pending_requests.clear()
    bridge.state.pending_requests[1] = bridge.PendingRequest(1, asyncio.get_running_loop().create_future())
    bridge.state.pending_requests[2] = bridge.PendingRequest(2, asyncio.get_running_loop().create_future())

    # Make second call faster by injecting a delay for first
    server.set_delay("tools/call", 0.1)

    # Replace forward_request with one that simulates different response latency
    async def fake_forward(request, *, raise_on_error=False):
        msg_id = request.get("id")
        if msg_id == 1:
            await asyncio.sleep(0.1)
            return bridge.jsonrpc_result(1, {"ok": True})
        else:
            return bridge.jsonrpc_result(2, {"ok": True})

    bridge.forward_request = fake_forward

    results = []

    async def capture_response(resp):
        results.append(resp)

    # patch send_response so we capture delivered responses
    monkeypatch.setattr(bridge, "send_response", capture_response)

    dt = asyncio.create_task(bridge.deliver_responses())

    await asyncio.gather(
        bridge._forward_and_match({"id": 1, "method": "tools/call"}),
        bridge._forward_and_match({"id": 2, "method": "tools/call"}),
    )

    # give delivery a moment
    await asyncio.sleep(0.1)

    dt.cancel()
    try:
        await dt
    except asyncio.CancelledError:
        pass

    # Ensure two responses; ordering should be preserved (1 then 2)
    assert len(results) == 2
    assert results[0]["id"] == 1
    assert results[1]["id"] == 2


@pytest.mark.asyncio
async def test_response_buffer_cleared_on_connection_drop(monkeypatch):
    server = MockSerenaServer()
    await server.start()

    bridge = load_bridge()

    def fake_sse_client(_url, timeout=None):
        return MockTransport()

    def session_factory(transport):
        return MockSession(transport, server)

    monkeypatch.setattr(bridge, "sse_client", fake_sse_client)
    monkeypatch.setattr(bridge, "ClientSession", session_factory)

    # connect
    t = asyncio.create_task(bridge.connect_to_serena(max_attempts=1))
    await asyncio.wait_for(bridge.state.connected.wait(), timeout=1.0)

    # Put a buffered response
    bridge.state.response_buffer[42] = bridge.jsonrpc_result(42, {"ok": True})
    # Simulate connection drop
    bridge.state.clear_session()

    assert 42 not in bridge.state.response_buffer

    bridge.state.shutdown.set()
    await t
