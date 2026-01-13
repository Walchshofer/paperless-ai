import bridge.codex_serena_bridge as bridge


class ServerStub:
    def __init__(self, *_args, **_kwargs):
        self.handlers = {}

    def _passthrough(self):
        def decorator(func):
            return func

        return decorator

    def set_request_handler(self, name):
        def decorator(func):
            self.handlers[name] = func
            return func

        return decorator

    def list_tools(self):
        return self._passthrough()

    def list_resources(self):
        return self._passthrough()

    def list_prompts(self):
        return self._passthrough()

    def get_prompt(self):
        return self._passthrough()

    def read_resource(self):
        return self._passthrough()

    def call_tool(self, **_kwargs):
        return self._passthrough()


def test_initialize_handler_registered(monkeypatch):
    monkeypatch.setattr(bridge, "Server", ServerStub)
    app = bridge.BridgeApp()

    assert "initialize" in app.server.handlers
