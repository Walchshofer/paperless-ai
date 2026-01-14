# Serena Tools Reference (28 tools)

This reference summarizes the Serena MCP tools exposed through the
`codex-serena` bridge and how to verify discovery from CODEX.

## Tool list (by category)

- **File Operations (5)**: `read_file`, `create_text_file`, `list_dir`,
  `find_file`, `replace_content`
- **Code Navigation (8)**: `search_for_pattern`, `get_symbols_overview`,
  `find_symbol`, `find_referencing_symbols`, `replace_symbol_body`,
  `insert_after_symbol`, `insert_before_symbol`, `rename_symbol`
- **Memory Operations (5)**: `write_memory`, `read_memory`,
  `list_memories`, `delete_memory`, `edit_memory`
- **Project Management (3)**: `activate_project`, `switch_modes`,
  `get_current_config`
- **Onboarding (2)**: `check_onboarding_performed`, `onboarding`
- **Thinking/Reflection (4)**: `think_about_collected_information`,
  `think_about_task_adherence`, `think_about_whether_you_are_done`,
  `prepare_for_new_conversation`
- **Instructions (1)**: `initial_instructions`

Expected total: **28 tools**.

## Quick verification paths

### 1) SSE path (no CODEX needed)

```powershell
# Uses live Serena via ConnectionManager
set EXPECTED_TOOL_COUNT=28
.venv\Scripts\python bridge\testscripts\check_tool_count.py
```

Expected output: `tool_count=28` and tool_names listing the set above.

### 2) STDIO path (CODEX-like)

```powershell
'{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' |
  .venv\Scripts\python bridge\codex-serena-bridge.py
```

Expected: JSON-RPC response containing 28 tool definitions.

### 3) CODEX UI

- Open MCP servers panel, filter for `codex-serena`.
- Count tools; expect 28. Schemas should show required params:
  - `search_for_pattern`: `query`
  - `read_file`: `path`
  - `write_memory`: `key`, `value`

## Diagnostics

- `bridge_debug.log` should include:
  - `Fetched 28 tools: ...`
  - `tools/list` requests when CODEX queries tools
- If count is not 28, ensure Serena is reachable and LOG_LEVEL=DEBUG during
  bridge startup to capture STDIO lifecycle logs.
