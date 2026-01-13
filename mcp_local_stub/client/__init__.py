"""Lightweight MCP client stubs for local tests.

These stubs provide a minimal API surface (ClientSession and
sse_client) so bridge tests can import the MCP SDK without the
real dependency.
"""
from .client import ClientSession  # re-export
from .sse import sse_client  # re-export
