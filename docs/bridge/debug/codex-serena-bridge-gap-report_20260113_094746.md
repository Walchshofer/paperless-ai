# Codex-Serena-Bridge Gap Report

Timestamp: 2026-01-13T09:47:46

## Scope
- docs/bridge/*
- codex-serena-bridge.py
- bridge/
- mcp/
- mcp_local_stub/
- scripts/
- other touched files

## Findings
### Resolved 1: BRIDGE_TEST_STUBS guard enforces stub usage
- Doc source:
  - docs/bridge/TROUBLESHOOTING.md:65-66
- Code source:
  - mcp/__init__.py:15-17
  - mcp_local_stub/__init__.py:10-12
  - codex-serena-bridge.py:17
  - test/unit/test_codex_bridge_config.py:9
- Expected behavior:
  - Importing mcp without BRIDGE_TEST_STUBS=1 raises ImportError.
  - Stubs are used only when BRIDGE_TEST_STUBS=1.
- Actual behavior:
  - Stub packages raise ImportError unless BRIDGE_TEST_STUBS=1.
  - Bridge only loads stubs when BRIDGE_TEST_STUBS == "1".
  - Tests set BRIDGE_TEST_STUBS=1 when they require stubs.
- Impact:
  - Prevents accidental stub usage in non-test environments.
- Recommendation:
  - None.

## Summary
- Highest-risk gap:
  - None remaining in docs/bridge scope.
- Quick wins:
  - None.

## Compliance checklist
- [ ] Debug-agent checklist followed
- [ ] Serena memory updated (run-active/handoff-next)
- [ ] Evidence includes file paths and line numbers
- [ ] Report saved to docs/bridge/debug
