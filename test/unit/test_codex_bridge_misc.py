import asyncio
import importlib.util
import sys
from pathlib import Path

import pytest

BRIDGE_PATH = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"


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


def test_serialize_result_various_types():
    bridge = load_bridge()

    class A:
        def model_dump(self):
            return {"a": 1}

    class B:
        def dict(self):
            return {"b": 2}

    assert bridge.serialize_result(A()) == {"a": 1}
    assert bridge.serialize_result(B()) == {"b": 2}
    assert bridge.serialize_result(1) == 1


def test_forward_request_raises_on_missing_session():
    bridge = load_bridge()
    # Ensure disconnected
    bridge.state.session = None
    bridge.state.connected.clear()
    with pytest.raises(RuntimeError):
        # raise_on_error True should raise
        asyncio.get_event_loop().run_until_complete(
            bridge.forward_request({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}, raise_on_error=True)
        )


def test_jsonrpc_helpers():
    bridge = load_bridge()
    err = bridge.jsonrpc_error(1, -1, "msg")
    assert err["id"] == 1 and "error" in err
    res = bridge.jsonrpc_result(2, {"ok": True})
    assert res["id"] == 2 and "result" in res


def test_classify_and_should_retry():
    bridge = load_bridge()

    assert bridge.classify_error(asyncio.TimeoutError()) == "transient"

    class E(Exception):
        pass

    e = E()
    setattr(e, "status", 503)
    assert bridge.classify_error(e) == "transient"

    p = bridge.PermanentError("x")
    assert bridge.classify_error(p) == "permanent"

    rs = bridge.RetryState()
    do, backoff = bridge.should_retry(asyncio.TimeoutError(), rs, max_attempts=1)
    assert do is True
    rs.attempts = 1
    do, _ = bridge.should_retry(asyncio.TimeoutError(), rs, max_attempts=1)
    assert do is False


def test_enrich_error_messages():
    bridge = load_bridge()
    e = asyncio.TimeoutError("to")
    enriched = bridge.enrich_error(e, {"id": 1})
    assert "Bridge timeout" in enriched["message"]

    class E(Exception):
        pass

    err = E("x")
    setattr(err, "status", 429)
    enriched2 = bridge.enrich_error(err, {"id": 2})
    assert "Serena HTTP 429" in enriched2["message"]


@pytest.mark.asyncio
async def test_ensure_connected_timeout():
    bridge = load_bridge()
    # ensure clear state
    bridge.state.connected.clear()
    res = await bridge.ensure_connected(timeout=0.01)
    assert res is False


@pytest.mark.asyncio
async def test_handle_jsonrpc_initialize_and_unknown(monkeypatch):
    bridge = load_bridge()

    captured = {}

    async def capture(resp):
        captured["resp"] = resp

    monkeypatch.setattr(bridge, "send_response", capture)

    await bridge.handle_jsonrpc({"jsonrpc": "2.0", "id": "i1", "method": "initialize", "params": {}})
    assert captured["resp"]["id"] == "i1"

    await bridge.handle_jsonrpc({"jsonrpc": "2.0", "id": "i2", "method": "nope", "params": {}})
    assert captured["resp"]["id"] == "i2"


@pytest.mark.asyncio
async def test_handle_stdin_processes_input(monkeypatch):
    bridge = load_bridge()

    captured = {}

    async def capture(resp):
        captured["resp"] = resp

    monkeypatch.setattr(bridge, "send_response", capture)

    # Prepare a single valid line followed by empty lines
    lines = ["{\"jsonrpc\": \"2.0\", \"id\": \"stdin1\", \"method\": \"initialize\", \"params\": {}}\n", ""]

    def fake_readline():
        return lines.pop(0) if lines else ""

    monkeypatch.setattr(sys, "stdin", type("S", (), {"readline": staticmethod(fake_readline)})())

    t = asyncio.create_task(bridge.handle_stdin())

    # Wait until captured or timeout
    for _ in range(20):
        if captured:
            break
        await asyncio.sleep(0.01)

    bridge.state.shutdown.set()
    t.cancel()
    try:
        await t
    except asyncio.CancelledError:
        pass

    assert "resp" in captured and captured["resp"]["id"] == "stdin1"


@pytest.mark.asyncio
async def test_deliver_responses_handles_send_errors(monkeypatch):
    bridge = load_bridge()

    # Put a response in the delivery queue
    await bridge.state.response_delivery_queue.put(bridge.jsonrpc_result(99, {"ok": True}))

    async def bad_send(resp):
        raise RuntimeError("io")

    monkeypatch.setattr(bridge, "send_response", bad_send)

    # run deliver_responses for a short time
    t = asyncio.create_task(bridge.deliver_responses())
    await asyncio.sleep(0.05)
    bridge.state.shutdown.set()
    t.cancel()
    try:
        await t
    except asyncio.CancelledError:
        pass


@pytest.mark.asyncio
async def test_async_main_starts_and_stops(monkeypatch):
    bridge = load_bridge()

    async def fake_connector():
        # simulate normal connect sequence then wait for shutdown
        bridge.state.connected.set()
        bridge.state.tools_ready.set()
        await bridge.state.shutdown.wait()

    async def fake_stdin():
        # wait a brief moment and then trigger shutdown
        await asyncio.sleep(0.05)
        bridge.state.shutdown.set()

    monkeypatch.setattr(bridge, "connect_to_serena", fake_connector)
    monkeypatch.setattr(bridge, "handle_stdin", fake_stdin)

    # Run async_main and ensure it completes
    await bridge.async_main()


@pytest.mark.asyncio
async def test_handle_jsonrpc_registers_and_forwards(monkeypatch):
    bridge = load_bridge()

    results = []

    async def fake_forward(req, *, raise_on_error=False):
        return bridge.jsonrpc_result(req.get("id"), {"ok": True})

    monkeypatch.setattr(bridge, "forward_request", fake_forward)

    async def capture(resp):
        results.append(resp)

    monkeypatch.setattr(bridge, "send_response", capture)

    bridge.state.pending_requests.clear()
    # call handle_jsonrpc which should register pending and spawn forwarder
    await bridge.handle_jsonrpc({"jsonrpc": "2.0", "id": "p1", "method": "tools/call", "params": {"name": "search_code"}})

    # run delivery task briefly to capture
    dt = asyncio.create_task(bridge.deliver_responses())
    await asyncio.sleep(0.05)
    bridge.state.shutdown.set()
    dt.cancel()
    try:
        await dt
    except asyncio.CancelledError:
        pass

    assert any(r.get("id") == "p1" for r in results)


@pytest.mark.asyncio
async def test_fetch_tools_handles_errors(monkeypatch):
    bridge = load_bridge()

    class BadSession:
        async def list_tools(self):
            raise RuntimeError("bad")

    # Calling fetch_tools should not raise and should leave tools empty
    await bridge.fetch_tools(BadSession())
    assert bridge.state.tools == []


@pytest.mark.asyncio
async def test_forward_and_match_retries(monkeypatch):
    bridge = load_bridge()

    calls = {"count": 0}

    async def fake_forward(request, *, raise_on_error=False):
        calls["count"] += 1
        if calls["count"] < 3:
            raise asyncio.TimeoutError("try")
        return bridge.jsonrpc_result(request.get("id"), {"ok": True})

    bridge.forward_request = fake_forward

    results = []

    async def capture(resp):
        results.append(resp)

    monkeypatch.setattr(bridge, "send_response", capture)

    bridge.state.pending_requests.clear()
    bridge.state.pending_requests[5] = bridge.PendingRequest(5, asyncio.get_running_loop().create_future())

    dt = asyncio.create_task(bridge.deliver_responses())
    await bridge._forward_and_match({"id": 5, "method": "tools/call"})
    # give delivery a moment
    await asyncio.sleep(0.05)

    dt.cancel()
    try:
        await dt
    except asyncio.CancelledError:
        pass

    assert results and results[0]["id"] == 5
