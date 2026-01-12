import sys
from datetime import datetime
from typing import Iterable


LEVELS = {
    "DEBUG": 10,
    "INFO": 20,
    "WARN": 30,
    "ERROR": 40,
}


def _now_timestamp() -> str:
    """Return an RFC3339-like timestamp for logs."""
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def log(message: str, level: str = "INFO", *, min_level: str = "INFO") -> None:
    """Write a log message to stderr only with level filtering.

    This avoids stdout pollution required by the spec.
    """
    if LEVELS.get(level, 0) < LEVELS.get(min_level, 0):
        return
    ts = _now_timestamp()
    # Short, single-line log entries to stderr
    out = f"{ts} [{level}] {message}\n"
    sys.stderr.write(out)


def set_level_from_env(env_level: str) -> str:
    """Return a normalized log level from an environment value."""
    lvl = (env_level or "").upper()
    return lvl if lvl in LEVELS else "INFO"
