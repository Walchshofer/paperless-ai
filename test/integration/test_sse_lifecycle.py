import asyncio
import pytest
from aiohttp import web

from services.bridge.connection import ConnectionManager
from services.bridge.state import BridgeState


@pytest.mark.asyncio
async def test_sse_lifecycle(aiohttp_server):
    async def sse_handler(request):
        resp = web.StreamResponse(
            status=200, headers={"Content-Type": "text/event-stream"}
        )
        await resp.prepare(request)
        payload = '{"type":"tools/list/response","tools":[{"name":"toolA"}]}'
        await resp.write(f"data: {payload}\n\n".encode())
        # keep the connection open briefly
        await asyncio.sleep(0.1)
        return resp

    app = web.Application()
    app.router.add_get("/sse", sse_handler)
    server = await aiohttp_server(app)
    url = str(server.make_url("/sse"))

    state = BridgeState()
    cm = ConnectionManager(state, url=url)
    cm.start()

    try:
        await asyncio.wait_for(state.tools_ready.wait(), timeout=3.0)
        assert state.tools and state.tools[0].get("name") == "toolA"
    finally:
        await cm.stop()
