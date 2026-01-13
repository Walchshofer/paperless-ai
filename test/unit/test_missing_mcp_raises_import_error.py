import importlib.util
import os
import sys
from pathlib import Path

os.environ.pop("BRIDGE_TEST_STUBS", None)

bridge_path = (
    Path(__file__).resolve().parents[2]
    / "bridge"
    / "codex-serena-bridge.py"
)

spec = importlib.util.spec_from_file_location(
    "codex_bridge_missing_mcp",
    bridge_path,
)
module = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge_missing_mcp"] = module

try:
    spec.loader.exec_module(module)
except ImportError:
    pass
else:
    pass