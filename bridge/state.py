"""Bridge runtime state and coordination primitives."""
from __future__ import annotations

import asyncio
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from mcp.client.session import ClientSession


@dataclass
class PendingRequest:
    request_id: Any
    method: str
    tool_name: Optional[str]
    submitted_at: float
    timeout: float
    future: asyncio.Future[Any]


class BridgeState:
    """Async-safe bridge state container."""

    def __init__(self) -> None:
        self.session: Optional["ClientSession"] = None
        self.connected: asyncio.Event = asyncio.Event()
        self.tools_ready: asyncio.Event = asyncio.Event()
        self.tools: list = []
        self.ever_connected: bool = False
        self.shutdown: asyncio.Event = asyncio.Event()
        self.reconnect_needed: asyncio.Event = asyncio.Event()
        self.session_lock: asyncio.Lock = asyncio.Lock()
        self.connection_lost: asyncio.Event = asyncio.Event()
        self.connection_lost_message: Optional[str] = None

        self.degraded: asyncio.Event = asyncio.Event()
        self.reconnect_failures: int = 0
        self.reconnect_exhausted_attempts: Optional[int] = None

        self.pending_requests: "OrderedDict[Any, PendingRequest]" = (
            OrderedDict()
        )
        self.pending_requests_lock: asyncio.Lock = asyncio.Lock()

    def is_running(self) -> bool:
        """Return True if bridge has not begun shutdown."""
        return not self.shutdown.is_set()

    def clear_session(self) -> None:
        """Clear session and reset connectivity-related state."""
        self.session = None
        self.connected.clear()
        self.tools_ready.clear()
        self.tools = []
        self.reconnect_needed.set()
        self.connection_lost.set()

    async def close(self) -> None:
        """Close the session and reset state."""
        async with self.session_lock:
            session = self.session
            self.session = None
        if session is not None:
            try:
                await session.__aexit__(None, None, None)
            except Exception:
                pass
        self.tools.clear()
        self.connected.clear()
        self.tools_ready.clear()
        self.reconnect_needed.clear()
        self.connection_lost.clear()
        self.connection_lost_message = None
        self.degraded.clear()
        self.reconnect_failures = 0
        self.reconnect_exhausted_attempts = None
        self.ever_connected = False
