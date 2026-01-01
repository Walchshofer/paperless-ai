import importlib
import os

import bridge.connection as connection


def test_fixture_stub_loader_uses_test_stubs(monkeypatch):
    monkeypatch.setenv("BRIDGE_TEST_STUBS", "1")
    importlib.reload(connection)

    client_module = connection.ClientSession.__module__
    sse_module = connection.sse_client.__module__
    assert client_module == "test.fixtures.mcp_client_stubs"
    assert sse_module == "test.fixtures.mcp_client_stubs"

    os.environ.pop("BRIDGE_TEST_STUBS", None)
    importlib.reload(connection)
