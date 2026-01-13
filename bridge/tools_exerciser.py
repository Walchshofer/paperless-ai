#!/usr/bin/env python3
"""Ad-hoc script to exercise available Serena tools via the bridge components.

This script starts a ConnectionManager + RequestRouter (no STDIO server) and
requests the tool list, then attempts to call a small set of safe tools if
present (e.g., `get_current_config`, `list_memories`).

Usage:
  python bridge/tools_exerciser.py
"""
from __future__ import annotations

import asyncio
import os
import sys

import mcp.types as types

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.router import RequestRouter
from bridge.state import BridgeState


async def main() -> None:
    serena = os.getenv("SERENA_BASE", "http://127.0.0.1:9121")
    print(f"Using SERENA_BASE={serena}")

    state = BridgeState()
    orderer = ResponseOrderer()
    router = RequestRouter(state)
    manager = ConnectionManager(state, orderer)

    manager.start()
    try:
        print("Waiting for connection and tools...")
        await asyncio.wait_for(state.connected.wait(), timeout=30.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=30.0)

        tools_result = await router.forward("tools/list", {}, "tools-list")
        print("Tools discovered:")
        tools = getattr(tools_result, "tools", [])
        for t in tools:
            name = getattr(t, "name", None) or (t.get("name") if isinstance(t, dict) else None)
            print(" -", name)

        # Safe calls
        for candidate in ("get_current_config", "list_memories", "list_tools"):
            if any((getattr(t, "name", None) or (t.get("name") if isinstance(t, dict) else None)) == candidate for t in tools):
                print(f"Calling {candidate}...")
                try:
                    result = await router.forward("tools/call", {"name": candidate, "arguments": {}}, f"call-{candidate}")
                    print(candidate, "->", result)
                except Exception as exc:
                    print(f"{candidate} call failed: {exc}")

    finally:
        await manager.stop()


if __name__ == "__main__":
    asyncio.run(main())
