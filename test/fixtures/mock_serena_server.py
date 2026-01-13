import asyncio
import json
import logging
from typing import Any, Dict, List, Optional


class _SuppressCancelledFilter(logging.Filter):
    """Filter to suppress noisy CancelledError traceback logs from uvicorn/Starlette during test shutdown."""

    def filter(self, record):
        try:
            msg = record.getMessage() or ""
        except Exception:
            msg = ""
        # Drop messages that reference CancelledError from asyncio/uvicorn
        if "CancelledError" in msg or "asyncio.exceptions.CancelledError" in msg:
            return False
        return True

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse, StreamingResponse
from starlette.routing import Route


class MockSerenaServer:
    """Minimal SSE server plus in-process session helpers for tests."""

    def __init__(self, host: str = "127.0.0.1", port: int = 9121) -> None:
        self.host = host
        self.port = port
        self._queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        self._server: Optional[uvicorn.Server] = None
        self._session_id = "mock-session"
        self.fail_next: bool = False
        self.delay_map: Dict[str, float] = {}
        self.tools: List[Dict[str, Any]] = [
            {"name": "search_code"},
            {"name": "ping"},
        ]
        self.resources: List[Dict[str, Any]] = [
            {"uri": "mock://resource", "name": "mock resource"}
        ]
        self.app = Starlette(
            routes=[
                Route("/sse", self.sse_endpoint),
                Route("/messages/", self.messages, methods=["POST"]),
            ]
        )

    async def sse_endpoint(self, _request: Request) -> StreamingResponse:
        async def event_stream():
            # Yield an initial session id event then stream messages.
            try:
                yield f"data: session_id={self._session_id}\n\n"
                while True:
                    try:
                        payload = await self._queue.get()
                    except asyncio.CancelledError:
                        # Server is shutting down; stop the generator cleanly.
                        break
                    chunk = f"data: {json.dumps(payload)}\n\n"
                    yield chunk
            except asyncio.CancelledError:
                # Swallow CancelledError to avoid noisy tracebacks in tests.
                return

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
        )

    async def messages(self, request: Request) -> PlainTextResponse:
        payload = await request.json()
        self._queue.put_nowait(payload)
        return PlainTextResponse("Accepted")

    async def start(self) -> None:
        config = uvicorn.Config(
            self.app,
            host=self.host,
            port=self.port,
            log_level="warning",
        )
        # Install a filter to suppress noisy CancelledError logs originating from
        # uvicorn/Starlette lifespan mechanics during test shutdown sequences.
        cancelled_filter = _SuppressCancelledFilter()
        logging.getLogger("uvicorn.error").addFilter(cancelled_filter)
        logging.getLogger("uvicorn.lifespan.on").addFilter(cancelled_filter)

        self._server = uvicorn.Server(config)
        # Start server in background and allow a brief moment for startup to
        # complete so test code doesn't race against the server's lifespan.
        self._server_task = asyncio.create_task(self._server.serve())
        # Wait until the server indicates it's started or timeout.
        # Uvicorn exposes a `.started` attribute (asyncio.Event) on newer versions
        # which is set when the server is ready to accept connections. Fall back
        # to a short sleep if not available.
        started = getattr(self._server, "started", None)
        if isinstance(started, asyncio.Event):
            try:
                await asyncio.wait_for(started.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                # Fallback to small sleep to keep tests robust across uvicorn versions.
                await asyncio.sleep(0.05)
        else:
            await asyncio.sleep(0.05)

    async def stop(self) -> None:
        if self._server:
            self._server.should_exit = True
            # Wait for the server task to finish gracefully with a timeout
            if getattr(self, "_server_task", None):
                try:
                    await asyncio.wait_for(self._server_task, timeout=1.0)
                except Exception:
                    # Ensure we don't raise during test cleanup
                    pass

    async def stop(self) -> None:
        if self._server:
            self._server.should_exit = True

    def set_delay(self, method: str, seconds: float) -> None:
        self.delay_map[method] = seconds

    def clear_delays(self) -> None:
        self.delay_map.clear()

    def fail_once(self) -> None:
        self.fail_next = True


class MockTransport:
    """Dummy transport stand-in for sse_client."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


class MockSession:
    """Emulates mcp.ClientSession using MockSerenaServer state."""

    def __init__(self, _transport: Any, server: MockSerenaServer) -> None:
        self.server = server
        self.calls: list = []

    async def __aenter__(self) -> "MockSession":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False

    async def _maybe_fail_or_delay(self, method: str) -> None:
        if self.server.fail_next:
            self.server.fail_next = False
            raise ConnectionError(f"forced failure on {method}")
        delay = self.server.delay_map.get(method)
        if delay:
            await asyncio.sleep(delay)

    async def initialize(self, **_kwargs) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("initialize")
        return {"serverInfo": {"name": "mock-serena"}}

    async def list_tools(self) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("tools/list")
        return {"tools": list(self.server.tools)}

    async def call_tool(
        self,
        name: str,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("tools/call")
        self.calls.append((name, arguments or {}))
        return {"content": [{"type": "text", "text": "ok"}]}

    async def list_resources(self) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("resources/list")
        return {"resources": list(self.server.resources)}

    async def read_resource(self, uri: str) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("resources/read")
        return {"uri": uri, "text": "mock-data"}
