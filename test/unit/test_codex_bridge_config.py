import importlib.util
import sys
from pathlib import Path


BRIDGE_PATH = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"


def load_bridge(monkeypatch, tmp_path, envs=None):
    envs = envs or {}
    for key, value in envs.items():
        monkeypatch.setenv(key, str(value))
    monkeypatch.setenv(
        "CODEX_BRIDGE_LOG_FILE",
        str(tmp_path / "bridge_log.txt"),
    )
    module_name = "codex_bridge_tested"
    if module_name in sys.modules:
        del sys.modules[module_name]
    spec = importlib.util.spec_from_file_location(module_name, BRIDGE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_bridge_state_initialization(monkeypatch, tmp_path):
    bridge = load_bridge(monkeypatch, tmp_path)
    state = bridge.state
    assert state.session is None
    assert not state.connected.is_set()
    assert not state.tools_ready.is_set()
    assert state.tools == []
    assert not state.shutdown.is_set()
    assert not state.reconnect_needed.is_set()


def test_configuration_overrides(monkeypatch, tmp_path):
    bridge = load_bridge(
        monkeypatch,
        tmp_path,
        envs={
            "SERENA_SSE_URL": "http://example.com/sse",
            "SERENA_API_KEY": "secret",
            "LOG_LEVEL": "debug",
            "SSE_TIMEOUT": "5",
            "REQUEST_TIMEOUT": "7",
            "MAX_RECONNECT_ATTEMPTS": "3",
            "RECONNECT_BACKOFF_BASE": "4",
            "RECONNECT_BACKOFF_MAX": "9",
            "HEALTH_CHECK_INTERVAL": "2",
        },
    )

    assert bridge.SERENA_SSE_URL == "http://example.com/sse"
    assert bridge.SERENA_API_KEY == "secret"
    assert bridge.LOG_LEVEL == "DEBUG"
    assert bridge.TIMEOUTS["sse"] == 5
    assert bridge.TIMEOUTS["request"] == 7
    assert bridge.TIMEOUTS["health_check"] == 2
    assert bridge.RETRY_CONFIG["max_attempts"] == 3
    assert bridge.RETRY_CONFIG["backoff_base"] == 4
    assert bridge.RETRY_CONFIG["backoff_max"] == 9
