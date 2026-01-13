# Compatibility shim: re-export stub implementations so `from mcp.client import ClientSession` works
from .client import ClientSession  # type: ignore
from .sse import sse_client  # type: ignore
