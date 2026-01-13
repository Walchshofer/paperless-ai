"""Local MCP stub package used for compatibility during tests.

This module re-exports the small `ClientSession` and `sse_client` test
implementations under the `mcp` package name so that code importing
`from mcp.client import ClientSession` continues to work in test
contexts, while a real `mcp` package may also be installed in the
environment.
"""
from __future__ import annotations

import os
import sys

# Preserve the previous helpful message when stubs are actively requested
if os.getenv("BRIDGE_TEST_STUBS", "1") == "1":
    sys.stderr.write("Using local MCP test stubs\n")

# Export small test-compatible implementations
from .client.client import ClientSession  # type: ignore
from .client.sse import sse_client  # type: ignore

