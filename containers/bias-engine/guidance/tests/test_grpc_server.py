import pytest
import grpc
from concurrent import futures
import sys
import os
from unittest.mock import MagicMock, patch

# Add the parent directory to sys.path to find the guidance package
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc

# We need to mock LogitBiasEngine and AutoTokenizer before importing LogitBiasServicer
# because the imports in grpc_server.py might trigger tokenizer loading if not careful.
# But LogitBiasServicer is defined inside grpc_server.py.

@pytest.fixture
def mock_servicer():
    with patch('guidance.ipc.grpc_server.AutoTokenizer'), \
         patch('guidance.ipc.grpc_server.LogitBiasEngine'):
        from guidance.ipc.grpc_server import LogitBiasServicer
        servicer = LogitBiasServicer()
        servicer.engine = MagicMock()
        return servicer

@pytest.fixture
def grpc_server(mock_servicer):
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=1))
    bias_service_pb2_grpc.add_LogitBiasServiceServicer_to_server(mock_servicer, server)
    port = server.add_insecure_port('[::]:0')
    server.start()
    yield f'localhost:{port}', mock_servicer
    server.stop(None)

@pytest.fixture
def grpc_stub(grpc_server):
    address, servicer = grpc_server
    with grpc.insecure_channel(address) as channel:
        yield bias_service_pb2_grpc.LogitBiasServiceStub(channel), servicer

def test_health_check(grpc_stub):
    stub, _ = grpc_stub
    response = stub.HealthCheck(bias_service_pb2.HealthCheckRequest())
    assert response.status == bias_service_pb2.HealthCheckResponse.SERVING

def test_compute_biases(grpc_stub):
    stub, servicer = grpc_stub
    
    # Configure mock behavior
    servicer.engine.compute_biases.return_value = ({1: 100.0, 2: 100.0}, 2)
    
    request = bias_service_pb2.BiasRequest(
        regex_pattern="[0-9]+",
        generated_text="12",
        vocab_size=50257
    )
    
    response = stub.ComputeBiases(request)
    
    # Verify response
    assert response.token_biases == {1: 100.0, 2: 100.0}
    assert response.computation_time_ms >= 0
    assert response.cache_hit is True
    
    # Verify engine was called correctly
    servicer.engine.compute_biases.assert_called_once_with(
        "[0-9]+", "12", 50257
    )
