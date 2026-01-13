#!/usr/bin/env python3
"""
Compatibility shim to preserve `codex-bridge.py` path for tests and external
callers. This file delegates to `codex-serena-bridge.py` and re-exports its
public symbols. Importing this module prints a brief deprecation notice to
stderr.

This file intentionally keeps behavior minimal so CI and external scripts
that reference `codex-bridge.py` continue to work while the canonical
implementation lives in `codex-serena-bridge.py`.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

sys.stderr.write("codex-bridge.py is a compatibility shim. Use codex-serena-bridge.py as the canonical implementation.\n")

_spec_location = Path(__file__).resolve().parent / "codex-serena-bridge.py"
if not _spec_location.exists():
    raise FileNotFoundError(f"Expected codex-serena-bridge.py next to {__file__}")

spec = importlib.util.spec_from_file_location("codex_bridge_impl", _spec_location)
module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(module)

# Re-export public symbols from the implementation
for name in dir(module):
    if name.startswith("_"):
        continue
    globals()[name] = getattr(module, name)

# Provide a main entrypoint preserving legacy behavior
if __name__ == "__main__":
    # If the implementation module exposes async_main, run it
    if hasattr(module, "async_main"):
        import asyncio

        asyncio.run(module.async_main())
    elif hasattr(module, "main"):
        module.main()
    else:
        sys.stderr.write("No entrypoint found in codex-serena-bridge.py\n")
