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

try:  # pragma: no cover - graceful downgrade when aiohttp is absent
    import aiohttp  # type: ignore
except Exception:  # pragma: no cover - handled in runtime
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
        # Startup: indefinite retries with 2s fixed backoff
        startup_backoff = 2.0
        reconnect_attempts = 0
        max_reconnects = 10

        while self._running and not self.state.shutdown.is_set():
            try:
                await self._ensure_session()
                async with self.state.session.get(self.url, headers={"X-API-KEY": self.api_key}) as resp:
                    if resp.status != 200:
                        log(f"SSE connection unexpected status {resp.status}", "WARN",
                            min_level=set_level_from_env("INFO"))
                        raise RuntimeError("SSE failed to connect")

                    # Set connected event and reset reconnect attempts
                    self.state.connected.set()
                    reconnect_attempts = 0
                    # Start reading events
                    await self._consume_sse(resp)
            except Exception as exc:
                logger.exception("Connection loop error: %s", exc)
                # Clear connected state and attempt to reconnect
                self.state.connected.clear()
                reconnect_attempts += 1
                if reconnect_attempts > max_reconnects:
                    log("Max reconnect attempts exhausted, entering degraded mode", "ERROR",
                        min_level=set_level_from_env("INFO"))
                    # Indicate degraded mode by setting reconnect_needed
                    self.state.reconnect_needed.set()
                    # Sleep before retrying after degraded period
                    await asyncio.sleep(30)
                    continue

                # Exponential backoff: 2,4,8,16,30
                backoff = min(2 ** reconnect_attempts, 30)
                await asyncio.sleep(backoff)
            finally:
                # On any iteration end ensure session cleared if shutdown
                if self.state.shutdown.is_set():
                    await self._handle_disconnect(clean=True)
                    return

    async def _ensure_session(self) -> None:
        """Ensure there's an aiohttp ClientSession in state."""
        if aiohttp is None:
            raise RuntimeError("aiohttp is required for SSE connections")
        async with self.state.session_lock:
            if self.state.session is None:
                self.state.session = aiohttp.ClientSession()  # type: ignore
                self._session_owner = True

    async def _consume_sse(self, resp: Any) -> None:
        """Consume a simple SSE stream, parsing data: lines."""
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
                    if self._session_owner:
                        await self.state.session.close()  # type: ignore
                except Exception:
                    pass
                self.state.session = None
                self._session_owner = False

        # Fail in-flight requests placeholder: clear buffers
        # (actual request tracking lives elsewhere; here we ensure no leaks)
        # Example attributes for clearing if present
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
