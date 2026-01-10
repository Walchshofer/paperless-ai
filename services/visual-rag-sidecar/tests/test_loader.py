import sys
import types

from main import load_model, state


class DummyModel:
    @classmethod
    def from_pretrained(cls, model_id, **kwargs):
        # capture and return a dummy instance
        DummyModel.called = (model_id, kwargs)
        return cls()


def test_load_model_calls_byaldi(monkeypatch):
    # Monkeypatch the byaldi RAGMultiModalModel with our DummyModel
    ns = types.SimpleNamespace(RAGMultiModalModel=DummyModel)
    monkeypatch.setitem(sys.modules, 'byaldi', ns)

    # Ensure the state is clean
    state.model = None
    state.model_loaded = False
    state.loading = False

    # Run loader
    load_model()

    model_id, kwargs = DummyModel.called

    assert model_id == "TomoroAI/tomoro-colqwen3-embed-4b-awq"
    assert kwargs.get('device') == 'cuda'
    assert kwargs.get('trust_remote_code') is True
    assert kwargs.get('attn_implementation') == 'flash_attention_2'
    assert kwargs.get('load_in_4bit') is False

    # Clean up
    state.model = None
    state.model_loaded = False
    state.loading = False
