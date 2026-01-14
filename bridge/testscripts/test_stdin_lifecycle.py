"""STDIO lifecycle diagnostic for the CODEX-Serena bridge."""
from __future__ import annotations

import asyncio
import os
import sys
import time
from dataclasses import dataclass
from typing import Any, Optional

from mcp import types
from mcp.server.lowlevel.server import NotificationOptions, Server
from mcp.server.stdio import stdio_server


@dataclass
class DiagnosticResult:
    stdin_closed: Optional[bool] = None
    stdin_isatty: Optional[bool] = None
    stdin_readable: Optional[bool] = None
    stdio_entered: bool = False
    stdio_duration_s: Optional[float] = None
    read_result: Optional[str] = None
    read_exception: Optional[str] = None
    initialize_seen: Optional[bool] = None
    server_task_done: Optional[bool] = None
    server_task_exception: Optional[str] = None


def _print_line(line: str) -> None:
    try:
        print(line, flush=True)
    except ValueError:
        print(line, file=sys.stderr, flush=True)


def _describe_exception(exc: BaseException) -> str:
    if isinstance(exc, BaseExceptionGroup):
        parts = [repr(item) for item in exc.exceptions]
        return " | ".join(parts) if parts else repr(exc)
    return repr(exc)


def _format_bool(value: Optional[bool]) -> str:
    if value is None:
        return "unknown"
    return "true" if value else "false"


def classify_scenario(result: DiagnosticResult) -> str:
    """Classify the most likely STDIO failure scenario."""
    if result.stdin_closed:
        return "A"
    if result.read_result == "end_of_stream":
        return "A"
    if result.server_task_exception or result.server_task_done:
        return "C"
    if result.stdio_duration_s is not None and result.stdio_duration_s < 0.1:
        return "B"
    return "unknown"


def _describe_stdin(result: DiagnosticResult) -> None:
    try:
        result.stdin_closed = sys.stdin.closed
    except Exception:
        result.stdin_closed = None
    try:
        result.stdin_isatty = sys.stdin.isatty()
    except Exception:
        result.stdin_isatty = None
    try:
        result.stdin_readable = sys.stdin.readable()
    except Exception:
        result.stdin_readable = None

    _print_line("stdin.closed: " + _format_bool(result.stdin_closed))
    _print_line("stdin.isatty: " + _format_bool(result.stdin_isatty))
    _print_line("stdin.readable: " + _format_bool(result.stdin_readable))


class MessageObserver:
    def __init__(self) -> None:
        self.queue: asyncio.Queue[Any] = asyncio.Queue()

    async def on_message(self, message: Any) -> None:
        await self.queue.put(message)


class TeeReceiveStream:
    def __init__(self, read_stream: Any, observer: MessageObserver) -> None:
        self._read_stream = read_stream
        self._observer = observer

    async def __aenter__(self) -> "TeeReceiveStream":
        await self._read_stream.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return await self._read_stream.__aexit__(exc_type, exc, tb)

    async def aclose(self) -> None:
        await self._read_stream.aclose()

    async def receive(self) -> Any:
        message = await self._read_stream.receive()
        await self._observer.on_message(message)
        return message

    def __aiter__(self):
        async def _iterator():
            async for message in self._read_stream:
                await self._observer.on_message(message)
                yield message

        return _iterator()


def _is_initialize_message(message: Any) -> bool:
    if not hasattr(message, "message"):
        return False
    payload = getattr(message, "message", None)
    root = getattr(payload, "root", None)
    if isinstance(root, types.JSONRPCRequest):
        return root.method == "initialize"
    return False


async def _observe_message(
    result: DiagnosticResult,
    observer: MessageObserver,
    timeout_s: float,
) -> None:
    _print_line("read.observe.start")
    try:
        session_message = await asyncio.wait_for(
            observer.queue.get(),
            timeout=timeout_s,
        )
    except asyncio.TimeoutError:
        result.read_result = "timeout"
        _print_line("read.result: timeout")
        return
    except Exception as exc:
        result.read_result = "exception"
        result.read_exception = _describe_exception(exc)
        _print_line("read.exception: " + result.read_exception)
        return

    if isinstance(session_message, Exception):
        result.read_result = "exception"
        result.read_exception = _describe_exception(session_message)
        _print_line("read.exception: " + result.read_exception)
        return

    result.read_result = "message"
    if _is_initialize_message(session_message):
        result.initialize_seen = True
        _print_line("initialize.seen: true")
    _print_line("read.result: message")


async def _monitor_server_task(
    result: DiagnosticResult,
    server_task: asyncio.Task,
    grace_s: float,
) -> None:
    await asyncio.sleep(grace_s)
    result.server_task_done = server_task.done()
    _print_line(
        "server.task.done: " + _format_bool(result.server_task_done)
    )
    if server_task.done():
        try:
            server_task.result()
        except Exception as exc:
            result.server_task_exception = _describe_exception(exc)
            _print_line(
                "server.task.exception: " + result.server_task_exception
            )

    server_task.cancel()
    await asyncio.gather(server_task, return_exceptions=True)


def _maybe_close_stdin(force_close: bool) -> None:
    if not force_close:
        return
    try:
        sys.stdin.close()
        _print_line("stdin.force_closed: true")
    except Exception as exc:
        _print_line("stdin.force_close.error: " + _describe_exception(exc))


async def _run_stdio_tests(
    result: DiagnosticResult,
    hold_s: float,
    read_timeout_s: float,
    grace_s: float,
    force_close: bool,
) -> None:
    _print_line("stdio.lifecycle.start")
    start = time.monotonic()
    try:
        async with stdio_server() as (read_stream, write_stream):
            result.stdio_entered = True
            _print_line("stdio.entered: true")

            _print_line("server.run.start")
            server = Server("stdio-diagnostic", version="0.1.0")
            observer = MessageObserver()
            tee_stream = TeeReceiveStream(read_stream, observer)

            async def handle_initialize(
                request: types.InitializeRequest,
            ) -> types.InitializeResult:
                response = types.InitializeResult(
                    protocolVersion="2024-11-05",
                    capabilities=types.ServerCapabilities(),
                    serverInfo=types.Implementation(
                        name="stdio-diagnostic",
                        version="0.1.0",
                    ),
                )
                return response

            if hasattr(server, "set_request_handler"):
                server.set_request_handler("initialize")(handle_initialize)
            else:
                server.request_handlers[types.InitializeRequest] = (
                    handle_initialize
                )

            server_task = asyncio.create_task(
                server.run(
                    tee_stream,
                    write_stream,
                    server.create_initialization_options(
                        notification_options=NotificationOptions(),
                        experimental_capabilities={},
                    ),
                )
            )

            _print_line("stdio.read_timeout.start")
            await _observe_message(result, observer, read_timeout_s)

            if result.initialize_seen is None:
                result.initialize_seen = False
                _print_line("initialize.seen: false")

            await _monitor_server_task(
                result,
                server_task,
                grace_s,
            )

            await asyncio.sleep(hold_s)
            _maybe_close_stdin(force_close)

            server_task.cancel()
            await asyncio.gather(server_task, return_exceptions=True)
    except Exception as exc:
        _print_line("stdio.error: " + _describe_exception(exc))
        result.stdio_entered = False
    result.stdio_duration_s = time.monotonic() - start
    _print_line(
        "stdio.duration_s: %.3f" % (result.stdio_duration_s or 0.0)
    )


async def main() -> int:
    result = DiagnosticResult()
    _print_line("== stdin availability ==")
    _describe_stdin(result)

    hold_s = float(os.getenv("STDIO_HOLD_SECS", "2"))
    read_timeout_s = float(os.getenv("STDIO_READ_TIMEOUT_SECS", "1"))
    grace_s = float(os.getenv("STDIO_SERVER_GRACE_SECS", "1"))
    force_close = os.getenv("STDIO_FORCE_CLOSE", "0") == "1"

    _print_line("== stdio lifecycle ==")
    await _run_stdio_tests(
        result,
        hold_s,
        read_timeout_s,
        grace_s,
        force_close,
    )

    _print_line("== classification ==")
    _print_line("scenario: " + classify_scenario(result))

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
