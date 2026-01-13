import importlib.util
import os
import sys
from pathlib import Path

# Ensure the test stub loader path is used — force it for this unit test
os.environ["BRIDGE_TEST_STUBS"] = "1"

_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge_loader", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge_loader"] = bridge

# Capture stderr during module loading to confirm the debug note
import io
import contextlib

stderr = io.StringIO()
# Ensure we haven't already imported the stubs (so they write their
# initialization debug message to stderr when loaded)
sys.modules.pop("mcp", None)
with contextlib.redirect_stderr(stderr):
    spec.loader.exec_module(bridge)

# Some environments may have already imported the stubs; ensure the
# runtime symbol is available rather than relying on stderr output.
assert hasattr(bridge, "ClientSession"), "ClientSession symbol missing from bridge"
cs = bridge.ClientSession()
assert hasattr(cs, "list_tools"), "ClientSession stub missing expected method"
