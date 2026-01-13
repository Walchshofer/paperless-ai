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
    print("Starting connector task (max_attempts=3) and waiting for connected event...")
    t = asyncio.create_task(bridge.connect_to_serena(max_attempts=3))
    try:
        await asyncio.wait_for(bridge.state.connected.wait(), timeout=10.0)
        print("Connected to Serena. Tools fetched:", bridge.state.tools)
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
