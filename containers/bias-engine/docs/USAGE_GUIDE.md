# Guidance LogitBiasEngine - Usage Guide

## Overview

The LogitBiasEngine provides **constrained text generation** by computing logit biases that guide an LLM to produce outputs matching a specified regex pattern. It uses a Finite State Machine (FSM) approach to determine which tokens are valid at each generation step.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your Application                             │
│              "Generate a phone: [0-9]{3}-[0-9]{4}"              │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
         ┌──────────────────┐    ┌──────────────────┐
         │   BiasEngine     │    │     Ollama       │
         │   (gRPC:50051)   │◄──►│   (HTTP:11434)   │
         │                  │    │                  │
         │  Computes which  │    │  Generates text  │
         │  tokens are      │    │  with biases     │
         │  valid next      │    │  applied         │
         └──────────────────┘    └──────────────────┘
                                          │
                                          ▼
                              ┌──────────────────┐
                              │  "555-1234"      │
                              │  (Constrained!)  │
                              └──────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- (Optional) `grpcurl` for testing: `choco install grpcurl` or `brew install grpcurl`
- (Optional) Python 3.11+ for client development

## Quick Start

### 1. Start the Services

```powershell
cd guidance-bias-engine
docker-compose up -d
```

### 2. Verify the Service is Running

```powershell
# Check container status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | Select-String "bias"

# Check logs
docker logs guidance-bias-engine-bias-engine-1 --tail 20
```

### 3. Verify Proto Generation

The LogitBiasEngine requires pre-generated gRPC bindings. You can verify they exist in the running container:

```bash
docker exec -it <container_name> ls -la /app/guidance/ipc/proto/
```

Expected files:
- `bias_service_pb2.py`
- `bias_service_pb2_grpc.py`
- `__init__.py`

### 4. Test with grpcurl

```bash
# Health check
grpcurl -plaintext localhost:50051 guidance.ipc.LogitBiasService/HealthCheck

# Compute biases for a pattern
grpcurl -plaintext -d '{
  "regex_pattern": "[0-9]{3}",
  "generated_text": "12",
  "vocab_size": 50257
}' localhost:50051 guidance.ipc.LogitBiasService/ComputeBiases
```

---

## API Reference

### Service: `LogitBiasService`

| Method | Description |
|--------|-------------|
| `ComputeBiases` | Compute valid token biases for the current generation state |
| `HealthCheck` | Check if the service is ready |

### ComputeBiases

Computes which tokens can validly extend the current text according to the regex pattern.

**Request: `BiasRequest`**

| Field | Type | Description |
|-------|------|-------------|
| `regex_pattern` | string | The regex constraint (e.g., `[0-9]{3}-[0-9]{4}`) |
| `generated_text` | string | Text generated so far (e.g., `"123-"`) |
| `vocab_size` | int32 | Model's vocabulary size (e.g., `50257` for GPT-2) |

**Response: `BiasResponse`**

| Field | Type | Description |
|-------|------|-------------|
| `token_biases` | map<int32, float> | Map of token_id → bias value (+100 for valid) |
| `computation_time_ms` | int64 | Time taken to compute (milliseconds) |
| `cache_hit` | bool | Whether result came from cache |

**Example:**

```json
// Request
{
  "regex_pattern": "[0-9]{3}",
  "generated_text": "12",
  "vocab_size": 50257
}

// Response
{
  "token_biases": {
    "15": 100.0,   // token for "0"
    "16": 100.0,   // token for "1"
    "17": 100.0,   // token for "2"
    // ... tokens for "3"-"9"
  },
  "computation_time_ms": 45,
  "cache_hit": false
}
```

### HealthCheck

**Request: `HealthCheckRequest`**

| Field | Type | Description |
|-------|------|-------------|
| `service` | string | Service name (optional) |

**Response: `HealthCheckResponse`**

| Field | Type | Description |
|-------|------|-------------|
| `status` | ServingStatus | `UNKNOWN`, `SERVING`, or `NOT_SERVING` |

---

## Integration Examples

### Python Client

```python
import grpc
from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc

def get_biases(pattern: str, current_text: str, vocab_size: int = 50257):
    """Get valid token biases for constrained generation."""
    channel = grpc.insecure_channel('localhost:50051')
    stub = bias_service_pb2_grpc.LogitBiasServiceStub(channel)
    
    request = bias_service_pb2.BiasRequest(
        regex_pattern=pattern,
        generated_text=current_text,
        vocab_size=vocab_size
    )
    
    response = stub.ComputeBiases(request)
    return dict(response.token_biases)

# Example: Generate a phone number
biases = get_biases(
    pattern=r"[0-9]{3}-[0-9]{4}",
    current_text="555-",
    vocab_size=50257
)
print(f"Valid tokens: {len(biases)}")
```

### Python with Ollama Integration

```python
import grpc
import requests
from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc

class ConstrainedGenerator:
    def __init__(self, bias_engine_url="localhost:50051", ollama_url="http://localhost:11434"):
        self.channel = grpc.insecure_channel(bias_engine_url)
        self.stub = bias_service_pb2_grpc.LogitBiasServiceStub(self.channel)
        self.ollama_url = ollama_url
    
    def generate(self, prompt: str, pattern: str, max_tokens: int = 50):
        """Generate text constrained to match the pattern."""
        generated = ""
        
        for _ in range(max_tokens):
            # Get valid token biases
            request = bias_service_pb2.BiasRequest(
                regex_pattern=pattern,
                generated_text=generated,
                vocab_size=50257
            )
            bias_response = self.stub.ComputeBiases(request)
            
            if not bias_response.token_biases:
                break  # Pattern complete or no valid continuations
            
            # Call Ollama with logit_bias
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": "llama3.2",
                    "prompt": prompt + generated,
                    "raw": True,
                    "options": {
                        "num_predict": 1,
                        "logit_bias": dict(bias_response.token_biases)
                    }
                }
            )
            
            token = response.json().get("response", "")
            if not token:
                break
            generated += token
        
        return generated

# Usage
generator = ConstrainedGenerator()
phone = generator.generate(
    prompt="Generate a US phone number: ",
    pattern=r"[0-9]{3}-[0-9]{3}-[0-9]{4}"
)
print(f"Generated phone: {phone}")  # e.g., "555-123-4567"
```

### Go Client

```go
package main

import (
    "context"
    "fmt"
    "log"
    "time"

    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    
    pb "github.com/paperless-ai/guidance-bias-engine/integration/ollama_enhanced/proto"
)

func main() {
    // Connect to the BiasEngine
    conn, err := grpc.Dial("localhost:50051", 
        grpc.WithTransportCredentials(insecure.NewCredentials()))
    if err != nil {
        log.Fatalf("Failed to connect: %v", err)
    }
    defer conn.Close()

    client := pb.NewLogitBiasServiceClient(conn)

    // Get biases for a pattern
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    resp, err := client.ComputeBiases(ctx, &pb.BiasRequest{
        RegexPattern:  "[0-9]{3}-[0-9]{4}",
        GeneratedText: "555-",
        VocabSize:     50257,
    })
    if err != nil {
        log.Fatalf("ComputeBiases failed: %v", err)
    }

    fmt.Printf("Valid tokens: %d\n", len(resp.TokenBiases))
    fmt.Printf("Computation time: %dms\n", resp.ComputationTimeMs)
}
```

### cURL/HTTP (via grpcurl)

```bash
# Health check
grpcurl -plaintext localhost:50051 guidance.ipc.LogitBiasService/HealthCheck

# Compute biases
grpcurl -plaintext -d '{
  "regex_pattern": "[A-Z]{2}[0-9]{4}",
  "generated_text": "AB",
  "vocab_size": 50257
}' localhost:50051 guidance.ipc.LogitBiasService/ComputeBiases
```

---

## Common Regex Patterns

| Use Case | Pattern | Example Output |
|----------|---------|----------------|
| US Phone | `[0-9]{3}-[0-9]{3}-[0-9]{4}` | `555-123-4567` |
| Date (ISO) | `[0-9]{4}-[0-9]{2}-[0-9]{2}` | `2026-01-03` |
| Time (24h) | `[0-2][0-9]:[0-5][0-9]` | `14:30` |
| ZIP Code | `[0-9]{5}` | `90210` |
| License Plate | `[A-Z]{2}[0-9]{4}` | `AB1234` |
| Boolean | `true\|false` | `true` |
| Integer | `-?[0-9]+` | `-42` |
| Float | `-?[0-9]+\.[0-9]+` | `3.14` |
| JSON Boolean | `"(true\|false)"` | `"true"` |
| JSON String | `"[^"]*"` | `"hello"` |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TOKENIZER_MODEL` | `gpt2` | HuggingFace tokenizer to use |
| `GRPC_PORT` | `50051` | gRPC server port |
| `METRICS_PORT` | `8001` | Prometheus metrics port |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

### Using a Different Tokenizer

For better results with Llama models, use a matching tokenizer:

```yaml
# docker-compose.yml
services:
  bias-engine:
    environment:
      - TOKENIZER_MODEL=meta-llama/Meta-Llama-3-8B
```

> **Note:** Some tokenizers (like Llama) require a HuggingFace token for gated models.

---

## Monitoring

### Prometheus Metrics

Available at `http://localhost:8003` (mapped from internal port 8001):

| Metric | Type | Description |
|--------|------|-------------|
| `bias_requests_total` | Counter | Total number of bias computation requests |
| `bias_computation_seconds` | Summary | Time spent computing biases |

### Prometheus Dashboard

Access Prometheus at: http://localhost:9091

Example query:
```promql
rate(bias_requests_total[5m])
```

### Grafana

Access Grafana at: http://localhost:3001 (default: admin/admin)

---

## Troubleshooting

### Container won't start

```powershell
# Check logs
docker logs guidance-bias-engine-bias-engine-1

# Common issues:
# - Proto files not generated: Rebuild with --no-cache
# - Port conflict: Change ports in docker-compose.yml
```

### gRPC connection refused

```powershell
# Verify container is running
docker ps | Select-String "bias-engine"

# Check if port is exposed
netstat -an | Select-String "50051"
```

### Slow bias computation

- First request is slow (cache cold)
- Subsequent requests with same pattern/text prefix are cached
- Large vocab sizes increase computation time

### Token mismatch

If generated tokens don't match the pattern, ensure:
1. `TOKENIZER_MODEL` matches your LLM's tokenizer
2. `vocab_size` matches the model's vocabulary

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BiasEngine Container                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  gRPC Server (:50051)                    │   │
│  │  ┌─────────────┐    ┌─────────────────────────────────┐ │   │
│  │  │ Servicer    │───▶│      LogitBiasEngine            │ │   │
│  │  │             │    │  ┌─────────────────────────────┐│ │   │
│  │  │ ComputeBias │    │  │       RegexFSM              ││ │   │
│  │  │ HealthCheck │    │  │  - Partial match detection  ││ │   │
│  │  └─────────────┘    │  │  - LRU Cache (10k entries)  ││ │   │
│  │                      │  └─────────────────────────────┘│ │   │
│  │                      └─────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Prometheus Metrics (:8001)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Proto Definition

```protobuf
syntax = "proto3";

package guidance.ipc;

service LogitBiasService {
  rpc ComputeBiases(BiasRequest) returns (BiasResponse) {}
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse) {}
}

message BiasRequest {
  string regex_pattern = 1;
  string generated_text = 2;
  int32 vocab_size = 3;
}

message BiasResponse {
  map<int32, float> token_biases = 1;
  int64 computation_time_ms = 2;
  bool cache_hit = 3;
}

message HealthCheckRequest {
  string service = 1;
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
  }
  ServingStatus status = 1;
}
```

---

## See Also

- [Architecture Overview](../README.md)
- [Kubernetes Deployment](../k8s/README.md)
- [Monitoring Setup](../monitoring/README.md)
