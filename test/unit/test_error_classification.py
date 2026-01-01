import asyncio

from mcp.shared.exceptions import McpError
import mcp.types as types

from bridge.errors import (
    RetryState,
    classify_error,
    enrich_error,
    should_retry,
)


def test_classify_transient_timeout():
    assert classify_error(asyncio.TimeoutError()) == "transient"


def test_classify_transient_status():
    class E(Exception):
        status = 503

    assert classify_error(E()) == "transient"


def test_classify_permanent_mcp_error():
    err = McpError(
        types.ErrorData(
            code=types.INVALID_PARAMS,
            message="bad",
        )
    )
    assert classify_error(err) == "permanent"


def test_should_retry_counts_and_backoff():
    retry = RetryState()
    do_retry, backoff = should_retry(
        asyncio.TimeoutError(),
        retry,
        max_attempts=3,
        backoff_base=1.0,
        backoff_max=4.0,
    )
    assert do_retry and backoff == 1.0
    retry.attempts = 1
    do_retry, backoff = should_retry(
        asyncio.TimeoutError(),
        retry,
        max_attempts=3,
        backoff_base=1.0,
        backoff_max=4.0,
    )
    assert do_retry and backoff == 2.0
    retry.attempts = 2
    do_retry, backoff = should_retry(
        asyncio.TimeoutError(),
        retry,
        max_attempts=3,
        backoff_base=1.0,
        backoff_max=4.0,
    )
    assert do_retry and backoff == 4.0
    retry.attempts = 3
    do_retry, _backoff = should_retry(
        asyncio.TimeoutError(),
        retry,
        max_attempts=3,
        backoff_base=1.0,
        backoff_max=4.0,
    )
    assert not do_retry


def test_enrich_error_timeout():
    err = asyncio.TimeoutError("xyz")
    enriched = enrich_error(err, {"id": 1})
    assert "Bridge timeout" in enriched.message
    assert enriched.data["context"]["id"] == 1
