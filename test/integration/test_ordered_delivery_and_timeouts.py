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

import json
import pytest


@pytest.mark.asyncio
async def test_ordered_delivery_for_concurrent_requests(capsys):
    # Simulate two forward_request behaviors with different delays

    async def fake_forward(request, *, raise_on_error=False):
        msg_id = request.get("id")
        if msg_id == 1:
            # slow
            await asyncio.sleep(0.2)
            return bridge.jsonrpc_result(msg_id, {"ok": True})
        else:
            # fast
            await asyncio.sleep(0.01)
            return bridge.jsonrpc_result(msg_id, {"ok": True})

    bridge.forward_request = fake_forward

    # Avoid long sleeps
    orig_sleep = asyncio.sleep

    try:
        # Register pending requests in order
        bridge.state.pending_requests.clear()
        bridge.state.pending_requests[1] = bridge.PendingRequest(1, asyncio.get_running_loop().create_future())
        bridge.state.pending_requests[2] = bridge.PendingRequest(2, asyncio.get_running_loop().create_future())

        # Start delivery task
        dt = asyncio.create_task(bridge.deliver_responses())

        # Fire both forwarders concurrently
        await asyncio.gather(
            bridge._forward_and_match({"id": 1, "method": "tools/call"}),
            bridge._forward_and_match({"id": 2, "method": "tools/call"}),
        )

        # Allow delivery task to process and capture stdout
        await asyncio.sleep(0.05)
        captured = capsys.readouterr()
        lines = [l for l in captured.out.splitlines() if l.strip()]
        received = [json.loads(l) for l in lines[:2]]

        # cleanup
        dt.cancel()
        try:
            await dt
        except asyncio.CancelledError:
            pass

        assert len(received) >= 2
        assert received[0].get("id") == 1
        assert received[1].get("id") == 2
    finally:
        asyncio.sleep = orig_sleep


@pytest.mark.asyncio
async def test_enriched_timeout_messages_and_backoff(capsys):
    # Simulate forward_request raising TimeoutError for id 1 and success for id 2
    async def fake_forward(request, *, raise_on_error=False):
        msg_id = request.get("id")
        if msg_id == 1:
            raise asyncio.TimeoutError("simulated timeout")
        return bridge.jsonrpc_result(msg_id, {"ok": True})

    bridge.forward_request = fake_forward

    bridge.state.pending_requests.clear()
    bridge.state.pending_requests[1] = bridge.PendingRequest(1, asyncio.get_running_loop().create_future())
    bridge.state.pending_requests[2] = bridge.PendingRequest(2, asyncio.get_running_loop().create_future())

    dt = asyncio.create_task(bridge.deliver_responses())

    try:
        await asyncio.gather(
            bridge._forward_and_match({"id": 1, "method": "tools/call"}),
            bridge._forward_and_match({"id": 2, "method": "tools/call"}),
        )

        await asyncio.sleep(0.05)
        captured = capsys.readouterr()
        lines = [l for l in captured.out.splitlines() if l.strip()]
        received = [json.loads(l) for l in lines[:2]]

        assert received[0].get("id") == 1
        # ensure timeout enrichment text present
        assert "Bridge timeout" in received[0]["error"]["message"]
        assert received[1].get("id") == 2
    finally:
        dt.cancel()
        try:
            await dt
        except asyncio.CancelledError:
            pass
