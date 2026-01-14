import asyncio
import os
from typing import Iterable

import pytest

import bridge.connection as connection
from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.router import RequestRouter
from bridge.state import BridgeState
from mcp.shared.exceptions import McpError


# Import mock Serena fixtures without altering sys.path globally
import importlib.util
from pathlib import Path as _P

_spec = (
    _P(__file__).resolve().parents[2]
    / "test"
    / "fixtures"
    / "mock_serena_server.py"
)
spec = importlib.util.spec_from_file_location("mock_serena_server", _spec)
mock_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mock_mod)
MockSerenaServer = mock_mod.MockSerenaServer
MockTransport = mock_mod.MockTransport
MockSession = mock_mod.MockSession
BASE_TOOLS_28 = mock_mod.BASE_TOOLS_28


pytestmark = pytest.mark.skipif(
    not os.environ.get("SERENA_E2E"),
    reason="SERENA_E2E not set - skipping E2E tool execution",
)


def _names(tools: Iterable[dict]) -> list[str]:
    names: list[str] = []
    for tool in tools:
        name = tool.get("name")
        if name:
            names.append(str(name))
    return names


@pytest.mark.asyncio
async def test_all_tools_execute_without_error(monkeypatch):
    """Call all 28 tools via router against the mock Serena session."""
    server = MockSerenaServer()
    await server.start()

    state = BridgeState()
    cm = ConnectionManager(state, ResponseOrderer())

    def fake_sse_client(*_args, **_kwargs):
        return MockTransport()

    def session_factory(read_stream, write_stream):
        return MockSession(read_stream, write_stream, server)

    monkeypatch.setattr(connection, "sse_client", fake_sse_client)
    monkeypatch.setattr(connection, "ClientSession", session_factory)

    cm.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=2.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=2.0)

        tool_names = _names(server.tools)
        assert len(tool_names) == 28

        router = RequestRouter(state)
        for name in tool_names:
            result = await router.forward(
                "tools/call",
                {"name": name, "arguments": {}},
                f"call-{name}",
            )
            assert result is not None
    finally:
        await cm.stop()
        await server.stop()


@pytest.mark.asyncio
async def test_invalid_params_return_error(monkeypatch):
    """Ensure invalid calls surface as McpError and bridge stays connected."""
    server = MockSerenaServer()
    await server.start()
    state = BridgeState()
    cm = ConnectionManager(state, ResponseOrderer())

    def fake_sse_client(*_args, **_kwargs):
        return MockTransport()

    def session_factory(read_stream, write_stream):
        return MockSession(read_stream, write_stream, server)

    monkeypatch.setattr(connection, "sse_client", fake_sse_client)
    monkeypatch.setattr(connection, "ClientSession", session_factory)

    cm.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=2.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=2.0)

        server.fail_once()
        router = RequestRouter(state)
        with pytest.raises(McpError):
            await router.forward(
                "tools/call",
                {"name": "read_file", "arguments": {"path": "/nope"}},
                "invalid-read",
            )

        # Bridge should still report connected after the failure.
        assert state.connected.is_set()
    finally:
        await cm.stop()
        await server.stop()


@pytest.mark.asyncio
async def test_timeout_handling(monkeypatch):
    """Force a tools/call timeout and verify error surfacing."""
    server = MockSerenaServer()
    await server.start()
    state = BridgeState()
    cm = ConnectionManager(state, ResponseOrderer())

    def fake_sse_client(*_args, **_kwargs):
        return MockTransport()

    def session_factory(read_stream, write_stream):
        return MockSession(read_stream, write_stream, server)

    monkeypatch.setattr(connection, "sse_client", fake_sse_client)
    monkeypatch.setattr(connection, "ClientSession", session_factory)
    monkeypatch.setattr(connection.config, "REQUEST_TIMEOUT_DEFAULT", 0.01)

    cm.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=2.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=2.0)

        router = RequestRouter(state)
        server.set_delay("tools/call", 0.05)
        with pytest.raises(McpError):
            await router.forward(
                "tools/call",
                {
                    "name": "read_file",
                    "arguments": {"path": "bridge/config.py"},
                },
                "timeout-read",
            )
    finally:
        await cm.stop()
        await server.stop()
