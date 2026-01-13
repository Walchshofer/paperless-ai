"""Bridge configuration sourced from environment variables."""
from __future__ import annotations

import os
from typing import Any, Dict


SERENA_BASE = os.getenv("SERENA_BASE", "http://127.0.0.1:9121")
SERENA_SSE_URL = os.getenv("SERENA_SSE_URL", f"{SERENA_BASE}/sse")
SERENA_API_KEY = os.getenv("SERENA_API_KEY", "")

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

PROJECT_DIR = os.getenv(
    "PROJECT_DIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir)),
)

LOG_FILE = os.getenv("CODEX_BRIDGE_LOG_FILE")
if not LOG_FILE:
    LOG_FILE = os.getenv("LOG_FILE")
if not LOG_FILE:
    LOG_FILE = os.path.join(PROJECT_DIR, "bridge_debug.log")

SSE_TIMEOUT = float(os.getenv("SSE_TIMEOUT", "30"))
SSE_READ_TIMEOUT = float(os.getenv("SSE_READ_TIMEOUT", "300"))

REQUEST_TIMEOUT_DEFAULT = float(
    os.getenv("REQUEST_TIMEOUT_DEFAULT", os.getenv("REQUEST_TIMEOUT", "60"))
)
REQUEST_TIMEOUT_SEARCH = float(os.getenv("REQUEST_TIMEOUT_SEARCH", "120"))
REQUEST_TIMEOUT_LIST = float(os.getenv("REQUEST_TIMEOUT_LIST", "30"))
REQUEST_TIMEOUT_INIT = float(os.getenv("REQUEST_TIMEOUT_INIT", "10"))
REQUEST_TIMEOUT_READ = float(os.getenv("REQUEST_TIMEOUT_READ", "60"))

MAX_RECONNECT_ATTEMPTS = int(os.getenv("MAX_RECONNECT_ATTEMPTS", "10"))
RECONNECT_BACKOFF_BASE = float(os.getenv("RECONNECT_BACKOFF_BASE", "2"))
RECONNECT_BACKOFF_MAX = float(os.getenv("RECONNECT_BACKOFF_MAX", "30"))
HEALTH_CHECK_INTERVAL = float(os.getenv("HEALTH_CHECK_INTERVAL", "15"))

RETRY_MAX_ATTEMPTS = int(os.getenv("RETRY_MAX_ATTEMPTS", "3"))
RETRY_BACKOFF_BASE = float(os.getenv("RETRY_BACKOFF_BASE", "1"))
RETRY_BACKOFF_MAX = float(os.getenv("RETRY_BACKOFF_MAX", "4"))

TIMEOUT_POLICY: Dict[str, Any] = {
    "initialize": REQUEST_TIMEOUT_INIT,
    "tools/list": REQUEST_TIMEOUT_LIST,
    "resources/list": REQUEST_TIMEOUT_LIST,
    "prompts/list": REQUEST_TIMEOUT_LIST,
    "tools/call": {
        "_default": REQUEST_TIMEOUT_DEFAULT,
        "search_code": REQUEST_TIMEOUT_SEARCH,
        "semantic_search": REQUEST_TIMEOUT_SEARCH,
    },
    "resources/read": REQUEST_TIMEOUT_READ,
    "prompts/get": REQUEST_TIMEOUT_READ,
}

# Allow a short, configurable grace period to keep STDIO alive and await
# initial server startup/handshake. Default 0 disables this behavior.
STDIO_INITIALIZE_GRACE_SECS = float(os.getenv("STDIO_INITIALIZE_GRACE_SECS", "0"))

# Optional timeout to wait for the MCP initialize handshake to arrive from CODEX
# (seconds). Set to >0 to require an explicit initialize message before proceeding.
STDIO_INITIALIZE_TIMEOUT_SECS = float(os.getenv("STDIO_INITIALIZE_TIMEOUT_SECS", "0"))
