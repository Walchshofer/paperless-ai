from bridge import config
from bridge.router import RequestRouter
from bridge.state import BridgeState


def test_connection_error_message_during_startup():
    state = BridgeState()
    state.reconnect_failures = 2
    router = RequestRouter(state)

    err = router._connection_error()
    assert "connection in progress" in err.error.message
    assert f"attempt {state.reconnect_failures}" in err.error.message


def test_connection_error_message_after_exhaustion():
    state = BridgeState()
    state.degraded.set()
    state.ever_connected = True
    router = RequestRouter(state)

    err = router._connection_error()
    assert "retries exhausted" in err.error.message
    assert str(config.MAX_RECONNECT_ATTEMPTS) in err.error.message