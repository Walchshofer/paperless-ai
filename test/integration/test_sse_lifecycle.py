import pytest

import bridge.connection as connection
from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


class _FakeSession:
    def __init__(self, _read, _write):
        self.initialized = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def initialize(self):
        self.initialized = True

    async def list_tools(self):
        return {"tools": []}


class _FakeSSE:
    async def __aenter__(self):
        return (object(), object())

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_sse_lifecycle_builds_headers(monkeypatch):
    state = BridgeState()
    cm = ConnectionManager(state, ResponseOrderer())
    captured = {}

    def fake_sse_client(url, headers, timeout, sse_read_timeout):
        captured["headers"] = headers
        return _FakeSSE()

    async def immediate_monitor():
        return "shutdown"

    monkeypatch.setattr(connection.config, "SERENA_API_KEY", "secret")
    monkeypatch.setattr(connection, "sse_client", fake_sse_client)
    monkeypatch.setattr(connection, "ClientSession", _FakeSession)
    monkeypatch.setattr(cm, "_monitor_session", immediate_monitor)

    reason = await cm._connect_once()

    assert reason == "shutdown"
    assert state.connected.is_set()
    assert captured["headers"]["X-API-KEY"] == "secret"
    assert captured["headers"]["Authorization"].startswith("Bearer ")