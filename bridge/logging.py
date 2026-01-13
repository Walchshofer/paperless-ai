"""Bridge logging utilities (stderr only)."""
from __future__ import annotations

import sys
from datetime import datetime
from typing import Optional

from .config import LOG_FILE, LOG_LEVEL


LEVELS = {"DEBUG": 10, "INFO": 20, "WARN": 30, "ERROR": 40}


def _normalize_level(level: Optional[str]) -> str:
    value = (level or "INFO").upper()
    return value if value in LEVELS else "INFO"


def log(
    message: str,
    level: str = "INFO",
    *,
    min_level: Optional[str] = None,
) -> None:
    """Write a log message to stderr (and log file if configured)."""
    level_name = _normalize_level(level)
    effective = _normalize_level(min_level or LOG_LEVEL)
    if LEVELS.get(level_name, 0) < LEVELS.get(effective, 0):
        return
    timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
    entry = f"{timestamp} [CODEX-BRIDGE] [{level_name}] {message}\n"
    sys.stderr.write(entry)
    sys.stderr.flush()
    if LOG_FILE:
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as handle:
                handle.write(entry)
        except Exception:
            # Never crash on logging failures.
            pass
