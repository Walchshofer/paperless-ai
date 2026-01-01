"""Error classification and enrichment for bridge operations."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Optional, Tuple

try:
    import httpx
except Exception:  # pragma: no cover - optional dependency
    httpx = None  # type: ignore

from mcp.shared.exceptions import McpError
import mcp.types as types


TRANSIENT_STATUS = {429, 503}
PERMANENT_STATUS = {400, 404}


@dataclass
class RetryState:
    attempts: int = 0
    last_error: Optional[Exception] = None


def _extract_status(exc: Exception) -> Optional[int]:
    status = getattr(exc, "status", None)
    if isinstance(status, int):
        return status
    response = getattr(exc, "response", None)
    if response is not None:
        status = getattr(response, "status_code", None)
        if isinstance(status, int):
            return status
        status = getattr(response, "status", None)
        if isinstance(status, int):
            return status
    return None


def classify_error(exc: Exception) -> str:
    """Return 'transient' or 'permanent' for retry decisions."""
    if isinstance(exc, asyncio.TimeoutError):
        return "transient"
    if httpx is not None:
        if isinstance(exc, httpx.TimeoutException):
            return "transient"
        if isinstance(exc, httpx.TransportError):
            return "transient"
    if isinstance(exc, ConnectionError):
        return "transient"
    if isinstance(exc, McpError):
        return "permanent"
    status = _extract_status(exc)
    if status in TRANSIENT_STATUS:
        return "transient"
    if status in PERMANENT_STATUS:
        return "permanent"
    return "permanent"


def is_connection_error(exc: Exception) -> bool:
    """Return True when the error indicates a connection drop."""
    if isinstance(exc, ConnectionError):
        return True
    if httpx is not None and isinstance(exc, httpx.TransportError):
        return True
    return False


def should_retry(
    exc: Exception,
    retry_state: RetryState,
    *,
    max_attempts: int,
    backoff_base: float,
    backoff_max: float,
) -> Tuple[bool, float]:
    """Return (should_retry, backoff_seconds) for the given error."""
    if classify_error(exc) != "transient":
        return False, 0.0
    if retry_state.attempts >= max_attempts:
        return False, 0.0
    backoff = backoff_base * (2 ** retry_state.attempts)
    return True, min(backoff, backoff_max)


def enrich_error(exc: Exception, context: dict[str, Any]) -> types.ErrorData:
    """Create ErrorData with bridge context for a failure."""
    if isinstance(exc, McpError):
        message = f"Serena error: {exc.error.message}"
        data = {"original_error": exc.error.model_dump()}
        return types.ErrorData(
            code=exc.error.code,
            message=message,
            data={"context": context, **data},
        )
    if isinstance(exc, asyncio.TimeoutError):
        timeout = context.get("timeout")
        method = context.get("method")
        tool = context.get("tool")
        target = tool or method or "request"
        message = (
            f"Bridge timeout after {timeout}s waiting for Serena response "
            f"to '{target}'"
        )
        return types.ErrorData(
            code=types.INTERNAL_ERROR,
            message=message,
            data={"context": context},
        )
    status = _extract_status(exc)
    if status is not None:
        message = f"Network error communicating with Serena: HTTP {status}"
    else:
        message = f"Network error communicating with Serena: {exc}"
    return types.ErrorData(
        code=types.INTERNAL_ERROR,
        message=message,
        data={"context": context},
    )
