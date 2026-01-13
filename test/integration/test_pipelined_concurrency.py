import asyncio

from bridge.orderer import ResponseOrderer


def test_pipelined_concurrency_ordering():
    async def scenario():
        orderer = ResponseOrderer()
        completed = []

        async def worker(idx, delay):
            token = await orderer.register()
            await asyncio.sleep(delay)
            await orderer.wait_turn(token)
            completed.append(idx)

        await asyncio.gather(
            worker(1, 0.2),
            worker(2, 0.1),
            worker(3, 0.05),
        )

        assert completed == [1, 2, 3]

    asyncio.run(scenario())