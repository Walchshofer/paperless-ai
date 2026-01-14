#!/usr/bin/env python3
"""
Check tool count from Serena via ConnectionManager (SSE path).
"""

import asyncio
import os
import sys
# Add repo root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


async def main():
    expected = int(os.environ.get("EXPECTED_TOOL_COUNT", "0"))
    state = BridgeState()
    orderer = ResponseOrderer()
    manager = ConnectionManager(state, orderer)
    
    print("Connecting to Serena...")
    manager.start()
    
    try:
        await asyncio.wait_for(state.tools_ready.wait(), timeout=10.0)
        count = len(state.tools)
        print(f"tool_count={count}")
        
        tool_names = []
        for t in state.tools:
            name = getattr(t, "name", None) or (t.get("name") if isinstance(t, dict) else None)
            if name:
                tool_names.append(name)
        print(f"tool_names={tool_names}")
        
        if expected > 0:
            if count == expected:
                print("PASS: Tool count matches expected.")
            else:
                print(f"FAIL: Expected {expected}, got {count}.")
                sys.exit(1)
    except asyncio.TimeoutError:
        print("FAIL: Timeout waiting for tools.")
        sys.exit(1)
    finally:
        await manager.stop()

if __name__ == "__main__":
    asyncio.run(main())