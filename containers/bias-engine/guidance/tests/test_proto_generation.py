import pytest
import sys
import os

# Add the parent directory to sys.path to find the guidance package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

def test_proto_imports():
    """Verify that generated proto modules can be imported."""
    try:
        from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc
        assert bias_service_pb2 is not None
        assert bias_service_pb2_grpc is not None
    except ImportError as e:
        pytest.fail(f"Failed to import generated proto modules: {e}")

def test_proto_definitions():
    """Verify that key message classes are defined in the pb2 module."""
    from guidance.ipc.proto import bias_service_pb2
    
    # Check for core request/response messages
    assert hasattr(bias_service_pb2, 'BiasRequest')
    assert hasattr(bias_service_pb2, 'BiasResponse')
    assert hasattr(bias_service_pb2, 'HealthCheckRequest')
    assert hasattr(bias_service_pb2, 'HealthCheckResponse')

def test_bias_request_fields():
    """Verify the structure of BiasRequest."""
    from guidance.ipc.proto import bias_service_pb2
    
    req = bias_service_pb2.BiasRequest(
        regex_pattern="[0-9]+",
        generated_text="123",
        vocab_size=50257
    )
    assert req.regex_pattern == "[0-9]+"
    assert req.generated_text == "123"
    assert req.vocab_size == 50257

def test_health_check_enum():
    """Verify HealthCheckResponse status enum."""
    from guidance.ipc.proto import bias_service_pb2
    
    assert hasattr(bias_service_pb2.HealthCheckResponse, 'SERVING')
    assert hasattr(bias_service_pb2.HealthCheckResponse, 'NOT_SERVING')
    
    resp = bias_service_pb2.HealthCheckResponse(
        status=bias_service_pb2.HealthCheckResponse.SERVING
    )
    assert resp.status == bias_service_pb2.HealthCheckResponse.SERVING
