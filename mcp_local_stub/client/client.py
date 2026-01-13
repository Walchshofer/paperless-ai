from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional


class ClientSession:
    """A very small test stub for the MCP ClientSession.

    Provides the methods exercised by the bridge tests: `initialize`,
    `list_tools`, `call_tool`, `read_resource` and `list_resources`.
    """

    def __init__(self, transport: Optional[Any] = None) -> None:
        self.transport = transport

    async def __aenter__(self) -> "ClientSession":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - trivial
        return None

    async def initialize(self, *args, **kwargs) -> None:
        # No-op for tests
        await asyncio.sleep(0)

    async def list_tools(self) -> Dict[str, Any]:
        return {"tools": []}

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        await asyncio.sleep(0)
        return {"name": name, "arguments": arguments}

    async def read_resource(self, uri: str) -> Any:
        await asyncio.sleep(0)
        return {"uri": uri}

    async def list_resources(self) -> Any:
        await asyncio.sleep(0)
        return []
