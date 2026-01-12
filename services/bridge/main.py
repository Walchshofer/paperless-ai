"""Async entrypoint and graceful shutdown for the bridge service."""
import asyncio
import signal
from typing import Optional

from .config import LOG_LEVEL
from .logging import log, set_level_from_env
from .state import BridgeState


async def _wait_shutdown(state: BridgeState) -> None:
    """Wait until the shutdown event is set and then exit."""
    await state.shutdown.wait()


def _install_signal_handlers(loop: asyncio.AbstractEventLoop,
                             state: BridgeState) -> None:
    """Install OS signal handlers to trigger graceful shutdown."""

    def _on_signal() -> None:
        log("Signal received, initiating shutdown", "INFO",
            min_level=set_level_from_env(LOG_LEVEL))
        state.shutdown.set()

    try:
        loop.add_signal_handler(signal.SIGINT, _on_signal)  # type: ignore
        loop.add_signal_handler(signal.SIGTERM, _on_signal)  # type: ignore
    except NotImplementedError:
        # add_signal_handler may not be implemented on Windows
        pass


async def async_main(state: Optional[BridgeState] = None) -> int:
    """Primary asynchronous main entry for the bridge.

    Returns an integer exit code suitable for `sys.exit()` in `main()`.
    """
    log("Starting bridge", "INFO", min_level=set_level_from_env(LOG_LEVEL))
    own = False
    if state is None:
        state = BridgeState()
        own = True

    loop = asyncio.get_running_loop()
    _install_signal_handlers(loop, state)

    try:
        # Main run loop: wait until shutdown is requested.
        await _wait_shutdown(state)
        return 0
    finally:
        if own:
            await state.close()
        log("Shutdown complete", "INFO", min_level=set_level_from_env(LOG_LEVEL))


def main() -> int:
    """Synchronous entry point that runs the async main loop."""
    try:
        return asyncio.run(async_main())
    except KeyboardInterrupt:
        # Ensure clean exit code on Ctrl-C
        return 0
