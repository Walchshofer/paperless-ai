import asyncio
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState

# Ensure we are NOT using test stubs
os.environ.pop("BRIDGE_TEST_STUBS", None)


async def main():
    state = BridgeState()
    manager = ConnectionManager(state, ResponseOrderer())

    print(f"Using SERENA_SSE_URL={os.environ.get('SERENA_SSE_URL')}")
    print("Starting connector task and waiting for connection...")
    manager.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=10.0)
        print("Connected to Serena. Tools fetched:", state.tools)
    except asyncio.TimeoutError:
        print("Timeout waiting for connection to Serena.")
    finally:
        await manager.stop()


if __name__ == "__main__":
    asyncio.run(main())