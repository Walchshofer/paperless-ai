import asyncio
import importlib.util
import os
import sys
from pathlib import Path

# Ensure tests load fixture stubs
os.environ.setdefault("BRIDGE_TEST_STUBS", "1")
_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)

import pytest


@pytest.mark.asyncio
async def test_handle_jsonrpc_registers_pending():
    # Clear previous state
    bridge.state.pending_requests.clear()

    req = {"id": 42, "method": "tools/call", "params": {"name": "foo"}}

    await bridge.handle_jsonrpc(req)

    assert 42 in bridge.state.pending_requests
    pending = bridge.state.pending_requests[42]
    assert isinstance(pending, bridge.PendingRequest)
    # ensure the future exists
    assert hasattr(pending, "future")
