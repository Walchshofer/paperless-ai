"""CODEX-Serena MCP bridge server."""
from __future__ import annotations

import asyncio
import base64
import signal
from typing import Any, Iterable

import mcp.types as types
from mcp.server.lowlevel.server import NotificationOptions, Server
from mcp.server.lowlevel.helper_types import ReadResourceContents
from mcp.server.stdio import stdio_server
from mcp.shared.exceptions import McpError

from . import config
from .connection import ConnectionManager
from .errors import enrich_error
from .logging import log
from .orderer import ResponseOrderer
from .router import RequestRouter
from .state import BridgeState


class BridgeApp:
    """MCP server that forwards requests to Serena via SSE."""

    def __init__(self) -> None:
        self.state = BridgeState()
        self.orderer = ResponseOrderer()
        self.router = RequestRouter(self.state)
        self.server = Server(
            "codex-serena-bridge",
            version="4.0.0",
        )
        self._register_handlers()

    def _register_handlers(self) -> None:
        @self.server.list_tools()
        async def list_tools(_req: types.ListToolsRequest):
            return await self._handle("tools/list", {})

        @self.server.list_resources()
        async def list_resources(req: types.ListResourcesRequest):
            params = {}
            if req.params and req.params.cursor:
                params["cursor"] = req.params.cursor
            return await self._handle("resources/list", params)

        @self.server.list_prompts()
        async def list_prompts(req: types.ListPromptsRequest):
            params = {}
            if req.params and req.params.cursor:
                params["cursor"] = req.params.cursor
            return await self._handle("prompts/list", params)

        @self.server.get_prompt()
        async def get_prompt(
            name: str,
            arguments: dict[str, str] | None,
        ):
            params = {"name": name, "arguments": arguments or {}}
            return await self._handle("prompts/get", params)

        @self.server.read_resource()
        async def read_resource(uri: types.AnyUrl):
            params = {"uri": str(uri)}
            result = await self._handle("resources/read", params)
            return _convert_read_result(result)

        @self.server.call_tool(validate_input=False)
        async def call_tool(name: str, arguments: dict | None):
            params = {"name": name, "arguments": arguments or {}}
            return await self._handle("tools/call", params)

    async def _handle(
        self,
        method: str,
        params: dict[str, Any],
    ) -> Any:
        seq = await self.orderer.register()
        request_id = self._get_request_id()
        try:
            result = await self.router.forward(
                method,
                params,
                request_id,
            )
            await self.orderer.wait_turn(seq)
            return result
        except McpError as exc:
            await self.orderer.wait_turn(seq)
            raise exc
        except Exception as exc:
            await self.orderer.wait_turn(seq)
            context = {
                "id": request_id,
                "method": method,
                "tool": params.get("name") if method == "tools/call" else None,
            }
            raise McpError(enrich_error(exc, context))

    def _get_request_id(self) -> Any:
        try:
            return self.server.request_context.request_id
        except LookupError:
            return "unknown"


def _convert_read_result(
    result: Any,
) -> Iterable[ReadResourceContents]:
    if isinstance(result, types.ReadResourceResult):
        return [
            _resource_content(item)
            for item in result.contents
        ]
    if isinstance(result, dict) and "contents" in result:
        contents = result.get("contents") or []
        return [_resource_content(item) for item in contents]
    if isinstance(result, list):
        return [_resource_content(item) for item in result]
    return [ReadResourceContents(content=str(result))]


def _resource_content(item: Any) -> ReadResourceContents:
    if isinstance(item, ReadResourceContents):
        return item
    if isinstance(item, types.TextResourceContents):
        return ReadResourceContents(
            content=item.text,
            mime_type=item.mimeType,
        )
    if isinstance(item, types.BlobResourceContents):
        data = base64.b64decode(item.blob)
        return ReadResourceContents(
            content=data,
            mime_type=item.mimeType,
        )
    if isinstance(item, dict):
        if "text" in item:
            return ReadResourceContents(
                content=str(item.get("text")),
                mime_type=item.get("mimeType"),
            )
        if "blob" in item:
            data = base64.b64decode(item.get("blob", ""))
            return ReadResourceContents(
                content=data,
                mime_type=item.get("mimeType"),
            )
    return ReadResourceContents(content=str(item))


async def async_main() -> int:
    log("Starting CODEX-Serena bridge", level="INFO")
    app = BridgeApp()
    _install_signal_handlers(app.state)
    manager = ConnectionManager(app.state, app.orderer)
    manager.start()
    try:
        async with stdio_server() as (read_stream, write_stream):
            server_task = asyncio.create_task(
                app.server.run(
                    read_stream,
                    write_stream,
                    app.server.create_initialization_options(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                )
            )
            shutdown_task = asyncio.create_task(app.state.shutdown.wait())
            done, _pending = await asyncio.wait(
                [server_task, shutdown_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            if shutdown_task in done and not server_task.done():
                server_task.cancel()
                await asyncio.gather(server_task, return_exceptions=True)
            if server_task in done:
                app.state.shutdown.set()
        return 0
    finally:
        await manager.stop()
        await app.state.close()
        log("Bridge stopped", level="INFO")


def _install_signal_handlers(state: BridgeState) -> None:
    def _on_signal(signum: int, _frame: Any) -> None:
        log(f"Received signal {signum}, shutting down", level="INFO")
        state.shutdown.set()

    signal.signal(signal.SIGINT, _on_signal)
    signal.signal(signal.SIGTERM, _on_signal)


def main() -> int:
    try:
        return asyncio.run(async_main())
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
