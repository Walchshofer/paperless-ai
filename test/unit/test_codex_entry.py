from importlib.machinery import SourceFileLoader
from importlib.util import spec_from_loader, module_from_spec
import os


def _load_entry_module():
    loader = SourceFileLoader("codex_entry", "bridge/codex-serena-bridge.py")
    spec = spec_from_loader(loader.name, loader)
    mod = module_from_spec(spec)
    loader.exec_module(mod)
    return mod


def test_apply_cli_env_sets_env(tmp_path, monkeypatch):
    monkeypatch.delenv("LOG_LEVEL", raising=False)
    monkeypatch.delenv("CODEX_BRIDGE_LOG_FILE", raising=False)
    mod = _load_entry_module()

    mod._apply_cli_env(["bridge", "--log-level", "debug", "--log-file", str(tmp_path / "b.log")])

    assert os.environ.get("LOG_LEVEL") == "DEBUG"
    assert os.environ.get("CODEX_BRIDGE_LOG_FILE") == str(tmp_path / "b.log")


def test_print_env_writes_to_stderr(monkeypatch, capsys):
    mod = _load_entry_module()
    # ensure some environment values exist
    monkeypatch.setenv("LOG_LEVEL", "INFO")
    mod._apply_cli_env(["bridge", "--print-env"])  # should write to stderr
    captured = capsys.readouterr()
    assert "LOG_LEVEL=" in captured.err