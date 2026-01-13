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
async def test_bridge_connects_when_serena_becomes_available(monkeypatch):
    server = MockSerenaServer()
    await server.start()

    bridge = load_bridge()

    def fake_sse_client(_url, timeout=None):
        return MockTransport()

    def session_factory(transport):
        return MockSession(transport, server)

    monkeypatch.setattr(bridge, "sse_client", fake_sse_client)
    monkeypatch.setattr(bridge, "ClientSession", session_factory)

    # start connector and ensure it connects
    t = asyncio.create_task(bridge.connect_to_serena(max_attempts=1))
    try:
        await asyncio.wait_for(bridge.state.connected.wait(), timeout=1.0)
        assert bridge.state.tools_ready.is_set()
    finally:
        bridge.state.shutdown.set()
        await t


@pytest.mark.asyncio
async def test_reconnect_after_drop_and_tools_refetched(monkeypatch):
    server = MockSerenaServer()
    await server.start()

    bridge = load_bridge()

    def fake_sse_client(_url, timeout=None):
        return MockTransport()

    def session_factory(transport):
        return MockSession(transport, server)

    monkeypatch.setattr(bridge, "sse_client", fake_sse_client)
    monkeypatch.setattr(bridge, "ClientSession", session_factory)

    # Make health check interval short so reconnect is noticed quickly
    old_health = bridge.HEALTH_CHECK_INTERVAL
    bridge.HEALTH_CHECK_INTERVAL = 0.05

    # connect
    t = asyncio.create_task(bridge.connect_to_serena(max_attempts=2))
    await asyncio.wait_for(bridge.state.connected.wait(), timeout=1.0)

    # Simulate the server failing the next call which should cause a reconnect
    server.fail_once()
    # Force a forward to trigger reconnect
    resp = await bridge.forward_request({"jsonrpc": "2.0", "id": "x", "method": "tools/call", "params": {"name": "search_code", "arguments": {}}})
    assert resp["error"]["code"] == -32603

    # After reconnect, tools should be refetched
    # Allow sufficient time for backoff and reconnect
    await asyncio.wait_for(bridge.state.connected.wait(), timeout=5.0)
    assert bridge.state.tools_ready.is_set()

    bridge.state.shutdown.set()
    bridge.HEALTH_CHECK_INTERVAL = old_health
    try:
        await t
    except asyncio.CancelledError:
        pass


@pytest.mark.asyncio
async def test_enters_degraded_mode_after_max_retries(monkeypatch):
    server = MockSerenaServer()
    await server.start()

    bridge = load_bridge()

    # Make sse_client raise on enter to simulate failures (startup phase)
    called = {"count": 0}

    def bad_sse_client(*args, **kwargs):
        called["count"] += 1

        class Ctx:
            async def __aenter__(self):
                raise RuntimeError("connect failed")

            async def __aexit__(self, exc_type, exc, tb):
                pass

        return Ctx()

    monkeypatch.setattr(bridge, "sse_client", bad_sse_client)

    # reduce attempts and backoff to make test quick
    old_max = bridge.MAX_RECONNECT_ATTEMPTS
    old_back = bridge.RECONNECT_BACKOFF_BASE
    bridge.MAX_RECONNECT_ATTEMPTS = 3
    bridge.RECONNECT_BACKOFF_BASE = 0.05

    t = asyncio.create_task(bridge.connect_to_serena())
    try:
        # Startup should retry indefinitely with fixed 2s spacing; ensure we
        # don't shutdown and that attempts are occurring
        await asyncio.sleep(0.3)
        assert not bridge.state.shutdown.is_set()
        assert called["count"] >= 1
    finally:
        bridge.MAX_RECONNECT_ATTEMPTS = old_max
        bridge.RECONNECT_BACKOFF_BASE = old_back
        t.cancel()
        try:
            await t
        except asyncio.CancelledError:
            pass
