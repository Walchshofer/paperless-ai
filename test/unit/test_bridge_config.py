import importlib

import bridge.config as cfg


def test_default_config_values():
    assert isinstance(cfg.SERENA_SSE_URL, str)
    assert isinstance(cfg.SERENA_API_KEY, str)
    assert isinstance(cfg.LOG_LEVEL, str)
    assert "tools/call" in cfg.TIMEOUT_POLICY
    assert "_default" in cfg.TIMEOUT_POLICY["tools/call"]
    assert isinstance(cfg.RETRY_MAX_ATTEMPTS, int)


def test_env_overrides(monkeypatch, tmp_path):
    monkeypatch.setenv("SERENA_SSE_URL", "https://example.test/sse")
    monkeypatch.setenv("SERENA_API_KEY", "secret")
    monkeypatch.setenv("LOG_LEVEL", "debug")
    monkeypatch.setenv("REQUEST_TIMEOUT_DEFAULT", "70")
    monkeypatch.setenv("REQUEST_TIMEOUT_SEARCH", "130")
    monkeypatch.setenv("CODEX_BRIDGE_LOG_FILE", str(tmp_path / "bridge.log"))
    monkeypatch.setenv("RETRY_MAX_ATTEMPTS", "5")

    importlib.reload(cfg)

    assert cfg.SERENA_SSE_URL == "https://example.test/sse"
    assert cfg.SERENA_API_KEY == "secret"
    assert cfg.LOG_LEVEL == "DEBUG"
    assert cfg.REQUEST_TIMEOUT_DEFAULT == 70.0
    assert cfg.REQUEST_TIMEOUT_SEARCH == 130.0
    assert cfg.LOG_FILE == str(tmp_path / "bridge.log")
    assert cfg.RETRY_MAX_ATTEMPTS == 5