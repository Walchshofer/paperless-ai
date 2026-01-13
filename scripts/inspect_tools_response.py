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


def _print_tools(raw):
    try:
        tools_attr = getattr(raw, "tools", None)
        print("raw.tools attr:", tools_attr)
    except Exception as exc:
        print("getting raw.tools raised:", repr(exc))
    try:
        tools_list = raw.get("tools") if isinstance(raw, dict) else None
        print("raw.get('tools'):", tools_list)
    except Exception as exc:
        print("raw.get('tools') raised:", repr(exc))


async def main():
    state = BridgeState()
    manager = ConnectionManager(state, ResponseOrderer())

    print(f"Using SERENA_SSE_URL={os.environ.get('SERENA_SSE_URL')}")
    manager.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=10.0)
        print("Connected to Serena. bridge.state.tools:", state.tools)
        async with state.session_lock:
            sess = state.session
        if sess is None:
            print("No session available to list tools")
            return
        try:
            raw = await asyncio.wait_for(sess.list_tools(), 10.0)
        except Exception as exc:
            print("session.list_tools() raised:", repr(exc))
            return
        print("Raw list_tools() response repr:", repr(raw))
        _print_tools(raw)
    except asyncio.TimeoutError:
        print("Timeout waiting for connection to Serena.")
    finally:
        await manager.stop()


if __name__ == "__main__":
    asyncio.run(main())