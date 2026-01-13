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

# Conditional MCP imports to support test stubs via BRIDGE_TEST_STUBS
if os.getenv("BRIDGE_TEST_STUBS"):
    # Prefer the explicit test fixtures module (used by tests that import stubs
    # directly). If that path is not importable (e.g., running tests from a
    # different working dir), fall back to the local `mcp` compatibility stub
    # found in the repository.
    try:
        from test.fixtures.mcp_client_stubs import ClientSession, sse_client  # type: ignore
        sys.stderr.write("BRIDGE_TEST_STUBS active: using test.fixtures stubs\n")
    except Exception:
        # Fallback to local mcp stub package
        try:
            from mcp.client import ClientSession  # type: ignore
            from mcp.client.sse import sse_client  # type: ignore
        except Exception:
            # Support the repository-local stub layout (mcp.client.client)
            from mcp.client.client import ClientSession  # type: ignore
            from mcp.client.sse import sse_client  # type: ignore
        sys.stderr.write("BRIDGE_TEST_STUBS active: falling back to local mcp stubs\n")
else:
    try:
        try:
            from mcp.client import ClientSession  # type: ignore
            from mcp.client.sse import sse_client  # type: ignore
        except Exception:
            from mcp.client.client import ClientSession  # type: ignore
            from mcp.client.sse import sse_client  # type: ignore
    except Exception as exc:
        raise ImportError("The MCP SDK 'mcp' is not installed") from exc


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
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
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
        # Number of consecutive reconnect failures (used for diagnostics)
        self.reconnect_failures: int = 0
        self.degraded: asyncio.Event = asyncio.Event()
        self.reconnect_exhausted_attempts: Optional[int] = None

        # Pipelined concurrency structures
        self.pending_requests: "OrderedDict[Any, PendingRequest]" = OrderedDict()
        self.completed_requests: set = set()
        self.pending_requests_lock: asyncio.Lock = asyncio.Lock()
        self.response_buffer: Dict[Any, Dict] = {}
        self.response_delivery_queue: asyncio.Queue = asyncio.Queue()
        self.deliver_task: Optional[asyncio.Task] = None

    def ensure_async_primitives(self) -> None:
        """Ensure asyncio primitives (locks/queues/events) are bound to the current loop.

        Tests and certain runtime bootstrapping may create the BridgeState before an
        event loop is present; this helper binds any missing asyncio primitives to
        the active loop so tests can run deterministically.
        """
        # These primitives are cheap to create and safe to call multiple times.
        if self.pending_requests_lock is None:
            self.pending_requests_lock = asyncio.Lock()
        if self.response_delivery_queue is None:
            self.response_delivery_queue = asyncio.Queue()
        # Events are created at init but ensure their presence
        if not hasattr(self, 'connected') or self.connected is None:
            self.connected = asyncio.Event()
        if not hasattr(self, 'tools_ready') or self.tools_ready is None:
            self.tools_ready = asyncio.Event()
        if not hasattr(self, 'shutdown') or self.shutdown is None:
            self.shutdown = asyncio.Event()
        if not hasattr(self, 'session_lock') or self.session_lock is None:
            self.session_lock = asyncio.Lock()

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

    ever_connected = False

    while not state.shutdown.is_set():
        # Count this upcoming connection attempt so diagnostics reflect
        # failures even during initial startup.
        attempts += 1

        # If we've hit the configured attempt limit after having previously
        # connected, enter degraded mode (keep running) rather than stopping
        # the bridge — this allows requests to be served with degraded-mode
        # errors while background retries continue.
        if ever_connected and attempt_limit and attempts >= attempt_limit:
            log(f"Reconnect attempts exhausted ({attempts}), entering degraded mode and continuing background retries.")
            state.degraded.set()
            state.reconnect_exhausted_attempts = attempts
            # Sleep a long degraded period before continuing retries to avoid
            # tight busy loops.
            await asyncio.sleep(RECONNECT_BACKOFF_MAX)
            continue

        try:
            # Initial startup: retry indefinitely at fixed 2s intervals until
            # we reach a successful connection. After the first success, we
            # switch to bounded exponential backoff behavior.
            if not ever_connected:
                log(f"Connecting to Serena SSE (startup attempt {attempts})")
            else:
                log(f"Connecting to Serena SSE (attempt {attempts})...")

            transport_ctx = sse_client(SERENA_SSE_URL, timeout=SSE_TIMEOUT)
            # sse_client may be an async factory or return a context object
            if asyncio.iscoroutine(transport_ctx):
                transport_ctx = await transport_ctx
            async with transport_ctx as transport:
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
                        # Connection succeeded; reset reconnect failure counter.
                        state.reconnect_failures = 0
                        # If we were in degraded mode due to exhausted attempts,
                        # clear that flag on a successful connect and reset the
                        # diagnostic counter.
                        try:
                            if state.degraded.is_set():
                                state.degraded.clear()
                                state.reconnect_exhausted_attempts = None
                        except Exception:
                            pass
                    backoff = RECONNECT_BACKOFF_BASE
                    attempts = 0
                    ever_connected = True
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
            # Track consecutive failures for diagnostics
            state.reconnect_failures = attempts

            # If initial startup failures have exhausted the configured
            # attempts threshold, enter degraded mode but keep running: set
            # the `degraded` event and record the exhausted attempts value.
            if not ever_connected and attempt_limit and attempts >= attempt_limit:
                log("Startup failures exhausted, entering degraded mode (background retries)")
                state.degraded.set()
                state.reconnect_exhausted_attempts = attempts
                # Sleep for a longer degraded period then continue retrying
                await asyncio.sleep(RECONNECT_BACKOFF_MAX)
                continue

            # Startup phase: retry indefinitely at fixed 2s until connected
            if not ever_connected:
                await asyncio.sleep(2)
                continue

            # Post-startup: exponential backoff with cap
            await asyncio.sleep(min(backoff, RECONNECT_BACKOFF_MAX))
            backoff = min(backoff * 2, RECONNECT_BACKOFF_MAX)
        finally:
            state.clear_session()


# =============================================================================
# REQUEST FORWARDING
# =============================================================================

async def ensure_connected(timeout: int = 10) -> bool:
    """Return True if the bridge is connected within `timeout` seconds."""
    try:
        await asyncio.wait_for(state.connected.wait(), timeout)
        return True
    except asyncio.TimeoutError:
        return False


# Error classification & retry helpers
class PermanentError(Exception):
    """Indicates a non-retryable/permanent failure."""


class RetryState:
    def __init__(self) -> None:
        self.attempts: int = 0


def classify_error(exc: Exception) -> str:
    """Classify exceptions as 'transient' or 'permanent'."""
    if isinstance(exc, asyncio.TimeoutError):
        return "transient"
    status = getattr(exc, "status", None)
    if isinstance(status, int) and status >= 500:
        return "transient"
    if isinstance(exc, PermanentError):
        return "permanent"
    return "permanent"


def should_retry(exc: Exception, retry_state: RetryState, max_attempts: int = 3):
    """Decide whether to retry and return (do_retry, backoff_seconds).

    backoff is 2 ** attempts (1.0, 2.0, 4.0 ...)
    """
    cls = classify_error(exc)
    if cls != "transient":
        return False, 0.0
    if retry_state.attempts < max_attempts:
        return True, float(2 ** (retry_state.attempts))
    return False, 0.0


def enrich_error(exc: Exception, context: Dict[str, Any]):
    """Turn an exception into a JSON-RPC error object with helpful message/data."""
    if isinstance(exc, asyncio.TimeoutError):
        msg = f"Bridge timeout: {str(exc)}"
    elif hasattr(exc, "status"):
        msg = f"Serena HTTP {getattr(exc, 'status')}: {str(exc)}"
    else:
        msg = f"Bridge error: {str(exc)}"
    # Provide both a quick message and a JSON-RPC error envelope so callers
    # that expect either shape (tests and runtime paths) are satisfied.
    # Use standard JSON-RPC internal error code (-32603) for unexpected failures
    envelope = {"jsonrpc": "2.0", "id": context.get("id"), "error": {"code": -32603, "message": msg, "data": {"context": context}}}
    envelope["message"] = msg
    envelope["data"] = {"context": context}
    return envelope


# =============================================================================
# I/O and JSON-RPC plumbing
# =============================================================================


async def send_response(resp: Dict[str, Any]) -> None:
    """Send a JSON-RPC response to stdout (one line) and flush."""
    try:
        line = json.dumps(resp, ensure_ascii=False)
        sys.stdout.write(line + "\n")
        sys.stdout.flush()
    except Exception as exc:  # pragma: no cover - trivial logging path
        log(f"send_response failed: {exc}", level="ERROR")
        raise


async def _forward_and_match(request: Dict[str, Any]) -> None:
    """Forward a request to Serena (with retries) and enqueue the response for delivery.

    This routine coordinates retries using RetryState/should_retry and honours
    both exception-based failures (e.g., timeouts) and forward_request returning
    an error dict.
    """
    msg_id = request.get("id")
    retry = RetryState()

    while True:
        try:
            resp = await forward_request(request, raise_on_error=False)
            # If a pending request exists, set its future (and remove it on success)
            async with state.pending_requests_lock:
                pending = state.pending_requests.get(msg_id)
                if pending:
                    try:
                        if not pending.future.done():
                            pending.future.set_result(resp)
                    except Exception:
                        pass
                    # Remove pending on success
                    try:
                        state.pending_requests.pop(msg_id, None)
                    except Exception:
                        pass
            # Enqueue for delivery
            await state.response_delivery_queue.put(resp)
            return
        except Exception as exc:
            do_retry, backoff = should_retry(exc, retry)
            if not do_retry:
                # Give up and emit enriched error
                err = enrich_error(exc, {"id": msg_id})
                async with state.pending_requests_lock:
                    pending = state.pending_requests.get(msg_id)
                    if pending and not pending.future.done():
                        try:
                            pending.future.set_result(err)
                        except Exception:
                            pass
                    # Remove pending - it's terminal
                    try:
                        state.pending_requests.pop(msg_id, None)
                    except Exception:
                        pass
                await state.response_delivery_queue.put(err)
                return
            retry.attempts += 1
            await asyncio.sleep(backoff)


async def forward_request(request: Dict[str, Any], *, raise_on_error: bool = False) -> Dict[str, Any]:
    """Forward a JSON-RPC request to Serena via the MCP session.

    Returns a JSON-RPC style dict with either 'result' or 'error'.
    On session absence, respects `raise_on_error` to optionally raise.
    """
    if state.session is None or not state.connected.is_set():
        if raise_on_error:
            raise RuntimeError("No active session")
        return jsonrpc_error(request.get("id"), -32000, "No active Serena session")

    method = request.get("method")
    params = request.get("params", {}) or {}
    try:
        if method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {})
            result = await asyncio.wait_for(state.session.call_tool(name, arguments), REQUEST_TIMEOUT)
            return jsonrpc_result(request.get("id"), serialize_result(result))
        if method == "tools/list":
            result = await asyncio.wait_for(state.session.list_tools(), REQUEST_TIMEOUT)
            return jsonrpc_result(request.get("id"), serialize_result(result))
        if method == "resources/read":
            uri = params.get("uri")
            result = await asyncio.wait_for(state.session.read_resource(uri), REQUEST_TIMEOUT)
            return jsonrpc_result(request.get("id"), serialize_result(result))
        if method == "resources/list":
            result = await asyncio.wait_for(state.session.list_resources(), REQUEST_TIMEOUT)
            return jsonrpc_result(request.get("id"), serialize_result(result))
        # Unknown method
        return jsonrpc_error(request.get("id"), -32601, "Method not found")
    except asyncio.TimeoutError as exc:
        # Signal connector to re-establish and return a JSON-RPC internal error
        state.reconnect_needed.set()
        return jsonrpc_error(request.get("id"), -32603, "Timeout waiting for Serena response")
    except Exception as exc:
        # Preserve pending and prompt reconnect for connectivity errors
        state.reconnect_needed.set()
        return enrich_error(exc, {"id": request.get("id")})


async def handle_jsonrpc(obj: Dict[str, Any]) -> None:
    """Handle a parsed incoming JSON-RPC request from stdin."""
    if not isinstance(obj, dict):
        log("Ignoring non-object JSON-RPC message", level="WARN")
        return
    mid = obj.get("id")
    m = obj.get("method")

    # Simple initialize: reply immediately
    if m == "initialize":
        await send_response(jsonrpc_result(mid, {}))
        return

    # For callables that go to Serena, register a pending request and fire-and-forget
    if m in ("tools/call", "tools/list", "resources/read", "resources/list"):
        # Register pending request
        loop = asyncio.get_running_loop()
        fut = loop.create_future()
        async with state.pending_requests_lock:
            state.pending_requests[mid] = PendingRequest(mid, fut)
        # Fire forwarder
        asyncio.create_task(_forward_and_match(obj))
        return

    # Unknown - reply with default acknowledgement
    await send_response(jsonrpc_result(mid, {}))


async def handle_stdin() -> None:
    """Read JSON-RPC lines from stdin, parse and dispatch."""
    while not state.shutdown.is_set():
        try:
            line = sys.stdin.readline()
        except Exception as exc:  # pragma: no cover - stdin edge cases
            log(f"stdin readline failed: {exc}", level="ERROR")
            await asyncio.sleep(0.01)
            continue
        if not line:
            # no data available -> yield
            await asyncio.sleep(0.01)
            continue
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except Exception as exc:
            log(f"Failed to parse stdin line as JSON: {trunc(line)} - {exc}", level="WARN")
            continue
        try:
            await handle_jsonrpc(msg)
        except Exception as exc:
            log(f"Error handling jsonrpc: {exc}", level="ERROR")


async def deliver_responses() -> None:
    """Continuously deliver responses from the queue to stdout."""
    try:
        while not state.shutdown.is_set():
            try:
                resp = await asyncio.wait_for(state.response_delivery_queue.get(), timeout=0.1)
            except asyncio.TimeoutError:
                continue
            try:
                await send_response(resp)
            except Exception as exc:
                log(f"deliver_responses: send_response failed: {exc}", level="ERROR")
    finally:
        # Drain remaining items
        while not state.response_delivery_queue.empty():
            try:
                resp = state.response_delivery_queue.get_nowait()
            except Exception:
                break
            try:
                await send_response(resp)
            except Exception:
                pass


async def async_main() -> None:
    """Top-level async runner: start connector, stdin and delivery loops and wait for shutdown."""
    state.ensure_async_primitives()

    connector_task = asyncio.create_task(connect_to_serena())
    stdin_task = asyncio.create_task(handle_stdin())
    delivery_task = asyncio.create_task(deliver_responses())

    try:
        await state.shutdown.wait()
    finally:
        for t in (connector_task, stdin_task, delivery_task):
            try:
                t.cancel()
            except Exception:
                pass
        await asyncio.gather(connector_task, stdin_task, delivery_task, return_exceptions=True)


# Optional signal wiring for graceful shutdown when run as script
def _install_signal_handlers() -> None:
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return

    def _on_sig(signum, frame):  # pragma: no cover - runtime wiring
        log(f"Received signal {signum}, shutting down...", level="INFO")
        state.shutdown.set()

    signal.signal(signal.SIGINT, _on_sig)
    signal.signal(signal.SIGTERM, _on_sig)
