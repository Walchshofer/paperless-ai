import asyncio
import os

import pytest

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.router import RequestRouter
from bridge.state import BridgeState


pytestmark = pytest.mark.skipif(
    not os.environ.get("SERENA_E2E"),
    reason="SERENA_E2E not set - skipping E2E tests",
)

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
async def test_serena_discover_and_call_tool():
    """End-to-end test for real Serena tools/list and tools/call."""
    assert os.environ.get("SERENA_BASE"), "SERENA_BASE must be set"

    state = BridgeState()
    orderer = ResponseOrderer()
    router = RequestRouter(state)
    manager = ConnectionManager(state, orderer)

    manager.start()
    try:
        await asyncio.wait_for(state.connected.wait(), timeout=30.0)
        await asyncio.wait_for(state.tools_ready.wait(), timeout=30.0)

        tools_result = await router.forward(
            "tools/list",
            {},
            "e2e-tools-list",
        )
        assert tools_result is not None

        tools = getattr(tools_result, "tools", [])
        tool_names = []
        for tool in tools:
            name = getattr(tool, "name", None)
            if not name and isinstance(tool, dict):
                name = tool.get("name")
            if name:
                tool_names.append(name)

        assert len(tool_names) == 28
        for expected in EXPECTED_TOOL_NAMES:
            assert expected in tool_names

        call_result = await router.forward(
            "tools/call",
            {"name": "get_current_config", "arguments": {}},
            "e2e-call",
        )
        assert call_result is not None
    finally:
        await manager.stop()
