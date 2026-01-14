import importlib.util
import sys
from pathlib import Path


_SPEC_PATH = (
    Path(__file__).resolve().parents[2]
    / "bridge"
    / "testscripts"
    / "test_stdin_lifecycle.py"
)
spec = importlib.util.spec_from_file_location("stdin_lifecycle", _SPEC_PATH)
module = importlib.util.module_from_spec(spec)
sys.modules["stdin_lifecycle"] = module
spec.loader.exec_module(module)

DiagnosticResult = module.DiagnosticResult
classify_scenario = module.classify_scenario


def test_classify_stdin_closed():
    result = DiagnosticResult(stdin_closed=True)
    assert classify_scenario(result) == "A"


def test_classify_server_task_done():
    result = DiagnosticResult(stdin_closed=False, server_task_done=True)
    assert classify_scenario(result) == "C"


def test_classify_stdio_exits():
    result = DiagnosticResult(stdin_closed=False, stdio_duration_s=0.01)
    assert classify_scenario(result) == "B"


def test_classify_unknown():
    result = DiagnosticResult(stdin_closed=False, stdio_duration_s=1.0)
    assert classify_scenario(result) == "unknown"
