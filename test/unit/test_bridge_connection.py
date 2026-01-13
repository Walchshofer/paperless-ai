import pytest

import bridge.connection as connection
from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


class _StubSession:
    async def list_tools(self):
        return {"tools": [{"name": "toolA"}]}


class _FakeSession:
    def __init__(self, _read_stream, _write_stream):
        self.initialized = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def initialize(self):
        self.initialized = True

    async def list_tools(self):
        return {"tools": []}


@pytest.mark.asyncio
async def test_fetch_tools_updates_state():
    state = BridgeState()
    cm = ConnectionManager(state, ResponseOrderer())

    await cm._fetch_tools(_StubSession())

    assert state.tools_ready.is_set()
    assert state.tools == [{"name": "toolA"}]


@pytest.mark.asyncio
async def test_connect_once_falls_back_to_read_timeout(monkeypatch):
    state = BridgeState()
    cm = ConnectionManager(state, ResponseOrderer())
    captured = {}

    def fake_sse_client(url, headers, timeout, **kwargs):
        if "sse_read_timeout" in kwargs:
            raise TypeError("unexpected sse_read_timeout")
        captured["kwargs"] = kwargs

        class _Ctx:
            async def __aenter__(self):
                return (object(), object())

            async def __aexit__(self, exc_type, exc, tb):
                return False

        return _Ctx()

    async def immediate_monitor():
        return "shutdown"

    monkeypatch.setattr(connection, "sse_client", fake_sse_client)
    monkeypatch.setattr(connection, "ClientSession", _FakeSession)
    monkeypatch.setattr(cm, "_monitor_session", immediate_monitor)
    monkeypatch.setattr(connection.config, "SERENA_API_KEY", "")
    monkeypatch.setattr(connection.config, "SSE_READ_TIMEOUT", 1.0)

    reason = await cm._connect_once()

    assert reason == "shutdown"
    assert "read_timeout" in captured["kwargs"]
