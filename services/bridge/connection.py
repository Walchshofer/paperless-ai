"""Connection manager and SSE lifecycle for the bridge.

This module provides a ConnectionManager that establishes an SSE
connection to Serena, handles reconnect/backoff logic, fetches tool
metadata and updates the BridgeState events accordingly.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, Dict, Optional

from mcp.client import ClientSession
from mcp.client.sse import sse_client

try:  # pragma: no cover - fallback for environments without aiohttp
    import aiohttp  # type: ignore
except Exception:  # pragma: no cover - runtime handled
    aiohttp = None  # type: ignore

from .state import BridgeState
from .config import SERENA_SSE_URL, SERENA_API_KEY, RETRY_CONFIG
from .logging import log, set_level_from_env

logger = logging.getLogger("bridge.connection")


class ConnectionManager:
    """Manage SSE connection lifecycle with reconnect/backoff.

    The implementation focuses on correct eventing and state updates and
    provides a minimal SSE consumer that parses `data:` lines.
    """

    def __init__(self, state: BridgeState, *, url: str = SERENA_SSE_URL,
                 api_key: str = SERENA_API_KEY) -> None:
        self.state = state
        self.url = url
        self.api_key = api_key
        self._task: Optional[asyncio.Task] = None
        self._session_owner = False
        self._running = False

    def start(self) -> None:
        """Start the background connect loop task."""
        if self._task is not None and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._connect_loop())

    async def stop(self) -> None:
        """Stop background task and close session."""
        self._running = False
        self.state.shutdown.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self._handle_disconnect(clean=True)

    async def _connect_loop(self) -> None:
        """Main loop: connect, watch, and reconnect with policies."""
        # Retry/backoff tracking
        reconnect_attempts = 0
        max_reconnects = RETRY_CONFIG.get("max_attempts", 10)
        backoff_base = RETRY_CONFIG.get("backoff_base", 2)
        backoff_max = RETRY_CONFIG.get("backoff_max", 30)

        # Track whether we've ever achieved a successful connection. Before
        # first successful connect we retry indefinitely with a fixed 2s delay.
        self._ever_connected = False

        while self._running and not self.state.shutdown.is_set():
            try:
                # Use MCP sse_client transport and initialize an SDK ClientSession
                # sse_client may be an async factory (coroutine) or may directly
                # return an async context manager. Only await if it's a coroutine.
                transport_ctx = sse_client(self.url, headers={"X-API-KEY": self.api_key})
                if asyncio.iscoroutine(transport_ctx):
                    transport_ctx = await transport_ctx
                async with transport_ctx as transport:
                    async with ClientSession(transport) as session:
                        # Perform MCP handshake/initialize
                        await session.initialize(
                            capabilities={},
                            protocol_version="2024-11-05",
                            client_info={
                                "name": "codex-serena-bridge",
                                "version": "3.0.0",
                            },
                        )
                        # Store session and mark connected
                        async with self.state.session_lock:
                            self.state.session = session
                            self.state.connected.set()
                            # Reset reconnect attempts on success
                            reconnect_attempts = 0
                            self._ever_connected = True

                        # Fetch tool metadata for this session
                        await self.fetch_tools(session)
                        self.state.reconnect_needed.clear()

                        # Attempt to consume SSE events from the transport. If the
                        # transport exposes an aiohttp-like `content.iter_any`, use
                        # our line parser. Otherwise fall back to a raw aiohttp GET
                        # so tests that use aiohttp_server still receive events.
                        consumed = False
                        try:
                            if hasattr(transport, "content") and hasattr(transport.content, "iter_any"):
                                await self._consume_sse(transport)
                                consumed = True
                        except Exception:
                            consumed = False

                        if not consumed:
                            if aiohttp is None:
                                log("No suitable transport for SSE consumption and aiohttp missing", "WARN",
                                    min_level=set_level_from_env("INFO"))
                            else:
                                try:
                                    async with aiohttp.ClientSession() as fallback_session:  # type: ignore
                                        async with fallback_session.get(self.url, headers={"X-API-KEY": self.api_key}) as resp:
                                            if resp.status != 200:
                                                log(f"SSE connection unexpected status {resp.status}", "WARN",
                                                    min_level=set_level_from_env("INFO"))
                                                raise RuntimeError("SSE failed to connect")
                                            await self._consume_sse(resp)
                                except Exception as exc:
                                    logger.exception("Fallback SSE consumption failed: %s", exc)

                        # Remain connected until shutdown or explicit reconnect request
                        while self._running and not self.state.shutdown.is_set():
                            if self.state.reconnect_needed.is_set():
                                log("Reconnect requested, tearing down session", "INFO",
                                    min_level=set_level_from_env("INFO"))
                                break
                            try:
                                await asyncio.wait_for(self.state.shutdown.wait(), 15)
                            except asyncio.TimeoutError:
                                continue

            except Exception as exc:
                logger.exception("Connection loop error: %s", exc)
                # Clear connected state and attempt to reconnect
                self.state.connected.clear()

                # Ensure we clear the session, cached tools and readiness flags on
                # runtime disconnects so consumers don't observe stale data.
                # _handle_disconnect is idempotent if there's nothing to close.
                await self._handle_disconnect(clean=False)

                # If we've never successfully connected yet, retry indefinitely
                # with a fixed 2s interval (startup phase).
                if not getattr(self, "_ever_connected", False):
                    log("Startup connect failed, retrying in 2s", "WARN",
                        min_level=set_level_from_env("INFO"))
                    await asyncio.sleep(2)
                    continue

                # Post-startup reconnects: apply capped exponential backoff
                reconnect_attempts += 1
                if reconnect_attempts > max_reconnects:
                    log("Max reconnect attempts exhausted, entering degraded mode", "ERROR",
                        min_level=set_level_from_env("INFO"))
                    self.state.reconnect_needed.set()
                    await asyncio.sleep(backoff_max)
                    continue

                backoff = min(backoff_base ** reconnect_attempts, backoff_max)
                log(f"Reconnect attempt {reconnect_attempts}, sleeping {backoff}s", "INFO",
                    min_level=set_level_from_env("INFO"))
                await asyncio.sleep(backoff)

            finally:
                # On shutdown ensure session and tools cleared
                if self.state.shutdown.is_set():
                    await self._handle_disconnect(clean=True)
                    return

    async def fetch_tools(self, session: ClientSession) -> None:
        """Fetch tools via the MCP ClientSession and cache them in state."""
        try:
            result = await session.list_tools()
            tools = getattr(result, "tools", None) or result.get("tools", [])
            # Only set cached tools when list_tools returns a non-empty set.
            # This avoids overwriting SSE-delivered tool lists with empty
            # results from `list_tools()` which can happen during initial
            # connection establishment.
            if tools:
                self.state.tools = tools
                self.state.tools_ready.set()
                log("Tools fetched and cached (via list_tools)", "INFO",
                    min_level=set_level_from_env("INFO"))
            else:
                log("list_tools returned no tools; leaving state as-is", "INFO",
                    min_level=set_level_from_env("INFO"))
        except Exception as exc:
            log(f"Tool fetch failed: {exc}", "WARN", min_level=set_level_from_env("INFO"))

    async def _consume_sse(self, resp: Any) -> None:
        """Consume a simple SSE stream, parsing data: lines.

        This parser handles streams that expose a `content.iter_any()` like
        aiohttp transports. It accumulates text until a double newline, then
        parses `data:` lines into JSON payloads and dispatches events.
        """
        buffer = ""
        async for chunk in resp.content.iter_any():  # pragma: no cover - needs aiohttp runtime to exercise
            if not chunk:
                continue
            text = chunk.decode("utf-8", errors="ignore")
            buffer += text
            while "\n\n" in buffer:
                raw, buffer = buffer.split("\n\n", 1)
                event = self._parse_sse_event(raw)
                if event is not None:
                    await self._handle_event(event)

    def _parse_sse_event(self, raw: str) -> Optional[Dict[str, Any]]:
        """Parse a raw SSE event block into a dict with 'data' key."""
        # Very small but robust parser for "data: {json}\n" lines
        lines = [l.strip() for l in raw.splitlines() if l.strip()]
        data_lines = [l for l in lines if l.startswith("data:")]
        if not data_lines:
            return None
        payload = "\n".join(l.split("data:", 1)[1].strip() for l in data_lines)
        try:
            return json.loads(payload)
        except Exception:
            # Not JSON; ignore
            return None

    async def _handle_event(self, event: Dict[str, Any]) -> None:
        """Handle a parsed event object coming from Serena."""
        typ = event.get("type")
        if typ == "tools/list/response":
            tools = event.get("tools", [])
            self.state.tools = tools
            self.state.tools_ready.set()
            log("Tools fetched and cached", "INFO",
                min_level=set_level_from_env("INFO"))
        # Placeholder for more event types

    async def _handle_disconnect(self, clean: bool = False) -> None:
        """Handle a disconnection: clear session and buffers.

        `clean=True` indicates shutdown path where we close session.
        """
        async with self.state.session_lock:
            if self.state.session is not None:
                try:
                    # Close underlying session if it's owned by this manager
                    try:
                        await self.state.session.__aexit__(None, None, None)  # type: ignore
                    except Exception:
                        pass
                except Exception:
                    pass
                self.state.session = None
                self._session_owner = False

        # Clear tool metadata so reconnect will re-fetch fresh state
        try:
            self.state.tools.clear()
        except Exception:
            pass
        try:
            self.state.tools_ready.clear()
        except Exception:
            pass

        # Fail in-flight requests placeholder: clear buffers
        if hasattr(self.state, "response_buffer"):
            try:
                self.state.response_buffer.clear()
            except Exception:
                pass
        if hasattr(self.state, "completed_requests"):
            try:
                self.state.completed_requests.clear()
            except Exception:
                pass

        if not clean:
            # signal reconnect attempt needed by setting event
            self.state.reconnect_needed.set()
