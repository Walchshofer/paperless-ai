import asyncio
import importlib.util
import os
from pathlib import Path

# Ensure bridge uses test stubs
os.environ.setdefault("BRIDGE_TEST_STUBS", "1")
_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
import sys
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)

import pytest


@pytest.mark.asyncio
async def test_connect_enters_degraded_mode_and_keeps_running(monkeypatch):
    # Stub sse_client to always raise on enter so connect attempts fail
    class BrokenTransport:
        async def __aenter__(self):
            raise RuntimeError("connect fail")

        async def __aexit__(self, exc_type, exc, tb):
            return None

    def stub_sse_client(*a, **k):
        return BrokenTransport()

    monkeypatch.setattr(bridge, "sse_client", stub_sse_client)

    # Speed up backoff timings so the test runs quickly
    monkeypatch.setattr(bridge, "RECONNECT_BACKOFF_BASE", 0.01)
    monkeypatch.setattr(bridge, "RECONNECT_BACKOFF_MAX", 0.02)

    # Run connector in background (small max_attempts to trigger exhaustion)
    connector = asyncio.create_task(bridge.connect_to_serena(max_attempts=1))
    try:
        # Wait for degraded flag to be set
        await asyncio.wait_for(bridge.state.degraded.wait(), timeout=2.0)
        assert bridge.state.degraded.is_set()
        # Bridge should NOT be shutdown — it should continue running in
        # degraded mode and attempt background reconnects.
        assert not bridge.state.shutdown.is_set()
    finally:
        connector.cancel()
        try:
            await connector
        except asyncio.CancelledError:
            pass
        # Clean up
        bridge.state.clear_session()
        bridge.state.degraded.clear()
        bridge.state.reconnect_exhausted_attempts = None
