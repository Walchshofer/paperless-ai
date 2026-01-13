[meta]
timestamp: 2026-01-13T00:00:00Z
agent: GitHub Copilot
stage: 070-debug
prompt_ref: docs/bridge/ENVIRONMENT_VARIABLES.md

[summary]
Added CLI flags to the bridge entrypoint to allow forcing LOG_LEVEL and LOG_FILE ("--log-level", "--log-file", "--print-env"), and added an unconditional startup diagnostic write to the bridge log file so the effective LOG_LEVEL and log path are recorded even when DEBUG is not enabled. Added unit tests for the entrypoint CLI handling and updated bridge docs.

[artifacts]
- bridge/codex-serena-bridge.py
- bridge/codex_serena_bridge.py
- test/unit/test_codex_entry.py
- docs/bridge/ENVIRONMENT_VARIABLES.md

[next]
- Reproduce the CODEX spawn with the bridge: add the flags to `.codex/config.toml` (e.g., `--log-level DEBUG --print-env`) or set `LOG_LEVEL=DEBUG` in the environment and start CODEX.
- Collect `bridge_debug.log` (tail) while reproducing and share results.
- If logs show server exception or missing initialize, capture the traceback and I will propose a Phase 2 fix.