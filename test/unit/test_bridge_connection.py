import asyncio
import json
from types import SimpleNamespace

from services.bridge.connection import ConnectionManager
from services.bridge.state import BridgeState


class DummyContent:
    """An async iterator that yields pre-defined byte chunks."""

    def __init__(self, chunks):
        self._chunks = list(chunks)

    async def iter_any(self):
        for c in self._chunks:
            await asyncio.sleep(0)
            yield c


class DummyResp:
    def __init__(self, chunks, status=200):
        self.status = status
        self.content = DummyContent(chunks)


class DummySession:
    def __init__(self, resp):
        self._resp = resp

    async def get(self, *args, **kwargs):
        return self._resp

    async def close(self):
        pass


async def _run_connect_once():
    state = BridgeState()

    # Prepare an SSE data event that contains a tools/list/response payload
    payload = json.dumps({"type": "tools/list/response", "tools": [{"name": "toolA"}]})
    chunks = [f"data: {payload}\n\n".encode("utf-8")]

    resp = DummyResp(chunks)
    sess = DummySession(resp)

    cm = ConnectionManager(state)
    # Inject our dummy session
    async with state.session_lock:
        state.session = sess

    # Call internal handlers directly since start() spawns tasks
    await cm._handle_event(json.loads(payload))

    assert state.tools_ready.is_set()
    assert state.tools == [{"name": "toolA"}]


def test_fetch_tools_updates_state():
    asyncio.run(_run_connect_once())
