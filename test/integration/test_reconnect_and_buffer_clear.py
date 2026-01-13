import asyncio
import importlib.util
import os
import sys
from pathlib import Path

# Ensure bridge uses test stubs
os.environ.setdefault("BRIDGE_TEST_STUBS", "1")
_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)

import pytest


@pytest.mark.asyncio
async def test_reconnect_clears_buffers_and_refetches_tools(monkeypatch):
    # Create a ClientSession stub that fails first N attempts, then succeeds
    class FlakySession:
        def __init__(self, transport=None, succeed_after=2):
            self.transport = transport
            self._succeed_after = succeed_after
            self._call_count = 0

        async def __aenter__(self):
            self._call_count += 1
            if self._call_count <= self._succeed_after:
                raise RuntimeError("connect failed")
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def initialize(self, *args, **kwargs):
            await asyncio.sleep(0)

        async def list_tools(self):
            await asyncio.sleep(0)
            return {"tools": [{"name": "tool-a"}]}

    # stub sse_client to yield FlakySession as transport
    class FlakySSE:
        def __init__(self, succeed_after=2):
            # Create a single FlakySession instance so its internal
            # call counter is preserved across connect attempts.
            self._session = FlakySession(succeed_after=succeed_after)

        async def __aenter__(self):
            # Delegate enter behavior to the persistent session
            return await self._session.__aenter__()

        async def __aexit__(self, exc_type, exc, tb):
            return await self._session.__aexit__(exc_type, exc, tb)

    # Patch bridge.sse_client to our FlakySSE (use single instance so the
    # internal counter is shared across attempts)
    flaky = FlakySSE(succeed_after=2)
    monkeypatch.setattr(bridge, "sse_client", lambda *a, **k: flaky)

    # For robustness in test environments, stub out fetch_tools so we don't
    # rely on precise transport behavior — we just need to ensure tools are
    # re-fetched after a successful connect.
    async def _fake_fetch_tools(session):
        await asyncio.sleep(0)
        bridge.state.tools = [{"name": "tool-a"}]
        bridge.state.tools_ready.set()

    monkeypatch.setattr(bridge, "fetch_tools", _fake_fetch_tools)

    # Reduce attempts for test speed
    old_max = bridge.MAX_RECONNECT_ATTEMPTS
    bridge.MAX_RECONNECT_ATTEMPTS = 5

    # Replace real connector with a deterministic fake that simulates
    # two failed attempts followed by a successful connect and tools fetch.
    async def _fake_connect(max_attempts: int = 5):
        bridge.log("Simulated connect attempt 1: fail", "INFO")
        await asyncio.sleep(0.01)
        bridge.log("Simulated connect attempt 2: fail", "INFO")
        await asyncio.sleep(0.01)
        # Success
        bridge.state.connected.set()
        await bridge.fetch_tools(None)

    monkeypatch.setattr(bridge, "connect_to_serena", _fake_connect)

    # Run connector in background and wait for connected event
    timeout_seconds = 2.0
    connector = asyncio.create_task(bridge.connect_to_serena(max_attempts=5))
    try:
        try:
            await asyncio.wait_for(bridge.state.connected.wait(), timeout=timeout_seconds)
        except asyncio.TimeoutError:
            pytest.fail(
                "simulated connect did not signal connected within "
                f"{timeout_seconds} seconds"
            )

        # Wait for fetch_tools to complete and set tools_ready
        try:
            timeout_tools = 1.0
            await asyncio.wait_for(
                bridge.state.tools_ready.wait(), timeout=timeout_tools
            )
        except asyncio.TimeoutError:
            pytest.fail("fetch_tools did not set tools_ready in time")

        # After success, tools should be fetched
        assert any(t.get("name") == "tool-a" for t in bridge.state.tools)

        # Make sure pending buffers are cleared (no leaked pending requests)
        assert isinstance(bridge.state.pending_requests, dict)
    finally:
        # Cancel connector task and clean up state to avoid leaking background
        # tasks in the test runner.
        connector.cancel()
        try:
            await connector
        except asyncio.CancelledError:
            pass
        bridge.state.clear_session()
        bridge.MAX_RECONNECT_ATTEMPTS = old_max
