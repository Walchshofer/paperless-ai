"""
Lightweight tag-generation metrics.
Passive: log events and keep a small in-memory history.
"""
from collections import deque
from datetime import datetime, timezone
import logging
from threading import Lock
from typing import Any, Dict, List, Optional

from metrics.tag_statistics import record_tag_stats

_LOGGER = logging.getLogger("guidance.tag_metrics")
_MAX_EVENTS = 1000
_TAG_EVENTS: deque = deque(maxlen=_MAX_EVENTS)
_LOCK = Lock()


def _normalize_tag_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        items = value
    elif isinstance(value, tuple):
        items = list(value)
    elif isinstance(value, str):
        items = [value]
    else:
        items = [str(value)]

    cleaned: List[str] = []
    for item in items:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            cleaned.append(text)
    return cleaned


def extract_tag_lists(payload: Any) -> Dict[str, List[str]]:
    if not isinstance(payload, dict):
        return {"suggested_tags": [], "missing_tags": []}
    return {
        "suggested_tags": _normalize_tag_list(payload.get("suggested_tags")),
        "missing_tags": _normalize_tag_list(payload.get("missing_tags")),
    }


def record_tag_generation(
    template: str,
    domain: str,
    json_valid: Optional[bool],
    latency_seconds: Optional[float],
    suggested_tags: Optional[List[str]] = None,
    missing_tags: Optional[List[str]] = None,
    logger: Optional[logging.Logger] = None,
) -> Dict[str, Any]:
    event = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "template": template,
        "domain": domain,
        "json_valid": json_valid,
        "latency_seconds": latency_seconds,
        "suggested_tags": suggested_tags or [],
        "missing_tags": missing_tags or [],
    }

    with _LOCK:
        _TAG_EVENTS.append(event)

    target_logger = logger or _LOGGER
    try:
        target_logger.info("tag_metrics", extra={"tag_metrics": event})
    except Exception:
        pass

    record_tag_stats(
        domain=domain,
        suggested_tags=event["suggested_tags"],
        missing_tags=event["missing_tags"],
    )

    return event


def get_recent_tag_events(limit: int = 100) -> List[Dict[str, Any]]:
    if limit <= 0:
        return []
    with _LOCK:
        return list(_TAG_EVENTS)[-limit:]


def reset_tag_events() -> None:
    with _LOCK:
        _TAG_EVENTS.clear()
