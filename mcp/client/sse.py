from __future__ import annotations

import asyncio
from typing import Any, AsyncGenerator


class _DummySSE:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        # acts as a context manager yielding a transport-like object
        await asyncio.sleep(0)
        return self

    async def __aexit__(self, exc_type, exc, tb):  # pragma: no cover - trivial
        return None


async def sse_client(*args, **kwargs) -> _DummySSE:
    """Stubbed SSE client context manager for tests."""
    return _DummySSE()
