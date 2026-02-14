import logging
import sys

from bridge.codex_serena_bridge import (
    _IncompleteChunkedSSEFilter,
    _install_mcp_sse_log_filter,
)


def _record(message: str, exc: Exception) -> logging.LogRecord:
    try:
        raise exc
    except Exception:
        exc_info = sys.exc_info()
    return logging.LogRecord(
        name="mcp.client.sse",
        level=logging.ERROR,
        pathname=__file__,
        lineno=1,
        msg=message,
        args=(),
        exc_info=exc_info,
    )


def test_filter_suppresses_incomplete_chunked_read() -> None:
    record = _record(
        "Error in sse_reader",
        RuntimeError(
            "peer closed connection without sending complete message body "
            "(incomplete chunked read)"
        ),
    )
    assert _IncompleteChunkedSSEFilter().filter(record) is False


def test_filter_keeps_other_sse_reader_errors() -> None:
    record = _record("Error in sse_reader", RuntimeError("bad payload"))
    assert _IncompleteChunkedSSEFilter().filter(record) is True


def test_filter_keeps_other_messages() -> None:
    record = _record(
        "Error parsing server message",
        RuntimeError("incomplete chunked read"),
    )
    assert _IncompleteChunkedSSEFilter().filter(record) is True


def test_install_filter_is_idempotent() -> None:
    logger = logging.getLogger("mcp.client.sse")
    original = list(logger.filters)
    try:
        logger.filters = []
        _install_mcp_sse_log_filter()
        _install_mcp_sse_log_filter()
        count = sum(
            isinstance(item, _IncompleteChunkedSSEFilter)
            for item in logger.filters
        )
        assert count == 1
    finally:
        logger.filters = original
