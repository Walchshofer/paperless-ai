import asyncio

import pytest

import bridge.connection as connection
from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState
import importlib.util
from pathlib import Path as _P
_spec = _P(__file__).resolve().parents[2] / "test" / "fixtures" / "mock_serena_server.py"
spec = importlib.util.spec_from_file_location("mock_serena_server", _spec)
mock_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mock_mod)
MockSerenaServer = mock_mod.MockSerenaServer
MockTransport = mock_mod.MockTransport
MockSession = mock_mod.MockSession


async def _wait_cleared(event: asyncio.Event) -> None:
    while event.is_set():
        await asyncio.sleep(0.01)


@pytest.mark.asyncio
async def test_bridge_connects_and_fetches_tools(monkeypatch):
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
        await asyncio.wait_for(state.connected.wait(), timeout=1.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=1.0)
        assert state.tools
    finally:
        await cm.stop()
        await server.stop()


@pytest.mark.asyncio
async def test_reconnect_refetches_tools(monkeypatch):
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
    monkeypatch.setattr(connection.config, "HEALTH_CHECK_INTERVAL", 0.01)

    cm.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=1.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=1.0)
        initial_tools = list(state.tools)

        server.tools.append({"name": "new_tool"})
        state.reconnect_needed.set()
await asyncio.wait_for(_wait_cleared(state.connected), timeout=2.0)
            await asyncio.wait_for(state.connected.wait(), timeout=2.0)
            await asyncio.wait_for(state.tools_ready.wait(), timeout=2.0)

        assert state.tools != initial_tools
    finally:
        await cm.stop()
        await server.stop()