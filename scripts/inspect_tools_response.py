import os
import sys
import importlib.util
import asyncio
from pathlib import Path

# Ensure we are NOT using test stubs
os.environ.pop("BRIDGE_TEST_STUBS", None)
# Optionally override SERENA_BASE via env if needed
# os.environ['SERENA_BASE'] = 'http://127.0.0.1:9121'

_spec_location = Path(__file__).resolve().parents[1] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge_real", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge_real"] = bridge

print("Loading codex-serena-bridge (real MCP) module...")
spec.loader.exec_module(bridge)

async def main():
    print(f"Using SERENA_SSE_URL={bridge.SERENA_SSE_URL}")
    t = asyncio.create_task(bridge.connect_to_serena(max_attempts=3))
    try:
        await asyncio.wait_for(bridge.state.connected.wait(), timeout=10.0)
        print("Connected to Serena. bridge.state.tools:", bridge.state.tools)
        # Call session.list_tools directly and print raw result
        async with bridge.state.session_lock:
            sess = bridge.state.session
        if sess is None:
            print("No session available to list tools")
            return
        try:
            raw = await asyncio.wait_for(sess.list_tools(), 10.0)
        except Exception as e:
            print("session.list_tools() raised:", repr(e))
            return
        print("Raw list_tools() response repr:", repr(raw))
        try:
            tools_attr = getattr(raw, 'tools', None)
            print("raw.tools attr:", tools_attr)
        except Exception as e:
            print("getting raw.tools raised:", repr(e))
        try:
            get_tools = raw.get('tools') if isinstance(raw, dict) else None
            print("raw.get('tools'):", get_tools)
        except Exception as e:
            print("raw.get('tools') raised:", repr(e))
    except asyncio.TimeoutError:
        print("Timeout waiting for connection to Serena. Check SERENA_BASE and network.")
    finally:
        bridge.state.shutdown.set()
        t.cancel()
        try:
            await t
        except Exception:
            pass

if __name__ == '__main__':
    asyncio.run(main())
