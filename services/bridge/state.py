import asyncio
from typing import Any, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    # Avoid importing aiohttp at runtime when not installed.
    from aiohttp import ClientSession  # pragma: no cover


class BridgeState:
    """Container for bridge runtime state and synchronization.

    Attributes
    ----------
    session:
        Optional client session for outgoing requests.
    connected:
        Event set when a connection is established.
    tools:
        List of tools metadata received from Serena.
    tools_ready:
        Event set once tools have been registered.
    shutdown:
        Event triggered to perform graceful shutdown.
    reconnect_needed:
        Event set when a reconnect should be attempted.
    session_lock:
        Lock protecting access to the session object.
    """

    def __init__(self) -> None:
        self.session: Optional["ClientSession"] = None
        self.connected: asyncio.Event = asyncio.Event()
        self.tools: List[Dict[str, Any]] = []
        self.tools_ready: asyncio.Event = asyncio.Event()
        self.shutdown: asyncio.Event = asyncio.Event()
        self.reconnect_needed: asyncio.Event = asyncio.Event()
        self.session_lock: asyncio.Lock = asyncio.Lock()

    def is_running(self) -> bool:
        """Return True if bridge is currently running.

        This is a convenience over the shutdown flag.
        """
        return not self.shutdown.is_set()

    async def close(self) -> None:
        """Perform cleanup tasks for the state container.

        acquire session lock and close session if available.
        """
        async with self.session_lock:
            if self.session is not None:
                try:
                    await self.session.close()  # type: ignore
                except Exception:
                    # Best-effort cleanup; don't raise on shutdown.
                    pass
                self.session = None
        self.tools.clear()
        self.connected.clear()
        self.tools_ready.clear()
        self.reconnect_needed.clear()
