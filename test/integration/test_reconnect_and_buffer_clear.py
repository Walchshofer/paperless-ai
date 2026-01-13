import asyncio

import pytest

from bridge.connection import ConnectionManager
from bridge.orderer import ResponseOrderer
from bridge.state import BridgeState


@pytest.mark.asyncio
async def test_disconnect_resets_orderer():
    state = BridgeState()
    orderer = ResponseOrderer()
    cm = ConnectionManager(state, orderer)

    token = await orderer.register()
    waiter = asyncio.create_task(orderer.wait_turn(token))
    await asyncio.sleep(0)

    await cm._handle_disconnect(
        clean=False,
        reason="connection_error",
        notify=True,
    )

    await waiter