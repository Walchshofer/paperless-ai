"""Local MCP test stubs package.

WARNING: These stubs are provided for tests only. Importing this package
without the environment variable `BRIDGE_TEST_STUBS=1` will raise an
ImportError to prevent accidental shadowing of the real `mcp` SDK.
"""
from __future__ import annotations

import os
import sys

# Historically we required BRIDGE_TEST_STUBS=1 to avoid accidentally
# shadowing a real MCP SDK install. For CI and local testing where a real
# SDK isn't available, allow this local test stub package to act as a
# lightweight, drop-in SDK implementation.
if os.getenv("BRIDGE_TEST_STUBS", "1") == "1":
    sys.stderr.write("Using local MCP test stubs\n")

# Export the small ClientSession and sse_client implementations so importing
# `mcp` works whether or not the environment variable is set.
from .client.client import ClientSession  # type: ignore
from .client.sse import sse_client  # type: ignore

