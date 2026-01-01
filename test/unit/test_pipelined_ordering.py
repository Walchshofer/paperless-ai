import asyncio

from bridge.orderer import ResponseOrderer


def test_pipelined_response_ordering():
    async def scenario():
        orderer = ResponseOrderer()
        results = []

        async def worker(idx, delay):
            token = await orderer.register()
            await asyncio.sleep(delay)
            await orderer.wait_turn(token)
            results.append(idx)

        await asyncio.gather(
            worker(1, 0.3),
            worker(2, 0.2),
            worker(3, 0.1),
        )

        assert results == [1, 2, 3]

    asyncio.run(scenario())


def test_orderer_reset_releases_waiters():
    async def scenario():
        orderer = ResponseOrderer()
        token = await orderer.register()

        waiter = asyncio.create_task(orderer.wait_turn(token))
        await asyncio.sleep(0)
        await orderer.reset()
        await waiter

    asyncio.run(scenario())