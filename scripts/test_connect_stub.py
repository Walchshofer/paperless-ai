import os
import sys
import importlib.util
import asyncio

os.environ['BRIDGE_TEST_STUBS'] = '1'
spec = importlib.util.spec_from_file_location('codex_bridge', 'codex-serena-bridge.py')
bridge = importlib.util.module_from_spec(spec)
sys.modules['codex_bridge'] = bridge
spec.loader.exec_module(bridge)

# Run connect_to_serena for a single attempt and then stop
asyncio.run(bridge.connect_to_serena(max_attempts=1))
print('connect_to_serena invocation completed')
