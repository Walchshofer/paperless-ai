import asyncio
import importlib.util
from pathlib import Path
import sys

# Load codex-serena-bridge module for tests
_spec_location = Path(__file__).resolve().parents[2] / "codex-serena-bridge.py"
spec = importlib.util.spec_from_file_location("codex_bridge", _spec_location)
bridge = importlib.util.module_from_spec(spec)
sys.modules["codex_bridge"] = bridge
spec.loader.exec_module(bridge)

from codex_bridge import classify_error, should_retry, RetryState, enrich_error, PermanentError


def test_classify_transient_timeout():
    assert classify_error(asyncio.TimeoutError()) == "transient"


def test_classify_transient_status():
    class E(Exception):
        status = 503

    assert classify_error(E()) == "transient"


def test_classify_permanent():
    assert classify_error(PermanentError("oops")) == "permanent"


def test_should_retry_counts_and_backoff():
    retry = RetryState()
    do, back = should_retry(asyncio.TimeoutError(), retry)
    assert do and back == 1.0
    retry.attempts = 1
    do, back = should_retry(asyncio.TimeoutError(), retry)
    assert do and back == 2.0
    retry.attempts = 2
    do, back = should_retry(asyncio.TimeoutError(), retry)
    assert do and back == 4.0
    retry.attempts = 3
    do, back = should_retry(asyncio.TimeoutError(), retry)
    assert not do


def test_enrich_error_timeout():
    e = asyncio.TimeoutError('xyz')
    enriched = enrich_error(e, {"id": 1})
    assert "Bridge timeout" in enriched["message"]
    assert enriched["data"]["context"]["id"] == 1
