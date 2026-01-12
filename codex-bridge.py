#!/usr/bin/env python3
"""
CODEX-to-Serena MCP Bridge (async)

This bridge keeps CODEX on STDIO while using Serena over SSE via the MCP SDK.
"""

import asyncio
import json
import os
import signal
import sys
from datetime import datetime
from typing import Any, Dict, Optional

from mcp.client import ClientSession
from mcp.client.sse import sse_client


# =============================================================================
# CONFIGURATION
# =============================================================================

SERENA_BASE = os.getenv("SERENA_BASE", "http://127.0.0.1:9121")
SERENA_SSE_URL = os.getenv("SERENA_SSE_URL", f"{SERENA_BASE}/sse")
SERENA_API_KEY = os.getenv("SERENA_API_KEY")
PROJECT_DIR = os.getenv(
    "PROJECT_DIR",
    r"C:\Users\pwalc\MyApps\paperless-ai",
)
LOG_FILE = os.getenv(
    "CODEX_BRIDGE_LOG_FILE",
    os.path.join(PROJECT_DIR, "bridge_debug.log"),
)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
SSE_TIMEOUT = int(os.getenv("SSE_TIMEOUT", "30"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "60"))
MAX_RECONNECT_ATTEMPTS = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "10"))
RECONNECT_BACKOFF_BASE = int(os.getenv("RECONNECT_BACKOFF_BASE", "2"))
RECONNECT_BACKOFF_MAX = int(os.getenv("RECONNECT_BACKOFF_MAX", "30"))
HEALTH_CHECK_INTERVAL = int(os.getenv("HEALTH_CHECK_INTERVAL", "15"))
TIMEOUTS = {
    "sse": SSE_TIMEOUT,
    "request": REQUEST_TIMEOUT,
    "health_check": HEALTH_CHECK_INTERVAL,
}
RETRY_CONFIG = {
    "max_attempts": MAX_RECONNECT_ATTEMPTS,
    "backoff_base": RECONNECT_BACKOFF_BASE,
    "backoff_max": RECONNECT_BACKOFF_MAX,
}


# =============================================================================
# LOGGING
# =============================================================================

LOG_LEVELS = {"DEBUG": 10, "INFO": 20, "WARN": 30, "ERROR": 40}


def log(message: str, level: str = "INFO") -> None:
    """Write timestamped log entry to file and stderr."""
    level_name = level.upper()
    if LOG_LEVELS.get(level_name, 20) < LOG_LEVELS.get(LOG_LEVEL, 20):
        return
    timestamp = datetime.now().isoformat()
    entry = f"[{timestamp}] [CODEX-BRIDGE] [{level_name}] {message}\n"
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as handle:
            handle.write(entry)
    except Exception:
        pass
    sys.stderr.write(entry)
    sys.stderr.flush()


def trunc(value: str, limit: int = 200) -> str:
    """Truncate long strings for log safety."""
    if len(value) <= limit:
        return value
    return f"{value[:limit]}...(+{len(value) - limit})"


# =============================================================================
# STATE
# =============================================================================

from collections import OrderedDict
from dataclasses import dataclass


@dataclass
class PendingRequest:
    id: Any
    future: asyncio.Future


class BridgeState:
    """Async-safe state for the bridge."""

    def __init__(self) -> None:
        self.session: Optional[ClientSession] = None
        self.connected: asyncio.Event = asyncio.Event()
        self.tools_ready: asyncio.Event = asyncio.Event()
        self.tools: list = []
        self.shutdown: asyncio.Event = asyncio.Event()
        self.session_lock: asyncio.Lock = asyncio.Lock()
        self.reconnect_needed: asyncio.Event = asyncio.Event()

        # Pipelined concurrency structures
        self.pending_requests: "OrderedDict[Any, PendingRequest]" = OrderedDict()
        self.completed_requests: set = set()
        self.pending_requests_lock: asyncio.Lock = asyncio.Lock()
        self.response_buffer: Dict[Any, Dict] = {}
        self.response_delivery_queue: asyncio.Queue = asyncio.Queue()
        self.deliver_task: Optional[asyncio.Task] = None

    def clear_session(self) -> None:
        """Clear session and reset connectivity-related state."""
        self.session = None
        self.connected.clear()
        self.tools_ready.clear()
        self.tools = []
        self.reconnect_needed.set()

        # Also clear in-flight request buffers to avoid leaks
        try:
            self.pending_requests.clear()
        except Exception:
            pass
        try:
            self.completed_requests.clear()
        except Exception:
            pass
        try:
            self.response_buffer.clear()
        except Exception:
            pass
        # Drain the delivery queue
        try:
            while not self.response_delivery_queue.empty():
                self.response_delivery_queue.get_nowait()
        except Exception:
            pass


state = BridgeState()


# =============================================================================
# UTILS
# =============================================================================

def jsonrpc_error(msg_id: Any, code: int, message: str) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code,
                                                       "message": message}}


def jsonrpc_result(msg_id: Any, result: Dict[str, Any]) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def serialize_result(value: Any) -> Any:
    """Best-effort conversion of SDK results to JSON-serializable objects."""
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if hasattr(value, "dict"):
        return value.dict()
    return value


# =============================================================================
# SERENA CONNECTION
# =============================================================================

async def fetch_tools(session: ClientSession) -> None:
    """Fetch tools from Serena and cache them."""
    try:
        result = await asyncio.wait_for(session.list_tools(), REQUEST_TIMEOUT)
        tools = getattr(result, "tools", None) or result.get("tools", [])
        state.tools = tools
        state.tools_ready.set()
        names = [tool.get("name", "?") for tool in tools[:5]]
        log(f"Fetched {len(tools)} tools: {', '.join(names)}")
    except Exception as exc:
        log(f"Tool fetch failed: {exc}")


async def connect_to_serena(max_attempts: Optional[int] = None) -> None:
    """Maintain SSE connection to Serena with backoff and retries."""
    attempts = 0
    backoff = RECONNECT_BACKOFF_BASE
    attempt_limit = MAX_RECONNECT_ATTEMPTS if max_attempts is None else \
        max_attempts

    while not state.shutdown.is_set():
        if attempt_limit and attempts >= attempt_limit:
            log("Max SSE retries exceeded, stopping bridge")
            state.shutdown.set()
            return

        try:
            attempts += 1
            log(f"Connecting to Serena SSE (attempt {attempts})...")
            async with sse_client(SERENA_SSE_URL,
                                  timeout=SSE_TIMEOUT) as transport:
                async with ClientSession(transport) as session:
                    await session.initialize(
                        capabilities={},
                        protocol_version="2024-11-05",
                        client_info={
                            "name": "codex-serena-bridge",
                            "version": "3.0.0",
                        },
                    )
                    async with state.session_lock:
                        state.session = session
                        state.connected.set()
                    backoff = RECONNECT_BACKOFF_BASE
                    await fetch_tools(session)
                    log("Serena session ready")
                    state.reconnect_needed.clear()

                    while not state.shutdown.is_set():
                        if state.reconnect_needed.is_set():
                            log("Reconnect requested from forwarder")
                            break
                        try:
                            await asyncio.wait_for(
                                state.shutdown.wait(),
                                HEALTH_CHECK_INTERVAL,
                            )
                        except asyncio.TimeoutError:
                            continue

        except asyncio.CancelledError:
            log("SSE connector cancelled")
            raise
        except Exception as exc:
            log(f"SSE connection error: {exc}")
            await asyncio.sleep(min(backoff, RECONNECT_BACKOFF_MAX))
            backoff = min(backoff * 2, RECONNECT_BACKOFF_MAX)
        finally:
            state.clear_session()


# =============================================================================
# REQUEST FORWARDING
# =============================================================================

async def ensure_connected(timeout: int = 10) -> bool:
    """Wait for connection readiness."""
    try:
        await asyncio.wait_for(state.connected.wait(), timeout)
        return True
    except asyncio.TimeoutError:
        return False


async def forward_request(request: Dict[str, Any], *, raise_on_error: bool = False) -> Dict[str, Any]:
    """Forward MCP requests to Serena via the SDK.

    If `raise_on_error` is True, exceptions are re-raised so a retry
    loop can classify and decide on retry behavior. Otherwise, a
    JSON-RPC error dict is returned.
    """
    msg_id = request.get("id")
    method = request.get("method")
    params = request.get("params") or {}

    if not await ensure_connected(timeout=5):
        if raise_on_error:
            raise RuntimeError("Not connected to Serena")
        return jsonrpc_error(msg_id, -32603, "Not connected to Serena")

    async with state.session_lock:
        session = state.session

    if session is None:
        if raise_on_error:
            raise RuntimeError("Missing Serena session")
        return jsonrpc_error(msg_id, -32603, "Missing Serena session")

    try:
        if method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {})
            result = await asyncio.wait_for(
                session.call_tool(name, arguments),
                REQUEST_TIMEOUT,
            )
            log(f"tools/call {name}: {trunc(str(result))}")
            return jsonrpc_result(msg_id, {"result": serialize_result(result)})

        if method == "resources/read":
            uri = params.get("uri")
            result = await asyncio.wait_for(
                session.read_resource(uri),
                REQUEST_TIMEOUT,
            )
            log(f"resources/read {uri}: {trunc(str(result))}")
            return jsonrpc_result(msg_id, serialize_result(result))

        if method == "resources/list":
            result = await asyncio.wait_for(
                session.list_resources(),
                REQUEST_TIMEOUT,
            )
            log(f"resources/list: {trunc(str(result))}")
            return jsonrpc_result(msg_id, serialize_result(result))

        return jsonrpc_error(
            msg_id,
            -32601,
            f"Method not found: {method}",
        )

    except asyncio.TimeoutError as exc:
        log(f"Timeout forwarding {method} (id={msg_id})")
        state.clear_session()
        if raise_on_error:
            raise
        return jsonrpc_error(
            msg_id,
            -32603,
            "Timeout waiting for Serena response",
        )
    except Exception as exc:
        log(f"Error forwarding {method}: {exc}")
        state.clear_session()
        if raise_on_error:
            raise
        return jsonrpc_error(msg_id, -32603, str(exc))


# -----------------------------------------------------------------------------
# Error classification and smart retry logic
# -----------------------------------------------------------------------------

from dataclasses import dataclass


class PermanentError(Exception):
    """Signal that an error is permanent and should not be retried."""


@dataclass
class RetryState:
    attempts: int = 0


def classify_error(exc: Exception) -> str:
    """Classify exception as 'transient' or 'permanent'."""
    # Transient errors: timeouts, connection issues, 429/503
    if isinstance(exc, asyncio.TimeoutError):
        return "transient"
    status = getattr(exc, "status", None)
    if status in (429, 503):
        return "transient"
    if isinstance(exc, PermanentError):
        return "permanent"
    # Conservative default: unknown treated as permanent
    return "permanent"


def should_retry(exc: Exception, retry_state: RetryState, *, max_attempts: int = 3):
    """Return (bool, backoff_seconds) whether to retry and how long to wait."""
    cls = classify_error(exc)
    if cls == "permanent":
        return False, 0.0
    if retry_state.attempts >= max_attempts:
        return False, 0.0
    backoff = float(1 * (2 ** retry_state.attempts))
    return True, backoff


def enrich_error(exc: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
    """Return enriched error payload with bridge context."""
    msg = str(exc)
    data = {"context": context}
    if isinstance(exc, asyncio.TimeoutError):
        msg = f"Bridge timeout waiting for Serena response: {msg}"
    status = getattr(exc, "status", None)
    if status is not None:
        msg = f"Serena HTTP {status}: {msg}"
    return {"message": msg, "data": data}


# -----------------------------------------------------------------------------
# Pipelined response ordering helpers
# -----------------------------------------------------------------------------

async def _forward_and_match(request: Dict[str, Any]) -> None:
    """Forward a request with retries and register its response."""
    msg_id = request.get("id")
    retry = RetryState()
    while True:
        try:
            response = await forward_request(request, raise_on_error=True)
            await match_response(msg_id, response)
            return
        except Exception as exc:
            retry.attempts += 1
            do_retry, backoff = should_retry(exc, retry)
            log(f"Retry attempt {retry.attempts} for id={msg_id}: {exc}", "WARN")
            if not do_retry:
                enriched = enrich_error(exc, {"id": msg_id, "method": request.get("method")})
                err = jsonrpc_error(msg_id, -32603, enriched["message"])
                err["data"] = enriched.get("data")
                await match_response(msg_id, err)
                return
            await asyncio.sleep(backoff)


async def match_response(msg_id: Any, response: Dict[str, Any]) -> None:
    """Buffer or enqueue responses to preserve request order.

    This function will add the response to the response buffer and then
    attempt to release any buffered responses starting from the oldest
    pending request.
    """
    async with state.pending_requests_lock:
        # Cache response
        state.response_buffer[msg_id] = response

        # Release any buffered responses in request order
        while state.pending_requests:
            first_id = next(iter(state.pending_requests))
            if first_id in state.response_buffer:
                resp = state.response_buffer.pop(first_id)
                state.pending_requests.pop(first_id, None)
                await state.response_delivery_queue.put(resp)
            else:
                break


async def deliver_responses() -> None:
    """Consume the delivery queue and write responses to stdout serially."""
    log("Starting response delivery task", "DEBUG")
    try:
        while not state.shutdown.is_set():
            try:
                resp = await asyncio.wait_for(
                    state.response_delivery_queue.get(), timeout=0.5
                )
            except asyncio.TimeoutError:
                continue
            try:
                await send_response(resp)
            except Exception as exc:
                log(f"Failed to write response: {exc}")
    finally:
        log("Response delivery task stopped", "DEBUG")


# =============================================================================
# STDIO HANDLER
# =============================================================================

async def send_response(response: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(response) + "\n")
    sys.stdout.flush()


async def handle_jsonrpc(request: Dict[str, Any]) -> None:
    method = request.get("method")
    msg_id = request.get("id")
    log(f"CODEX request: {method} (id={msg_id})")

    if method == "initialize":
        await send_response(
            jsonrpc_result(
                msg_id,
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {"listChanged": False},
                        "resources": {"listChanged": False},
                    },
                    "serverInfo": {
                        "name": "codex-serena-bridge",
                        "version": "3.0.0",
                    },
                },
            )
        )
        return

    if method == "notifications/initialized":
        return

    if method == "tools/list":
        ready = await ensure_connected(timeout=10)
        if not ready:
            log("Not connected while handling tools/list")
            await send_response(jsonrpc_result(msg_id, {"tools": []}))
            return
        try:
            await asyncio.wait_for(state.tools_ready.wait(), 15)
        except asyncio.TimeoutError:
            log("Tools not ready before timeout, returning empty list")
            await send_response(jsonrpc_result(msg_id, {"tools": []}))
            return
        await send_response(jsonrpc_result(msg_id, {"tools": state.tools}))
        return

    if method in {"tools/call", "resources/read", "resources/list"}:
        msg_id = msg_id
        # Register pending request and start forward task so multiple
        # requests may be in-flight concurrently.
        pending = PendingRequest(msg_id, asyncio.get_running_loop().create_future())
        async with state.pending_requests_lock:
            state.pending_requests[msg_id] = pending
        # Launch forwarding in background; response will be matched
        asyncio.create_task(_forward_and_match(request))
        return

    await send_response(
        jsonrpc_error(
            msg_id,
            -32601,
            f"Method not found: {method}",
        )
    )


async def handle_stdin() -> None:
    log("Starting stdin handler...")
    while not state.shutdown.is_set():
        try:
            line = await asyncio.to_thread(sys.stdin.readline)
        except Exception as exc:
            log(f"Error reading stdin: {exc}")
            await asyncio.sleep(0.1)
            continue

        if not line:
            await asyncio.sleep(0.05)
            continue

        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            await handle_jsonrpc(request)
        except json.JSONDecodeError as exc:
            log(f"Invalid JSON: {exc}")
        except Exception as exc:
            log(f"Error handling request: {exc}")


# =============================================================================
# MAIN
# =============================================================================


def _install_signal_handlers(loop: asyncio.AbstractEventLoop) -> None:
    """Install SIGINT/SIGTERM handlers for graceful shutdown."""
    for sig in (getattr(signal, "SIGINT", None),
                getattr(signal, "SIGTERM", None)):
        if sig is None:
            continue
        try:
            loop.add_signal_handler(sig, state.shutdown.set)
        except NotImplementedError:
            log("Signal handlers unsupported on this platform", "DEBUG")
            break


async def async_main() -> None:
    log("=" * 60)
    log("CODEX-Serena Bridge v3.0 starting...")
    log(f"Serena SSE endpoint: {SERENA_SSE_URL}")
    log("=" * 60)

    loop = asyncio.get_running_loop()
    _install_signal_handlers(loop)

    connector = asyncio.create_task(connect_to_serena())
    stdin_task = asyncio.create_task(handle_stdin())
    # Start response delivery background task
    state.deliver_task = asyncio.create_task(deliver_responses())

    try:
        await asyncio.gather(connector, stdin_task, state.deliver_task)
    except asyncio.CancelledError:
        log("Bridge cancellation requested")
    finally:
        state.shutdown.set()
        connector.cancel()
        stdin_task.cancel()
        if state.deliver_task:
            state.deliver_task.cancel()
        await asyncio.gather(connector, stdin_task, state.deliver_task, return_exceptions=True)
        log("Bridge stopped")


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
