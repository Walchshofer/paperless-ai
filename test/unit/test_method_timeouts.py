from bridge import config
from bridge.router import RequestRouter
from bridge.state import BridgeState


def test_method_timeouts_for_list_and_search():
    router = RequestRouter(BridgeState())

    list_timeout = router._select_timeout("resources/list", {})
    assert list_timeout == config.REQUEST_TIMEOUT_LIST

    search_timeout = router._select_timeout(
        "tools/call",
        {"name": "search_code"},
    )
    assert search_timeout == config.REQUEST_TIMEOUT_SEARCH

    default_timeout = router._select_timeout(
        "tools/call",
        {"name": "other"},
    )
    assert default_timeout == config.REQUEST_TIMEOUT_DEFAULT