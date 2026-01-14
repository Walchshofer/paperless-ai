import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse, StreamingResponse
from starlette.routing import Route

BASE_TOOLS_28: List[Dict[str, Any]] = [
    {"name": "read_file"},
    {"name": "create_text_file"},
    {"name": "list_dir"},
    {"name": "find_file"},
    {"name": "replace_content"},
    {"name": "search_for_pattern"},
    {"name": "get_symbols_overview"},
    {"name": "find_symbol"},
    {"name": "find_referencing_symbols"},
    {"name": "replace_symbol_body"},
    {"name": "insert_after_symbol"},
    {"name": "insert_before_symbol"},
    {"name": "rename_symbol"},
    {"name": "write_memory"},
    {"name": "read_memory"},
    {"name": "list_memories"},
    {"name": "delete_memory"},
    {"name": "edit_memory"},
    {"name": "activate_project"},
    {"name": "switch_modes"},
    {"name": "get_current_config"},
    {"name": "check_onboarding_performed"},
    {"name": "onboarding"},
    {"name": "think_about_collected_information"},
    {"name": "think_about_task_adherence"},
    {"name": "think_about_whether_you_are_done"},
    {"name": "prepare_for_new_conversation"},
    {"name": "initial_instructions"},
]


class _SuppressCancelledFilter(logging.Filter):
    """Suppress noisy CancelledError tracebacks during shutdown."""

    def filter(self, record):
        try:
            msg = record.getMessage() or ""
        except Exception:
            msg = ""
        if "CancelledError" in msg:
            return False
        if "asyncio.exceptions.CancelledError" in msg:
            return False
        return True


class MockSerenaServer:
    """Minimal SSE server plus in-process session helpers for tests."""

    def __init__(self, host: str = "127.0.0.1", port: int = 0) -> None:
        self.host = host
        # If port is 0, we'll pick a free ephemeral port at start time.
        self.port = port
        self._queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        self._server: Optional[uvicorn.Server] = None
        self._server_task: Optional[asyncio.Task] = None
        self._session_id = "mock-session"
        self.fail_next: bool = False
        self.delay_map: Dict[str, float] = {}
        self.tools: List[Dict[str, Any]] = list(BASE_TOOLS_28)
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
            try:
                yield f"data: session_id={self._session_id}\n\n"
                while True:
                    try:
                        payload = await self._queue.get()
                    except asyncio.CancelledError:
                        break
                    chunk = f"data: {json.dumps(payload)}\n\n"
                    yield chunk
            except asyncio.CancelledError:
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
        # Pick an ephemeral free port if requested to avoid port conflicts
        # when tests run in sequence or parallel on the same host.
        if self.port == 0:
            import socket

            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s.bind((self.host, 0))
                self.port = s.getsockname()[1]

        config = uvicorn.Config(
            self.app,
            host=self.host,
            port=self.port,
            log_level="warning",
        )
        cancelled_filter = _SuppressCancelledFilter()
        logging.getLogger("uvicorn.error").addFilter(cancelled_filter)
        logging.getLogger("uvicorn.lifespan.on").addFilter(cancelled_filter)

        self._server = uvicorn.Server(config)
        self._server_task = asyncio.create_task(self._server.serve())
        started = getattr(self._server, "started", None)
        if isinstance(started, asyncio.Event):
            try:
                await asyncio.wait_for(started.wait(), timeout=1.0)
            except asyncio.TimeoutError:
                await asyncio.sleep(0.05)
        else:
            await asyncio.sleep(0.05)

    async def stop(self) -> None:
        if not self._server:
            return
        self._server.should_exit = True
        if self._server_task:
            try:
                await asyncio.wait_for(self._server_task, timeout=1.0)
            except Exception:
                pass

    def set_delay(self, method: str, seconds: float) -> None:
        self.delay_map[method] = seconds

    def clear_delays(self) -> None:
        self.delay_map.clear()

    def fail_once(self) -> None:
        self.fail_next = True


class MockTransport:
    """Dummy transport stand-in for sse_client."""

    def __init__(self) -> None:
        self._streams = (object(), object())

    async def __aenter__(self) -> Tuple[Any, Any]:
        return self._streams

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


class MockSession:
    """Emulates mcp.ClientSession using MockSerenaServer state."""

    def __init__(
        self,
        _read_stream: Any,
        _write_stream: Any,
        server: MockSerenaServer,
    ) -> None:
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

    async def list_tools(self, cursor: Optional[str] = None) -> Dict[str, Any]:
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

    async def list_resources(
        self,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("resources/list")
        return {"resources": list(self.server.resources)}

    async def read_resource(self, uri: str) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("resources/read")
        return {"uri": uri, "text": "mock-data"}

    async def list_prompts(
        self,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("prompts/list")
        return {"prompts": []}

    async def get_prompt(
        self,
        name: str,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        await self._maybe_fail_or_delay("prompts/get")
        return {"name": name, "arguments": arguments or {}}
