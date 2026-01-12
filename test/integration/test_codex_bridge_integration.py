import asyncio
import importlib.util
import sys
from pathlib import Path

import pytest

from test.fixtures.mock_serena_server import (
    MockSerenaServer,
    MockSession,
    MockTransport,
)


BRIDGE_PATH = Path(__file__).resolve().parents[2] / "codex-bridge.py"


def load_bridge():
    """Load codex-bridge.py as a module for testing."""
    module_name = "codex_bridge"
    if module_name in sys.modules:
        del sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, BRIDGE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture
async def mock_server():
    server = MockSerenaServer()
    await server.start()
    yield server
    await server.stop()


@pytest.fixture
def patched_bridge(monkeypatch, mock_server):
    bridge = load_bridge()

    def fake_sse_client(_url, timeout=None):
        return MockTransport()

    def session_factory(transport):
        return MockSession(transport, mock_server)

    monkeypatch.setattr(bridge, "sse_client", fake_sse_client)
    monkeypatch.setattr(bridge, "ClientSession", session_factory)
    return bridge


@pytest.mark.asyncio
async def test_tools_cache_after_connection(patched_bridge):
    bridge = patched_bridge
    connect_task = asyncio.create_task(
        bridge.connect_to_serena(max_attempts=1)
    )
    await asyncio.wait_for(bridge.state.connected.wait(), 1.0)
    assert bridge.state.tools_ready.is_set()
    assert len(bridge.state.tools) == 2
    bridge.state.shutdown.set()
    await connect_task


@pytest.mark.asyncio
async def test_forward_tool_and_resources(patched_bridge, mock_server):
    bridge = patched_bridge
    connect_task = asyncio.create_task(
        bridge.connect_to_serena(max_attempts=1)
    )
    await asyncio.wait_for(bridge.state.connected.wait(), 1.0)

    tool_resp = await bridge.forward_request(
        {
            "jsonrpc": "2.0",
            "id": "tool-call-1",
            "method": "tools/call",
            "params": {"name": "search_code", "arguments": {"q": "foo"}},
        }
    )
    assert tool_resp["id"] == "tool-call-1"
    assert "result" in tool_resp

    list_resp = await bridge.forward_request(
        {
            "jsonrpc": "2.0",
            "id": "res-list",
            "method": "resources/list",
            "params": {},
        }
    )
    assert list_resp["id"] == "res-list"
    assert list_resp["result"]["resources"]

    read_resp = await bridge.forward_request(
        {
            "jsonrpc": "2.0",
            "id": "res-read",
            "method": "resources/read",
            "params": {"uri": "mock://resource"},
        }
    )
    assert read_resp["id"] == "res-read"
    assert read_resp["result"]["uri"] == "mock://resource"

    bridge.state.shutdown.set()
    await connect_task


@pytest.mark.asyncio
async def test_tools_list_timeout_returns_empty(patched_bridge, monkeypatch):
    bridge = patched_bridge

    async def short_wait(coro, timeout):
        # Force the tools/list wait to time out quickly
        return await asyncio.wait_for(coro, 0.01)

    monkeypatch.setattr(bridge.asyncio, "wait_for", short_wait)
    captured = {}

    async def capture_response(response):
        captured["response"] = response

    monkeypatch.setattr(bridge, "send_response", capture_response)

    request = {
        "jsonrpc": "2.0",
        "id": "tools-list",
        "method": "tools/list",
        "params": {},
    }
    response = await bridge.handle_jsonrpc(request)
    assert response is None
    assert captured["response"]["result"]["tools"] == []


@pytest.mark.asyncio
async def test_forward_timeout_triggers_reconnect(
    patched_bridge,
    mock_server,
    monkeypatch,
):
    bridge = patched_bridge
    bridge.REQUEST_TIMEOUT = 0.01
    mock_server.set_delay("tools/call", 0.5)

    connect_task = asyncio.create_task(
        bridge.connect_to_serena(max_attempts=2)
    )
    await asyncio.wait_for(bridge.state.connected.wait(), 1.0)

    request = {
        "jsonrpc": "2.0",
        "id": "tool-call-timeout",
        "method": "tools/call",
        "params": {"name": "search_code", "arguments": {"q": "slow"}},
    }
    response = await bridge.forward_request(request)
    assert response["error"]["code"] == -32603

    await asyncio.wait_for(bridge.state.connected.wait(), 1.0)
    bridge.state.shutdown.set()
    await connect_task


@pytest.mark.asyncio
async def test_connection_error_forces_reconnect(
    patched_bridge,
    mock_server,
):
    bridge = patched_bridge
    connect_task = asyncio.create_task(
        bridge.connect_to_serena(max_attempts=2)
    )
    await asyncio.wait_for(bridge.state.connected.wait(), 1.0)

    mock_server.fail_once()
    response = await bridge.forward_request(
        {
            "jsonrpc": "2.0",
            "id": "tool-call-fail",
            "method": "tools/call",
            "params": {"name": "search_code", "arguments": {}},
        }
    )
    assert response["error"]["code"] == -32603
    await asyncio.wait_for(bridge.state.connected.wait(), 1.0)

    bridge.state.shutdown.set()
    await connect_task
