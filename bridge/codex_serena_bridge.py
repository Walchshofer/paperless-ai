"""CODEX-Serena MCP bridge server."""
from __future__ import annotations

import asyncio
import base64
import logging
import signal
import os
import sys
from datetime import datetime
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
        self._configure_mcp_logging()
        # Event set when MCP initialize request is received from CODEX.
        # Tests and the main loop may wait for this to ensure the bridge does
        # not exit before the initialization handshake takes place.
        self.initialized: asyncio.Event = asyncio.Event()
        self._register_handlers()

    def _configure_mcp_logging(self) -> None:
        if config.LOG_LEVEL != "DEBUG":
            return
        try:
            logging.getLogger("mcp").setLevel(logging.DEBUG)
            logging.getLogger("mcp.server").setLevel(logging.DEBUG)
            logging.getLogger("mcp.server.lowlevel").setLevel(logging.DEBUG)
            log("MCP SDK logging set to DEBUG", level="DEBUG")
        except Exception:
            # Never fail bridge startup due to logging configuration.
            pass

    def _note_initialized(self, source: str) -> None:
        if self.initialized.is_set():
            return
        try:
            self.initialized.set()
        except Exception:
            return
        log(
            "MCP session initialized via %s" % source,
            level="INFO",
        )

    def _register_handlers(self) -> None:
        if hasattr(self.server, "set_request_handler"):
            @self.server.set_request_handler("initialize")
            async def handle_initialize(
                request: types.InitializeRequest,
            ) -> types.InitializeResult:
                log(
                    f"Received initialize request: {request}",
                    level="DEBUG",
                )
                self._note_initialized("initialize request")
                handler = getattr(self.server, "_handle_initialize", None)
                if handler is None:
                    log(
                        "Server lacks _handle_initialize; using fallback",
                        level="WARN",
                    )
                    return types.InitializeResult(
                        protocolVersion=request.params.protocolVersion,
                        capabilities=self.server.get_capabilities(
                            NotificationOptions(),
                            {},
                        ),
                        serverInfo=types.Implementation(
                            name="codex-serena-bridge",
                            version="4.0.0",
                        ),
                    )
                return await handler(request)
        else:
            log(
                "Initialize handled by MCP SDK ServerSession",
                level="DEBUG",
            )

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
        self._note_initialized(f"first request: {method}")
        seq = await self.orderer.register()
        request_id = self._get_request_id()
        
        log(
            f"CODEX->Bridge request id={request_id} method={method} params={params}",
            level="DEBUG",
        )

        # Buffer requests if connection is still establishing
        if not self.state.connected.is_set():
            log(
                f"Buffering request id={request_id} waiting for Serena connection...",
                level="INFO",
            )
            try:
                await asyncio.wait_for(self.state.connected.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                log(
                    f"Timed out waiting for connection for request id={request_id}",
                    level="WARN",
                )

        try:
            result = await self.router.forward(
                method,
                params,
                request_id,
            )
            await self.orderer.wait_turn(seq)
            log(
                f"Bridge->CODEX response id={request_id} method={method}",
                level="DEBUG",
            )
            return result
        except McpError as exc:
            await self.orderer.wait_turn(seq)
            log(
                f"Bridge->CODEX error id={request_id} method={method} error={exc}",
                level="ERROR",
            )
            raise exc
        except Exception as exc:
            await self.orderer.wait_turn(seq)
            context = {
                "id": request_id,
                "method": method,
                "tool": params.get("name") if method == "tools/call" else None,
            }
            enriched = enrich_error(exc, context)
            log(
                f"Bridge->CODEX exception id={request_id} method={method} error={enriched}",
                level="ERROR",
            )
            raise McpError(enriched)

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
    # Write a startup diagnostic line to the log file unconditionally so we can
    # observe effective env and file even when LOG_LEVEL suppresses DEBUG logs.
    try:
        with open(config.LOG_FILE, "a", encoding="utf-8") as fh:
            fh.write(
                f"{datetime.now().astimezone().isoformat(timespec='seconds')} "
                "[CODEX-BRIDGE] [STARTUP] "
                f"LOG_LEVEL={config.LOG_LEVEL} "
                f"LOG_FILE={config.LOG_FILE} "
                f"SERENA_BASE={config.SERENA_BASE}\n"
            )
    except Exception:
        # Don't fail the startup because diagnostics couldn't be written.
        pass
    log("Starting CODEX-Serena bridge", level="INFO")
    app = BridgeApp()
    _install_signal_handlers(app.state)
    manager = ConnectionManager(app.state, app.orderer)
    try:
        manager.start()
    except Exception as exc:
        log(
            f"Connection manager start failed: {exc}",
            level="ERROR",
        )
        import traceback

        trace = traceback.format_exc()
        log(f"Traceback: {trace}", level="ERROR")
        exit_code = 1
        return exit_code
    log("Connection manager started", level="DEBUG")
    exit_code = 0
    monitor_task: asyncio.Task | None = None
    server_monitor_task: asyncio.Task | None = None
    stdio_entered = False
    server_task_created = False
    stdio_entry_ts = None
    try:
        async with stdio_server() as (read_stream, write_stream):
            # Unconditionally write an STDIO-enter diagnostic to the log file
            # so we can see whether the STDIO context was established even if
            # DEBUG logs are suppressed or STDIO closes quickly.
            stdio_entered = True
            stdio_entry_ts = datetime.now().astimezone()
            try:
                with open(config.LOG_FILE, "a", encoding="utf-8") as fh:
                    fh.write(
                        f"{stdio_entry_ts.isoformat(timespec='seconds')} "
                        f"[CODEX-BRIDGE] [STDIO] entering stdio_server\n"
                    )
            except Exception:
                pass

            if sys.stdin.closed:
                log(
                    "STDIN is closed; CODEX must keep STDIO open",
                    level="ERROR",
                )
                exit_code = 1
                app.state.shutdown.set()
                return exit_code

            log(
                "STDIO server started, waiting for CODEX",
                level="DEBUG",
            )
            monitor_task = asyncio.create_task(
                _monitor_stdio(app.state),
            )
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
            server_task_created = True
            server_monitor_task = asyncio.create_task(
                _monitor_server_task(app.state, server_task),
            )
            try:
                with open(config.LOG_FILE, "a", encoding="utf-8") as fh:
                    now = datetime.now().astimezone().isoformat(
                        timespec="seconds",
                    )
                    fh.write(
                        f"{now} [CODEX-BRIDGE] [STDIO] server_task_created\n"
                    )
            except Exception:
                pass

            log(
                "Server task created, awaiting requests",
                level="DEBUG",
            )

            # Optional grace wait to give the server task a chance to start and
            # remain running (helps when STDIO is flaky or closed quickly by
            # the spawner). If the server task exits immediately during the
            # grace period, treat that as an initialization failure.
            grace = float(getattr(config, "STDIO_INITIALIZE_GRACE_SECS", 0))
            if grace and grace > 0:
                start = asyncio.get_event_loop().time()
                while True:
                    await asyncio.sleep(0.05)
                    if server_task.done():
                        try:
                            server_task.result()
                            log(
                                "Server task completed during "
                                "initialize grace",
                                level="ERROR",
                            )
                        except Exception as exc:
                            log(
                                "Server task exception during "
                                f"initialize grace: {exc}",
                                level="ERROR",
                            )
                            import traceback

                            trace = traceback.format_exc()
                            log(f"Traceback: {trace}", level="ERROR")
                        # Trigger shutdown and mark failure
                        exit_code = 1
                        app.state.shutdown.set()
                        break
                    if asyncio.get_event_loop().time() - start >= grace:
                        log(
                            "STDIO: server task survived "
                            f"initialization grace {grace}s",
                            level="DEBUG",
                        )
                        break

            # If configured, wait for MCP initialize handshake to arrive.
            init_timeout = float(
                getattr(config, "STDIO_INITIALIZE_TIMEOUT_SECS", 0)
            )
            waiting_for_init = (
                init_timeout
                and init_timeout > 0
                and not app.initialized.is_set()
            )
            if waiting_for_init:
                log(
                    "Waiting up to %ss for MCP initialize from CODEX"
                    % init_timeout,
                    level="DEBUG",
                )
                try:
                    await asyncio.wait_for(
                        app.initialized.wait(),
                        timeout=init_timeout,
                    )
                    log("MCP initialize received", level="INFO")
                except asyncio.TimeoutError:
                    log(
                        "MCP initialize did not arrive within %ss"
                        % init_timeout,
                        level="ERROR",
                    )
                    exit_code = 1
                    app.state.shutdown.set()

            shutdown_task = asyncio.create_task(app.state.shutdown.wait())
            done, _pending = await asyncio.wait(
                [server_task, shutdown_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            server_done = server_task in done
            shutdown_done = shutdown_task in done
            log(
                "Task completed: server=%s, shutdown=%s"
                % (server_done, shutdown_done),
                level="DEBUG",
            )
            if server_done:
                try:
                    result = server_task.result()
                    log(f"Server task result: {result}", level="DEBUG")
                except Exception as exc:
                    exit_code = 1
                    log(
                        f"Server task exception: {exc}",
                        level="ERROR",
                    )
                    import traceback

                    trace = traceback.format_exc()
                    log(f"Traceback: {trace}", level="ERROR")
                if not shutdown_done and exit_code == 0:
                    drained = await _wait_pending_responses(
                        app.state,
                        timeout=0.5,
                    )
                    if not drained:
                        exit_code = 1
                if (
                    not shutdown_done
                    and not app.state.shutdown.is_set()
                    and exit_code == 0
                ):
                    log(
                        "Server task exited before shutdown; "
                        "STDIO likely closed",
                        level="ERROR",
                    )
                    exit_code = 1
            if shutdown_task in done and not server_task.done():
                server_task.cancel()
                await asyncio.gather(server_task, return_exceptions=True)
            if server_task in done:
                app.state.shutdown.set()
        return exit_code
    finally:
        if monitor_task:
            monitor_task.cancel()
        if server_monitor_task:
            server_monitor_task.cancel()
        # Unconditionally write an STDIO-exit diagnostic and whether we created
        # a server task; this helps distinguish the case where STDIO closed
        # before we created the server task vs the case where the server task
        # ran and then exited.
        if stdio_entered:
            try:
                with open(config.LOG_FILE, "a", encoding="utf-8") as fh:
                    now = datetime.now().astimezone().isoformat(
                        timespec="seconds",
                    )
                    duration = (
                        datetime.now().astimezone() - stdio_entry_ts
                        if stdio_entry_ts
                        else None
                    )
                    duration_s = (
                        duration.total_seconds() if duration else "unknown"
                    )
                    fh.write(
                        f"{now} [CODEX-BRIDGE] [STDIO] exited stdio_server "
                        f"duration_s={duration_s} "
                        f"server_task_created={server_task_created}\n"
                    )
            except Exception:
                pass
        await manager.stop()
        await app.state.close()
        log("Bridge stopped", level="INFO")


async def _monitor_stdio(state: BridgeState) -> None:
    """Emit periodic STDIO liveness diagnostics."""
    while not state.shutdown.is_set():
        log("STDIO stream alive", level="DEBUG")
        await asyncio.sleep(1)


async def _monitor_server_task(
    state: BridgeState,
    server_task: asyncio.Task,
) -> None:
    while not state.shutdown.is_set() and not server_task.done():
        await asyncio.sleep(0.1)
        if state.connected.is_set():
            log(
                "Server task running; Serena connected",
                level="DEBUG",
            )
    if server_task.done():
        log("Server task completed", level="DEBUG")


async def _wait_pending_responses(
    state: BridgeState,
    *,
    timeout: float,
) -> bool:
    start = asyncio.get_event_loop().time()
    logged = False
    while True:
        async with state.pending_responses_lock:
            pending = state.pending_responses
        if pending <= 0:
            return True
        if asyncio.get_event_loop().time() - start >= timeout:
            log(
                "Pending responses still in flight: %s" % pending,
                level="ERROR",
            )
            return False
        if not logged:
            log(
                "Waiting for pending responses: %s" % pending,
                level="DEBUG",
            )
            logged = True
        await asyncio.sleep(0.05)


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
