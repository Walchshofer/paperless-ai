"""MCP client stubs for test fixtures.

These are intended for use from tests only (import explicitly from
`test/fixtures`) and are not on the runtime import path used in
production.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, Optional, Tuple


class ClientSession:
    """A small test stub for the MCP ClientSession used in tests."""

    def __init__(
        self,
        read_stream: Optional[Any] = None,
        write_stream: Optional[Any] = None,
    ) -> None:
        self.read_stream = read_stream
        self.write_stream = write_stream

    async def __aenter__(self) -> "ClientSession":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover
        return None

    async def initialize(self, *args, **kwargs) -> None:
        await asyncio.sleep(0)

    async def list_tools(self, cursor: Optional[str] = None) -> Dict[str, Any]:
        await asyncio.sleep(0)
        return {"tools": []}

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        await asyncio.sleep(0)
        return {"name": name, "arguments": arguments}

    async def read_resource(self, uri: str) -> Any:
        await asyncio.sleep(0)
        return {"contents": [{"text": uri, "mimeType": "text/plain"}]}

    async def list_resources(
        self,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        await asyncio.sleep(0)
        return {"resources": []}

    async def list_prompts(
        self,
        cursor: Optional[str] = None,
    ) -> Dict[str, Any]:
        await asyncio.sleep(0)
        return {"prompts": []}

    async def get_prompt(
        self,
        name: str,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        await asyncio.sleep(0)
        return {"name": name, "arguments": arguments or {}}


class _DummySSE:
    def __init__(self, streams: Optional[Tuple[Any, Any]] = None) -> None:
        self._streams = streams or (object(), object())

    async def __aenter__(self) -> Tuple[Any, Any]:
        await asyncio.sleep(0)
        return self._streams

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover
        return None


def sse_client(*args, **kwargs) -> _DummySSE:
    """Stubbed SSE client context manager for tests."""
    return _DummySSE()