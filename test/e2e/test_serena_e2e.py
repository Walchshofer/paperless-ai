import asyncio
import importlib.util
import os
import sys
from pathlib import Path

import pytest

BRIDGE_PATH = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"


pytestmark = pytest.mark.skipif(
    not os.environ.get("SERENA_E2E"), reason="SERENA_E2E not set - skipping E2E tests"
)


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
async def test_serena_discover_and_call_tool():
    """End-to-end test that connects to a real Serena instance and performs a tools/list and tools/call."""
    bridge = load_bridge()

    # Ensure environment has SERENA_BASE and SERENA_SSE_URL available
    assert os.environ.get("SERENA_BASE"), "SERENA_BASE must be set for E2E test"

    # Start connector and wait for ready
    connector = asyncio.create_task(bridge.connect_to_serena(max_attempts=1))
    try:
        await asyncio.wait_for(bridge.state.connected.wait(), timeout=30.0)
        # tools should be available
        await asyncio.wait_for(bridge.state.tools_ready.wait(), timeout=30.0)
        assert isinstance(bridge.state.tools, list)

        # Call tools/list via forward_request
        resp = await bridge.forward_request(
            {"jsonrpc": "2.0", "id": "e2e-tools-list", "method": "tools/list", "params": {}},
        )
        assert resp.get("id") == "e2e-tools-list"
        assert "result" in resp

        # If there is at least one tool that can be called, call it
        tools = bridge.state.tools
        if tools:
            name = tools[0].get("name")
            call_resp = await bridge.forward_request(
                {
                    "jsonrpc": "2.0",
                    "id": "e2e-call",
                    "method": "tools/call",
                    "params": {"name": name, "arguments": {}},
                }
            )
            assert call_resp.get("id") == "e2e-call"
    finally:
        bridge.state.shutdown.set()
        connector.cancel()
        try:
            await connector
        except asyncio.CancelledError:
            pass
