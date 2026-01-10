import pytest
from fastapi.testclient import TestClient

from main import app, config


def test_model_name_consistent():
    assert (
        config.MODEL_NAME == "TomoroAI/tomoro-colqwen3-embed-4b-awq"
    ), "Config.MODEL_NAME should match the deployed MODEL_ID"


def test_health_endpoint():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert "model_loaded" in data
    assert "model_name" in data


def test_vram_endpoint_returns_structure():
    client = TestClient(app)
    r = client.get("/vram")
    assert r.status_code == 200
    data = r.json()
    assert "available" in data
    # When running in CI or developer machine without CUDA, available will be False
    assert isinstance(data["available"], bool)
