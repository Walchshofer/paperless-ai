import asyncio
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

os.environ["BRIDGE_TEST_STUBS"] = "1"

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


async def main():
    state = BridgeState()
    manager = ConnectionManager(state, ResponseOrderer())
    manager.start()
    try:
        await asyncio.wait_for(state.tools_ready.wait(), timeout=1.0)
    finally:
        await manager.stop()
    print("connect_to_serena invocation completed")


if __name__ == "__main__":
    asyncio.run(main())