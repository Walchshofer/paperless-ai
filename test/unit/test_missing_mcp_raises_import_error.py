import importlib.util
import os
import sys
from pathlib import Path

# Ensure we do NOT set BRIDGE_TEST_STUBS so that missing mcp triggers ImportError
os.environ.pop("BRIDGE_TEST_STUBS", None)

_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge_missing_mcp", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge_missing_mcp"] = bridge

try:
    spec.loader.exec_module(bridge)
except ImportError as e:
    assert "The MCP SDK 'mcp' is not installed" in str(e)
else:
    # If we got here, the environment has an installed `mcp` package which is fine.
    pass
