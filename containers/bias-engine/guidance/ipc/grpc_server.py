import grpc
from concurrent import futures
import time
import logging
import os
import sys
from prometheus_client import start_http_server, Summary, Counter

# Add parent directory to path to find generated modules
sys.path.insert(0, os.getcwd())

# Generated imports
try:
    from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc
except ImportError as e:
    logging.critical(f"Failed to import proto files: {e}. Ensure setup_grpc.sh was run during build.")
    sys.exit(1)

from guidance.engines.logit_bias_engine import LogitBiasEngine
from transformers import AutoTokenizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BiasEngine")

# Prometheus Metrics
REQUEST_TIME = Summary(
    'bias_computation_seconds', 'Time spent computing biases'
)
REQUEST_COUNT = Counter(
    'bias_requests_total', 'Total bias computation requests'
)

class LogitBiasServicer(bias_service_pb2_grpc.LogitBiasServiceServicer):
    def __init__(self):
        # Configurable tokenizer via Environment Variable
        model_name = os.getenv("TOKENIZER_MODEL", "gpt2")
        logger.info(f"Loading tokenizer: {model_name}...")

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.engine = LogitBiasEngine(self.tokenizer)
            logger.info("Engine ready.")
        except Exception as e:
            logger.error(f"Failed to load tokenizer '{model_name}': {e}")
            raise e

    @REQUEST_TIME.time()
    def ComputeBiases(self, request, context):
        REQUEST_COUNT.inc()
        start = time.perf_counter()

        biases, valid_count = self.engine.compute_biases(
            request.regex_pattern, 
            request.generated_text,
            request.vocab_size
        )

        elapsed = (time.perf_counter() - start) * 1000

        return bias_service_pb2.BiasResponse(
            token_biases=biases,
            computation_time_ms=int(elapsed),
            cache_hit=True
        )

    def HealthCheck(self, request, context):
        return bias_service_pb2.HealthCheckResponse(
            status=bias_service_pb2.HealthCheckResponse.SERVING
        )

def serve():
    # Start Prometheus metrics server
    metrics_port = int(os.getenv("METRICS_PORT", "8001"))
    start_http_server(metrics_port)
    logger.info(f"Metrics server started on port {metrics_port}")

    # Start gRPC server
    grpc_port = os.getenv("GRPC_PORT", "50051")
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    bias_service_pb2_grpc.add_LogitBiasServiceServicer_to_server(
        LogitBiasServicer(), server
    )
    server.add_insecure_port(f'[::]:{grpc_port}')
    logger.info(f"gRPC server listening on port {grpc_port}")
    server.start()
    server.wait_for_termination()

if __name__ == '__main__':
    serve()