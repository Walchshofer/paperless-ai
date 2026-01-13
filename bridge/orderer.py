"""Ordered response delivery for pipelined requests."""
from __future__ import annotations

import asyncio
from typing import Dict


class ResponseOrderer:
    """Track request ordering and serialize response delivery."""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._condition = asyncio.Condition(self._lock)
        self._sequence = 0
        self._next_to_send = 0
        self._generation = 0
        self._in_flight: Dict[int, None] = {}

    async def register(self) -> tuple[int, int]:
        """Register a request and return (generation, sequence)."""
        async with self._lock:
            seq = self._sequence
            self._sequence += 1
            self._in_flight[seq] = None
            return self._generation, seq

    async def wait_turn(self, token: tuple[int, int]) -> None:
        """Block until it's this request's turn to respond."""
        gen, seq = token
        async with self._condition:
            while seq != self._next_to_send:
                if gen != self._generation:
                    return
                await self._condition.wait()
            self._next_to_send += 1
            self._in_flight.pop(seq, None)
            self._condition.notify_all()

    async def reset(self) -> None:
        """Reset ordering state after a disconnect."""
        async with self._condition:
            self._generation += 1
            self._sequence = 0
            self._next_to_send = 0
            self._in_flight.clear()
            self._condition.notify_all()
