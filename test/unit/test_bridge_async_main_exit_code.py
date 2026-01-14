from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any, Awaitable, Callable

import pytest

import bridge.codex_serena_bridge as bridge
from bridge.state import BridgeState


RunCoro = Callable[[], Awaitable[Any]]


class DummyManager:
    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        self.started = False

    def start(self) -> None:
        self.started = True

    async def stop(self) -> None:
        return None


class DummyServer:
    def __init__(self, run_coro: RunCoro) -> None:
        self._run_coro = run_coro

    def run(self, *_args: Any, **_kwargs: Any) -> Awaitable[Any]:
        return self._run_coro()

    def create_initialization_options(
        self,
        **_kwargs: Any,
    ) -> dict[str, Any]:
        return {}


class DummyApp:
    def __init__(self, run_coro: RunCoro, shutdown: bool = False) -> None:
        import asyncio

        self.state = BridgeState()
        if shutdown:
            self.state.shutdown.set()
        self.orderer = object()
        self.server = DummyServer(run_coro)
        # Mirror real BridgeApp: expose an initialized Event for initialize
        # handshake detection in tests.
        self.initialized: asyncio.Event = asyncio.Event()


@asynccontextmanager
async def fake_stdio_server():
    yield object(), object()


def _no_signal(_state: BridgeState) -> None:
    return None


def _no_log(*_args: Any, **_kwargs: Any) -> None:
    return None


def _patch_bridge(monkeypatch: pytest.MonkeyPatch, app: DummyApp) -> None:
    # Ensure tests run with a clean STDIO-related environment unless the
    # test explicitly sets these variables.
    import os

    if "STDIO_INITIALIZE_GRACE_SECS" not in os.environ:
        monkeypatch.delenv("STDIO_INITIALIZE_GRACE_SECS", raising=False)
    if "STDIO_INITIALIZE_TIMEOUT_SECS" not in os.environ:
        monkeypatch.delenv("STDIO_INITIALIZE_TIMEOUT_SECS", raising=False)
    # Reload bridge.config so changes to the environment (done above) are
    # observed by the module-level constants.
    import importlib

    importlib.reload(bridge.config)
    # Sync the runtime config values with the environment so tests that set
    # env vars via monkeypatch are reliably observed.
    import os

    bridge.config.STDIO_INITIALIZE_GRACE_SECS = float(
        os.getenv("STDIO_INITIALIZE_GRACE_SECS", "0")
    )
    bridge.config.STDIO_INITIALIZE_TIMEOUT_SECS = float(
        os.getenv("STDIO_INITIALIZE_TIMEOUT_SECS", "0")
    )

    monkeypatch.setattr(bridge, "BridgeApp", lambda: app)
    monkeypatch.setattr(bridge, "ConnectionManager", DummyManager)
    monkeypatch.setattr(bridge, "stdio_server", fake_stdio_server)
    monkeypatch.setattr(bridge, "_install_signal_handlers", _no_signal)
    # Stabilize stdin.closed detection for test runs.
    class DummyStdin:
        closed = False

    monkeypatch.setattr(bridge.sys, "stdin", DummyStdin())
    # NOTE: do not suppress the bridge log here so tests can surface internal
    # diagnostic messages which help debugging race conditions in tests.


@pytest.mark.asyncio
async def test_async_main_returns_zero_on_success(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    shutdown_event = asyncio.Event()

    async def run_ok() -> None:
        await shutdown_event.wait()

    # Ensure grace and timeout are disabled for this test
    monkeypatch.setenv("STDIO_INITIALIZE_GRACE_SECS", "0")
    monkeypatch.setenv("STDIO_INITIALIZE_TIMEOUT_SECS", "0")
    import importlib

    importlib.reload(bridge.config)

    app = DummyApp(run_ok)
    _patch_bridge(monkeypatch, app)

    async def trigger_shutdown() -> None:
        await asyncio.sleep(0.05)
        shutdown_event.set()
        app.state.shutdown.set()

    asyncio.create_task(trigger_shutdown())
    exit_code = await bridge.async_main()

    assert exit_code == 0


@pytest.mark.asyncio
async def test_stdio_enter_and_exit_write_log(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    """Verify we unconditionally write STDIO enter/exit diagnostics to the bridge logfile."""
    log_file = tmp_path / "bridge_test.log"
    monkeypatch.setenv("CODEX_BRIDGE_LOG_FILE", str(log_file))
    # reload config module so it picks up env change
    import importlib

    importlib.reload(bridge.config)
    shutdown_event = asyncio.Event()

    async def run_ok() -> None:
        await shutdown_event.wait()

    # Ensure grace and timeout are disabled for this test
    monkeypatch.setenv("STDIO_INITIALIZE_GRACE_SECS", "0")
    monkeypatch.setenv("STDIO_INITIALIZE_TIMEOUT_SECS", "0")
    import importlib

    importlib.reload(bridge.config)

    app = DummyApp(run_ok)
    _patch_bridge(monkeypatch, app)

    async def trigger_shutdown() -> None:
        await asyncio.sleep(0.05)
        shutdown_event.set()
        app.state.shutdown.set()

    asyncio.create_task(trigger_shutdown())
    exit_code = await bridge.async_main()

    assert exit_code == 0
    data = log_file.read_text(encoding="utf-8")
    assert "[CODEX-BRIDGE] [STDIO] entering stdio_server" in data
    assert "[CODEX-BRIDGE] [STDIO] exited stdio_server" in data
    assert "[CODEX-BRIDGE] [STDIO] server_task_created" in data


@pytest.mark.asyncio
async def test_server_task_exits_during_grace(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the server task completes immediately during the grace period, async_main should return non-zero."""
    monkeypatch.setenv("STDIO_INITIALIZE_GRACE_SECS", "0.1")
    import importlib

    importlib.reload(bridge.config)

    async def run_immediate() -> None:
        # server task completes immediately
        return None

    app = DummyApp(run_immediate)
    _patch_bridge(monkeypatch, app)

    exit_code = await bridge.async_main()

    assert exit_code == 1


@pytest.mark.asyncio
async def test_server_task_exits_without_shutdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def run_immediate() -> None:
        return None

    monkeypatch.setenv("STDIO_INITIALIZE_GRACE_SECS", "0")
    monkeypatch.setenv("STDIO_INITIALIZE_TIMEOUT_SECS", "0")
    import importlib

    importlib.reload(bridge.config)

    app = DummyApp(run_immediate)
    _patch_bridge(monkeypatch, app)

    exit_code = await bridge.async_main()

    assert exit_code == 1


@pytest.mark.asyncio
async def test_manager_start_failure_returns_nonzero(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def run_wait() -> None:
        await asyncio.Event().wait()

    class FailingManager(DummyManager):
        def start(self) -> None:
            raise RuntimeError("boom")

    app = DummyApp(run_wait)
    _patch_bridge(monkeypatch, app)
    monkeypatch.setattr(bridge, "ConnectionManager", FailingManager)

    exit_code = await bridge.async_main()

    assert exit_code == 1


@pytest.mark.asyncio
async def test_server_task_survives_grace(monkeypatch: pytest.MonkeyPatch) -> None:
    """If the server task remains running during the grace period, async_main should continue to normal wait."""
    monkeypatch.setenv("STDIO_INITIALIZE_GRACE_SECS", "0.2")
    import importlib

    importlib.reload(bridge.config)
    shutdown_event = asyncio.Event()

    async def run_long() -> None:
        await shutdown_event.wait()

    app = DummyApp(run_long)
    # Simulate that initialize was received during startup
    app.initialized.set()
    _patch_bridge(monkeypatch, app)

    async def trigger_shutdown() -> None:
        await asyncio.sleep(0.3)
        shutdown_event.set()
        app.state.shutdown.set()

    asyncio.create_task(trigger_shutdown())
    exit_code = await bridge.async_main()

    assert exit_code == 0


@pytest.mark.asyncio
async def test_initialize_timeout_triggers_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """If MCP initialize does not arrive within timeout, async_main should return non-zero."""
    monkeypatch.setenv("STDIO_INITIALIZE_TIMEOUT_SECS", "0.1")
    import importlib

    importlib.reload(bridge.config)

    async def run_long() -> None:
        # server task remains running but initialize never arrives
        await asyncio.sleep(0.5)

    app = DummyApp(run_long)
    _patch_bridge(monkeypatch, app)

    exit_code = await bridge.async_main()

    assert exit_code == 1


@pytest.mark.asyncio
async def test_async_main_returns_nonzero_on_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def run_fail() -> None:
        await asyncio.sleep(0)
        raise RuntimeError("boom")

    app = DummyApp(run_fail)
    _patch_bridge(monkeypatch, app)

    exit_code = await bridge.async_main()

    assert exit_code == 1


@pytest.mark.asyncio
async def test_async_main_returns_zero_on_shutdown(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def run_wait() -> None:
        await asyncio.Event().wait()

    app = DummyApp(run_wait, shutdown=True)
    _patch_bridge(monkeypatch, app)

    exit_code = await bridge.async_main()

    assert exit_code == 0
