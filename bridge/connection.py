"""Serena SSE connection manager."""
from __future__ import annotations

import asyncio
import os
from typing import Any, Optional, Tuple

if os.getenv("BRIDGE_TEST_STUBS") == "1":
    try:
        from test.fixtures.mcp_client_stubs import (  # type: ignore
            ClientSession,
            sse_client,
        )
    except Exception:
        from mcp.client import ClientSession, sse_client  # type: ignore
else:
    from mcp.client.session import ClientSession  # type: ignore
    from mcp.client.sse import sse_client  # type: ignore

from . import config
from .logging import log
from .orderer import ResponseOrderer
from .state import BridgeState


class ConnectionManager:
    """Maintain the SSE connection to Serena with retry logic."""

    def __init__(
        self,
        state: BridgeState,
        orderer: ResponseOrderer,
        *,
        url: str | None = None,
    ) -> None:
        self.state = state
        self.orderer = orderer
        self.url = url or config.SERENA_SSE_URL
        self._task: Optional[asyncio.Task] = None
        self._running = False
        self._ever_connected = False

    def start(self) -> None:
        """Start the background connection loop."""
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._connect_loop())

    async def stop(self) -> None:
        """Stop the background loop and clear the session."""
        self._running = False
        self.state.shutdown.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self._handle_disconnect(
            clean=True,
            _reason="shutdown",
            notify=False,
        )

    async def _connect_loop(self) -> None:
        attempts = 0
        backoff = config.RECONNECT_BACKOFF_BASE
        max_attempts = config.MAX_RECONNECT_ATTEMPTS

        while self._running and not self.state.shutdown.is_set():
            try:
                attempts += 1
                self._log_connect_attempt(attempts)
                reason = await self._connect_once()
                attempts = 0
                backoff = config.RECONNECT_BACKOFF_BASE
                if reason == "shutdown":
                    await self._handle_disconnect(
                        clean=True,
                        _reason=reason,
                        notify=False,
                    )
                    break
                await self._handle_disconnect(
                    clean=False,
                    _reason=reason,
                    notify=self._ever_connected,
                )
                if not self._ever_connected:
                    await asyncio.sleep(2)
                else:
                    await asyncio.sleep(
                        min(backoff, config.RECONNECT_BACKOFF_MAX)
                    )
                    backoff = min(
                        backoff * 2,
                        config.RECONNECT_BACKOFF_MAX,
                    )
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log(f"SSE connection error: {exc}", level="WARN")
                self.state.reconnect_failures = attempts
                await self._handle_disconnect(
                    clean=False,
                    _reason="connection_error",
                    notify=self._ever_connected,
                )
                if self._ever_connected and max_attempts:
                    if attempts >= max_attempts:
                        self._set_degraded(attempts)
                        attempts = 0
                        backoff = config.RECONNECT_BACKOFF_BASE
                        await asyncio.sleep(config.RECONNECT_BACKOFF_MAX)
                        continue
                if not self._ever_connected:
                    await asyncio.sleep(2)
                    continue
                await asyncio.sleep(
                    min(backoff, config.RECONNECT_BACKOFF_MAX)
                )
                backoff = min(backoff * 2, config.RECONNECT_BACKOFF_MAX)

        await self._handle_disconnect(
            clean=True,
            _reason="shutdown",
            notify=False,
        )

    async def _connect_once(self) -> str:
        headers = self._build_headers()

        context = _sse_context(
            self.url,
            headers,
            config.SSE_TIMEOUT,
            config.SSE_READ_TIMEOUT,
        )
        async with context as streams:
            read_stream, write_stream = _coerce_streams(streams)
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                async with self.state.session_lock:
                    self.state.session = session
                    self.state.connected.set()
                    self.state.connection_lost.clear()
                    self.state.connection_lost_message = None
                    self.state.reconnect_failures = 0
                    self.state.ever_connected = True
                    if self.state.degraded.is_set():
                        self.state.degraded.clear()
                        self.state.reconnect_exhausted_attempts = None
                self._ever_connected = True
                await self._fetch_tools(session)
                self.state.reconnect_needed.clear()
                log("Serena session ready", level="INFO")
                return await self._monitor_session()

    async def _monitor_session(self) -> str:
        while self._running and not self.state.shutdown.is_set():
            if self.state.reconnect_needed.is_set():
                return "reconnect"
            shutdown_task = asyncio.create_task(
                self.state.shutdown.wait()
            )
            reconnect_task = asyncio.create_task(
                self.state.reconnect_needed.wait()
            )
            done, pending = await asyncio.wait(
                [shutdown_task, reconnect_task],
                timeout=config.HEALTH_CHECK_INTERVAL,
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            if reconnect_task in done:
                return "reconnect"
        return "shutdown"

    async def _fetch_tools(self, session: ClientSession) -> None:
        try:
            result = await asyncio.wait_for(
                session.list_tools(),
                config.REQUEST_TIMEOUT_LIST,
            )
            if hasattr(result, "tools"):
                tools = list(result.tools)
            elif isinstance(result, dict):
                tools = list(result.get("tools") or [])
            else:
                tools = []
            self.state.tools = tools
            self.state.tools_ready.set()
            names = []
            for tool in tools[:5]:
                if isinstance(tool, dict):
                    name = tool.get("name")
                else:
                    name = getattr(tool, "name", None)
                if name:
                    names.append(name)
            log(f"Fetched {len(tools)} tools: {', '.join(names)}")
        except Exception as exc:
            log(f"Tool fetch failed: {exc}", level="WARN")

    async def _handle_disconnect(
        self,
        *,
        clean: bool,
        _reason: str,
        notify: bool,
    ) -> None:
        self.state.connected.clear()
        self.state.tools_ready.clear()
        self.state.tools = []
        if notify and not clean:
            self.state.connection_lost_message = (
                "Connection to Serena lost during operation"
            )
            self.state.connection_lost.set()
            self.state.reconnect_needed.set()
        else:
            self.state.connection_lost_message = None
            self.state.connection_lost.clear()
        async with self.state.session_lock:
            session = self.state.session
            self.state.session = None
        if session is not None and clean:
            try:
                await session.__aexit__(None, None, None)
            except Exception:
                pass
        async with self.state.pending_requests_lock:
            self.state.pending_requests.clear()
        if notify and not clean:
            await self.orderer.reset()
        if clean:
            self.state.reconnect_needed.clear()

    def _log_connect_attempt(self, attempt: int) -> None:
        if not self._ever_connected:
            log(
                "Connecting to Serena SSE "
                f"(startup attempt {attempt})"
            )
        else:
            log(f"Connecting to Serena SSE (attempt {attempt})")

    def _set_degraded(self, attempts: int) -> None:
        if self.state.degraded.is_set():
            return
        log(
            "Reconnect attempts exhausted, entering degraded mode",
            level="WARN",
        )
        self.state.degraded.set()
        self.state.reconnect_exhausted_attempts = attempts

    def _build_headers(self) -> dict[str, str]:
        if not config.SERENA_API_KEY:
            return {}
        return {
            "X-API-KEY": config.SERENA_API_KEY,
            "Authorization": f"Bearer {config.SERENA_API_KEY}",
        }


def _sse_context(
    url: str,
    headers: dict[str, str],
    timeout: float,
    read_timeout: float,
) -> Any:
    try:
        return sse_client(
            url,
            headers=headers,
            timeout=timeout,
            sse_read_timeout=read_timeout,
        )
    except TypeError:
        try:
            return sse_client(
                url,
                headers=headers,
                timeout=timeout,
                read_timeout=read_timeout,
            )
        except TypeError:
            return sse_client(
                url,
                headers=headers,
                timeout=timeout,
            )


def _coerce_streams(
    streams: Tuple[Any, Any] | Any,
) -> Tuple[Any, Any]:
    if isinstance(streams, tuple) and len(streams) == 2:
        return streams[0], streams[1]
    raise RuntimeError("Unexpected SSE stream shape")
