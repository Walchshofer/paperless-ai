import mcp.types as types
from mcp.server.lowlevel.helper_types import ReadResourceContents

from bridge.codex_serena_bridge import _convert_read_result


def test_convert_read_result_from_types():
    result = types.ReadResourceResult(
        contents=[
            types.TextResourceContents(
                text="hello",
                mimeType="text/plain",
            )
        ]
    )
    converted = list(_convert_read_result(result))

    assert len(converted) == 1
    assert isinstance(converted[0], ReadResourceContents)
    assert converted[0].content == "hello"


def test_convert_read_result_from_dict():
    result = {"contents": [{"text": "data", "mimeType": "text/plain"}]}
    converted = list(_convert_read_result(result))

    assert len(converted) == 1
    assert isinstance(converted[0], ReadResourceContents)
    assert converted[0].content == "data"