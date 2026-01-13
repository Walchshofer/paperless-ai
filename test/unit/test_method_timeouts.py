import importlib.util
import os
import sys
from pathlib import Path

# Ensure test stubs used
os.environ.setdefault("BRIDGE_TEST_STUBS", "1")
_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)

import asyncio
import pytest


@pytest.mark.asyncio
async def test_method_timeouts_passed_to_wait_for(monkeypatch):
    called = {}

    async def fake_wait_for(coro, timeout):
        # Record last timeout invoked
        called['timeout'] = timeout
        # run the underlying coro a little so code proceeds
        try:
            return await coro
        except Exception:
            raise

    monkeypatch.setattr(bridge.asyncio, 'wait_for', fake_wait_for)

    # Patch session to a stub where list_resources returns quickly
    class FastSession:
        async def list_resources(self):
            await asyncio.sleep(0)
            return []

    bridge.state.session = FastSession()
    bridge.state.connected.set()

    # Call forward_request for resources/list and assert timeout used is 30 (default)
    resp = await bridge.forward_request({"id": 1, "method": "resources/list", "params": {}})
    assert called.get('timeout') == 30
