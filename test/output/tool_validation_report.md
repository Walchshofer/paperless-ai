# Serena Tool Validation Report (bridge)

Status: Automated coverage implemented; run with SERENA_E2E=1 to execute live.

## Summary
- Total tools: 28
- Positive execution: Covered via mock Serena in
  `test/e2e/test_all_serena_tools.py` calling all tools with
  RequestRouter.forward.
- Negative cases: Invalid parameters surface `McpError`; bridge remains
  connected.
- Timeout: Forced delay triggers timeout and surfaces error cleanly.
- Live (Serena): `SERENA_E2E` gate required; will fail if fewer than 28 tools
  are returned.

## Tool categories (28)
- File Ops: read_file, create_text_file, list_dir, find_file, replace_content
- Code Nav: search_for_pattern, get_symbols_overview, find_symbol,
  find_referencing_symbols, replace_symbol_body, insert_after_symbol,
  insert_before_symbol, rename_symbol
- Memory: write_memory, read_memory, list_memories, delete_memory, edit_memory
- Project: activate_project, switch_modes, get_current_config
- Onboarding: check_onboarding_performed, onboarding
- Thinking: think_about_collected_information, think_about_task_adherence,
  think_about_whether_you_are_done, prepare_for_new_conversation
- Instructions: initial_instructions

## How to run
```bash
# Live Serena (requires SERENA_BASE and tools available)
SERENA_E2E=1 .venv/Scripts/python -m pytest test/e2e/test_all_serena_tools.py

# Mock-only (always runs when SERENA_E2E=1, uses mock for execution safety)
SERENA_E2E=1 .venv/Scripts/python -m pytest test/e2e/test_all_serena_tools.py
```

## Expected outcomes
- All 28 tool calls return without error (mock).
- Invalid parameter call raises `McpError`; bridge remains connected.
- Timeout scenario raises `McpError` with timeout surfaced.
- Live run fails if tool count != 28 or if Serena rejects calls.
