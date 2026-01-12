import asyncio
import importlib.util
from pathlib import Path

# Import codex-bridge.py as module for testing
_spec_location = Path(__file__).resolve().parents[2] / "codex-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)

# Provide lightweight mcp stubs so module imports succeed during tests
import types
mcp = types.ModuleType("mcp")
client = types.ModuleType("mcp.client")
sse_mod = types.ModuleType("mcp.client.sse")

class DummyClientSession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        pass

    async def initialize(self, *args, **kwargs):
        return None

client.ClientSession = DummyClientSession

async def _dummy_sse_client(*args, **kwargs):
    class _Ctx:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            pass

    return _Ctx()

sse_mod.sse_client = _dummy_sse_client

import sys
sys.modules["mcp"] = mcp
sys.modules["mcp.client"] = client
sys.modules["mcp.client.sse"] = sse_mod

spec.loader.exec_module(bridge)


def test_pipelined_response_ordering(monkeypatch):
    async def scenario():
        outputs = []

        async def fake_send_response(resp):
            outputs.append(resp)

        # Patch send_response and forward_request
        bridge.send_response = fake_send_response

        async def fake_forward(request):
            # Simulate responses arriving in reverse order: 3,2,1
            msg_id = request.get("id")
            if msg_id == 1:
                await asyncio.sleep(0.3)
                return {"jsonrpc": "2.0", "id": 1, "result": {"r": 1}}
            if msg_id == 2:
                await asyncio.sleep(0.2)
                return {"jsonrpc": "2.0", "id": 2, "result": {"r": 2}}
            if msg_id == 3:
                await asyncio.sleep(0.1)
                return {"jsonrpc": "2.0", "id": 3, "result": {"r": 3}}
            return {"jsonrpc": "2.0", "id": msg_id, "result": {}}

        bridge.forward_request = fake_forward

        # Start the deliver_responses task for this test
        dt = asyncio.create_task(bridge.deliver_responses())

        # Send three requests quickly
        await asyncio.gather(
            bridge.handle_jsonrpc({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {}}),
            bridge.handle_jsonrpc({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {}}),
            bridge.handle_jsonrpc({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {}}),
        )

        # Wait until all responses delivered or timeout
        for _ in range(100):
            if len(outputs) >= 3:
                break
            await asyncio.sleep(0.05)

        # Cleanup
        dt.cancel()
        try:
            await dt
        except asyncio.CancelledError:
            pass

        assert len(outputs) == 3
        assert [o.get("id") for o in outputs] == [1, 2, 3]

    asyncio.run(scenario())
