import os
from typing import Dict, Any


# Environment-configured constants with sane defaults
SERENA_SSE_URL: str = os.getenv(
    "SERENA_SSE_URL", "https://serena.example/api/sse"
)
SERENA_API_KEY: str = os.getenv("SERENA_API_KEY", "")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()

# Timeout policy: per-operation nested mapping
TIMEOUT_POLICY: Dict[str, Dict[str, Any]] = {
    "default": {"timeout_ms": 5000, "retries": 1},
    "sse": {"timeout_ms": 30000, "retries": 0},
}

# Retry configuration
RETRY_CONFIG: Dict[str, Any] = {
    "max_attempts": int(os.getenv("BRIDGE_MAX_RETRIES", "3")),
    "backoff_ms": int(os.getenv("BRIDGE_RETRY_BACKOFF_MS", "100")),
}
