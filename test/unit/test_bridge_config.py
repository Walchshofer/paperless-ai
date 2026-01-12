import importlib
import os

import services.bridge.config as cfg


def test_default_config_values():
    # Defaults should be present and of expected type
    assert isinstance(cfg.SERENA_SSE_URL, str)
    assert isinstance(cfg.SERENA_API_KEY, str)
    assert isinstance(cfg.LOG_LEVEL, str)
    assert "default" in cfg.TIMEOUT_POLICY
    assert isinstance(cfg.RETRY_CONFIG.get("max_attempts"), int)


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("SERENA_SSE_URL", "https://example.test/sse")
    monkeypatch.setenv("SERENA_API_KEY", "secret")
    monkeypatch.setenv("LOG_LEVEL", "debug")
    monkeypatch.setenv("BRIDGE_MAX_RETRIES", "5")

    # Reload the module to re-evaluate env-based values
    importlib.reload(cfg)

    assert cfg.SERENA_SSE_URL == "https://example.test/sse"
    assert cfg.SERENA_API_KEY == "secret"
    assert cfg.LOG_LEVEL.upper() == "DEBUG"
    assert cfg.RETRY_CONFIG["max_attempts"] == 5
