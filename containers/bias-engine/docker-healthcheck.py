#!/usr/bin/env python3
import grpc
import sys
import os

# Ensure the script can find proto modules within the container's PYTHONPATH
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Try multiple import paths (robust to packaging variations)
pb2 = None
pb2_grpc = None
try:
    # Primary import used by the running server
    from guidance.ipc.proto import bias_service_pb2 as pb2
    from guidance.ipc.proto import bias_service_pb2_grpc as pb2_grpc
except ImportError:
    try:
        # Alternative package layout
        from guidance.ipc import bias_service_pb2 as pb2
        from guidance.ipc import bias_service_pb2_grpc as pb2_grpc
    except ImportError:
        try:
            # Legacy / alternate names
            import bias_service_pb2 as pb2
            import bias_service_pb2_grpc as pb2_grpc
        except ImportError:
            pb2 = None
            pb2_grpc = None


def check_health():
    """
    Performs a gRPC HealthCheck RPC call to the Bias Engine.
    """
    if pb2 is None or pb2_grpc is None:
        print("Error: gRPC proto modules not found.", file=sys.stderr)
        return False

    try:
        # Connect to the gRPC server running on the standard port
        channel = grpc.insecure_channel('localhost:50051')
        stub = pb2_grpc.LogitBiasServiceStub(channel)

        # Execute the HealthCheck RPC call with a strict timeout
        _ = stub.HealthCheck(pb2.HealthCheckRequest(), timeout=2.0)
        return True
    except Exception as e:
        print(f"Healthcheck failed: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    # Docker expects exit code 0 for healthy and 1 for unhealthy
    sys.exit(0 if check_health() else 1)