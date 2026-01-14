import pytest

import mcp.types as types

from bridge.router import RequestRouter
from bridge.state import BridgeState

EXPECTED_TOOL_NAMES = [
    "read_file",
    "create_text_file",
    "list_dir",
    "find_file",
    "replace_content",
    "search_for_pattern",
    "get_symbols_overview",
    "find_symbol",
    "find_referencing_symbols",
    "replace_symbol_body",
    "insert_after_symbol",
    "insert_before_symbol",
    "rename_symbol",
    "write_memory",
    "read_memory",
    "list_memories",
    "delete_memory",
    "edit_memory",
    "activate_project",
    "switch_modes",
    "get_current_config",
    "check_onboarding_performed",
    "onboarding",
    "think_about_collected_information",
    "think_about_task_adherence",
    "think_about_whether_you_are_done",
    "prepare_for_new_conversation",
    "initial_instructions",
]


@pytest.mark.asyncio
async def test_tools_list_uses_cached_tools():
    state = BridgeState()
    state.connected.set()
    async with state.session_lock:
        state.session = object()
    state.tools = [
        types.Tool(
            name="search_code",
            description="test",
            inputSchema={},
        )
    ]
    state.tools_ready.set()

    router = RequestRouter(state)
    result = await router.forward("tools/list", {}, "id-1")

    assert isinstance(result, types.ListToolsResult)
    assert result.tools[0].name == "search_code"


@pytest.mark.asyncio
async def test_tools_list_returns_expected_serena_set():
    state = BridgeState()
    state.connected.set()
    async with state.session_lock:
        state.session = object()
    state.tools = [
        types.Tool(
            name=name,
            description="mock",
            inputSchema={},
        )
        for name in EXPECTED_TOOL_NAMES
    ]
    state.tools_ready.set()

    router = RequestRouter(state)
    result = await router.forward("tools/list", {}, "id-2")

    assert isinstance(result, types.ListToolsResult)
    tool_names = [tool.name for tool in result.tools]
    assert len(tool_names) == 28
    for expected in EXPECTED_TOOL_NAMES:
        assert expected in tool_names
