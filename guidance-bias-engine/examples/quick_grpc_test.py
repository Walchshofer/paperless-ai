"""Quick BiasEngine gRPC test using Python."""
import grpc
import sys
import json

# Test BiasEngine gRPC connectivity
print("="*60)
print("BiasEngine gRPC Direct Test")
print("="*60)

channel = grpc.insecure_channel('localhost:50051')

# Check channel connectivity
try:
    # Wait for channel to be ready (with timeout)
    grpc.channel_ready_future(channel).result(timeout=5)
    print("✅ Connected to BiasEngine gRPC at localhost:50051")
except grpc.FutureTimeoutError:
    print("❌ Could not connect to BiasEngine at localhost:50051")
    sys.exit(1)

# Now test with the proto - we'll generate inline
print("\n📡 Testing ComputeBiases RPC...")

# Build request manually using generic gRPC
from grpc._channel import _UnaryUnaryMultiCallable

# Since we don't have the proto stubs locally, let's use docker exec
import subprocess

print("\n📅 Testing date pattern [0-9]{4}-[0-9]{2}-[0-9]{2}:")
test_cases = [
    ("", "Empty start"),
    ("2026", "After year"),
    ("2026-", "After first dash"),
    ("2026-01", "After month"),
]

for text, desc in test_cases:
    cmd = [
        "docker", "exec", "guidance-bias-engine-bias-engine-1",
        "python", "-c", f'''
import grpc
import sys
sys.path.insert(0, "/app")
from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc

channel = grpc.insecure_channel("localhost:50051")
stub = bias_service_pb2_grpc.LogitBiasServiceStub(channel)

response = stub.ComputeBiases(bias_service_pb2.BiasRequest(
    regex_pattern="[0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}}",
    generated_text="{text}",
    vocab_size=50257
))
print(
    f"tokens={{len(response.token_biases)}},"
    f"time={{response.computation_time_ms}}ms"
)
'''
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode == 0:
        output = result.stdout.strip()
        print(f"   '{text}' ({desc}): {output}")
    else:
        print(f"   ❌ Error: {result.stderr[:100]}")

print("\n📱 Testing phone pattern [0-9]{3}-[0-9]{4}:")
phone_tests = [
    ("", "Start"),
    ("555", "Area code"),
    ("555-", "After dash"),
    ("555-123", "Partial"),
]

for text, desc in phone_tests:
    cmd = [
        "docker", "exec", "guidance-bias-engine-bias-engine-1",
        "python", "-c", f'''
import grpc
import sys
sys.path.insert(0, "/app")
from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc

channel = grpc.insecure_channel("localhost:50051")
stub = bias_service_pb2_grpc.LogitBiasServiceStub(channel)

response = stub.ComputeBiases(bias_service_pb2.BiasRequest(
    regex_pattern="[0-9]{{3}}-[0-9]{{4}}",
    generated_text="{text}",
    vocab_size=50257
))
# Get first 5 token IDs
tokens = list(response.token_biases.keys())[:5]
print(
    f"valid={{len(response.token_biases)}},"
    f"time={{response.computation_time_ms}}ms,sample={{tokens}}"
)
'''
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode == 0:
        output = result.stdout.strip()
        print(f"   '{text}' ({desc}): {output}")
    else:
        print(f"   ❌ Error: {result.stderr[:100]}")

# Health check
print("\n🏥 Health Check:")
cmd = [
    "docker", "exec", "guidance-bias-engine-bias-engine-1",
    "python", "-c", '''
import grpc
import sys
sys.path.insert(0, "/app")
from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc

channel = grpc.insecure_channel("localhost:50051")
stub = bias_service_pb2_grpc.LogitBiasServiceStub(channel)

response = stub.HealthCheck(
    bias_service_pb2.HealthCheckRequest(service="test")
)
print(f"status={response.status}")
'''
]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
if result.returncode == 0:
    print(f"   ✅ {result.stdout.strip()}")
else:
    print(f"   ❌ Error: {result.stderr[:100]}")

print("\n" + "="*60)
print("✅ BiasEngine gRPC test complete!")
print("="*60)
