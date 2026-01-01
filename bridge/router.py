"""Request routing and retry logic for bridge operations."""
from __future__ import annotations

import asyncio
import time
from typing import Any

import mcp.types as types
from mcp.shared.exceptions import McpError

from . import config
from .errors import (
    RetryState,
    enrich_error,
    is_connection_error,
    should_retry,
)
from .logging import log
from .state import BridgeState, PendingRequest


class RequestRouter:
    """Route MCP requests from CODEX to Serena with retries."""

    def __init__(self, state: BridgeState) -> None:
        self.state = state

    def _select_timeout(self, method: str, params: dict[str, Any]) -> float:
        if method == "tools/call":
            tool_name = params.get("name")
            overrides = config.TIMEOUT_POLICY.get("tools/call", {})
            if tool_name and tool_name in overrides:
                return float(overrides[tool_name])
            return float(
                overrides.get("_default", config.REQUEST_TIMEOUT_DEFAULT)
            )
        timeout = config.TIMEOUT_POLICY.get(method)
        if timeout is None:
            return float(config.REQUEST_TIMEOUT_DEFAULT)
        return float(timeout)

    def _connection_error(self) -> McpError:
        attempts = self.state.reconnect_failures or 0
        max_attempts = config.MAX_RECONNECT_ATTEMPTS
        if not self.state.ever_connected:
            message = (
                "Serena unavailable - connection in progress "
                f"(attempt {attempts})"
            )
        elif self.state.degraded.is_set():
            message = (
                "Serena unavailable after connection loss "
                f"({max_attempts} retries exhausted)"
            )
        else:
            message = (
                "Serena unavailable - connection in progress "
                f"(attempt {attempts}/{max_attempts})"
            )
        return McpError(
            types.ErrorData(
                code=types.INTERNAL_ERROR,
                message=message,
                data={"attempts": attempts, "max_attempts": max_attempts},
            )
        )

    def _connection_lost_error(self) -> McpError:
        message = (
            self.state.connection_lost_message
            or "Connection to Serena lost during operation"
        )
        return McpError(
            types.ErrorData(
                code=types.INTERNAL_ERROR,
                message=message,
                data={"context": {"reason": "connection_lost"}},
            )
        )

    def _mark_connection_lost(self) -> None:
        if not self.state.ever_connected:
            return
        if self.state.connection_lost.is_set():
            return
        self.state.connection_lost_message = (
            "Connection to Serena lost during operation"
        )
        self.state.connection_lost.set()
        self.state.reconnect_needed.set()

    async def _get_session(self) -> Any:
        if self.state.connection_lost.is_set():
            raise self._connection_lost_error()
        if not self.state.connected.is_set():
            raise self._connection_error()
        async with self.state.session_lock:
            session = self.state.session
        if session is None:
            raise self._connection_error()
        return session

    async def _await_with_disconnect(self, coro: Any) -> Any:
        call_task = asyncio.create_task(coro)
        lost_task = asyncio.create_task(self.state.connection_lost.wait())
        try:
            done, _pending = await asyncio.wait(
                [call_task, lost_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            if lost_task in done:
                call_task.cancel()
                await asyncio.gather(
                    call_task,
                    return_exceptions=True,
                )
                raise self._connection_lost_error()
            return await call_task
        finally:
            if not lost_task.done():
                lost_task.cancel()

    async def _call_session(
        self,
        method: str,
        params: dict[str, Any],
        timeout: float,
    ) -> Any:
        session = await self._get_session()
        if method == "tools/list" and self.state.tools_ready.is_set():
            return types.ListToolsResult(tools=self.state.tools)
        if method == "tools/list":
            cursor = params.get("cursor")
            return await asyncio.wait_for(
                self._await_with_disconnect(session.list_tools(cursor)),
                timeout,
            )
        if method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {}) or {}
            return await asyncio.wait_for(
                self._await_with_disconnect(
                    session.call_tool(name, arguments),
                ),
                timeout,
            )
        if method == "resources/list":
            cursor = params.get("cursor")
            return await asyncio.wait_for(
                self._await_with_disconnect(
                    session.list_resources(cursor),
                ),
                timeout,
            )
        if method == "resources/read":
            uri = params.get("uri")
            return await asyncio.wait_for(
                self._await_with_disconnect(session.read_resource(uri)),
                timeout,
            )
        if method == "prompts/list":
            cursor = params.get("cursor")
            return await asyncio.wait_for(
                self._await_with_disconnect(session.list_prompts(cursor)),
                timeout,
            )
        if method == "prompts/get":
            name = params.get("name")
            arguments = params.get("arguments", {}) or {}
            return await asyncio.wait_for(
                self._await_with_disconnect(
                    session.get_prompt(name, arguments),
                ),
                timeout,
            )
        raise McpError(
            types.ErrorData(
                code=types.METHOD_NOT_FOUND,
                message=f"Method not found: {method}",
                data={"method": method},
            )
        )

    async def forward(
        self,
        method: str,
        params: dict[str, Any],
        request_id: Any,
    ) -> Any:
        timeout = self._select_timeout(method, params)
        retry_state = RetryState()
        tool_name = params.get("name") if method == "tools/call" else None
        pending = PendingRequest(
            request_id=request_id,
            method=method,
            tool_name=tool_name,
            submitted_at=time.time(),
            timeout=timeout,
            future=asyncio.get_running_loop().create_future(),
        )
        async with self.state.pending_requests_lock:
            self.state.pending_requests[request_id] = pending

        while True:
            try:
                result = await self._call_session(method, params, timeout)
                async with self.state.pending_requests_lock:
                    self.state.pending_requests.pop(request_id, None)
                return result
            except McpError as exc:
                async with self.state.pending_requests_lock:
                    self.state.pending_requests.pop(request_id, None)
                raise exc
            except Exception as exc:
                retry_state.last_error = exc
                do_retry, backoff = should_retry(
                    exc,
                    retry_state,
                    max_attempts=config.RETRY_MAX_ATTEMPTS,
                    backoff_base=config.RETRY_BACKOFF_BASE,
                    backoff_max=config.RETRY_BACKOFF_MAX,
                )
                if not do_retry:
                    async with self.state.pending_requests_lock:
                        self.state.pending_requests.pop(request_id, None)
                    if is_connection_error(exc):
                        self._mark_connection_lost()
                        raise self._connection_lost_error()
                    context = {
                        "id": request_id,
                        "method": method,
                        "tool": tool_name,
                        "timeout": timeout,
                        "attempts": retry_state.attempts,
                    }
                    raise McpError(enrich_error(exc, context))
                retry_state.attempts += 1
                log(
                    "Retry attempt "
                    f"{retry_state.attempts} for id={request_id}: {exc}",
                    level="WARN",
                )
                await asyncio.sleep(backoff)
