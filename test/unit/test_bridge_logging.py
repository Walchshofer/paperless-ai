from __future__ import annotations

import builtins
import io

import bridge.logging as bridge_logging


class DummyHandle:
    def __init__(self) -> None:
        self.written: list[str] = []
        self.flushed = False

    def write(self, data: str) -> None:
        self.written.append(data)

    def flush(self) -> None:
        self.flushed = True

    def __enter__(self) -> "DummyHandle":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False


def test_log_flushes_file(monkeypatch) -> None:
    handle = DummyHandle()
    buffer = io.StringIO()
    monkeypatch.setattr(bridge_logging, "LOG_FILE", "dummy.log")
    monkeypatch.setattr(bridge_logging, "LOG_LEVEL", "DEBUG")
    monkeypatch.setattr(builtins, "open", lambda *_a, **_k: handle)
    monkeypatch.setattr(bridge_logging.sys, "stderr", buffer)

    bridge_logging.log("hello", level="INFO")

    assert handle.written
    assert handle.flushed
