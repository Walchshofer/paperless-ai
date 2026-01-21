Write-Host "🚀 Initializing Guidance LogitBiasEngine Project V2 (Production Ready)..." -ForegroundColor Cyan

# Get the script's directory as the project root
$ProjectRoot = $PSScriptRoot
Write-Host "📁 Project root: $ProjectRoot" -ForegroundColor Gray

# ------------------------------------------------------------------------------
# Helper Functions
# ------------------------------------------------------------------------------
function New-ProjectFile ($RelativePath, $Content) {
    $FullPath = Join-Path $ProjectRoot $RelativePath
    $Dir = Split-Path -Parent $FullPath
    if ($Dir -and !(Test-Path $Dir)) { 
        New-Item -ItemType Directory -Force -Path $Dir | Out-Null 
    }
    # Write UTF-8 (No BOM)
    [System.IO.File]::WriteAllText($FullPath, $Content, [System.Text.Encoding]::UTF8)
    Write-Host "   + Created: $RelativePath" -ForegroundColor Gray
}

function New-LinuxScript ($RelativePath, $Content) {
    # Ensure Linux Line Endings (LF) for scripts used inside Docker
    $Content = $Content -replace "`r`n", "`n"
    New-ProjectFile $RelativePath $Content
}

# 1. Create Directory Structure
# ------------------------------------------------------------------------------
Write-Host "📂 Creating folders..."
$dirs = @(
    "guidance/engines",
    "guidance/ipc/proto",
    "guidance/tests",
    "integration/ollama_enhanced",
    "k8s/overlays/dev",
    "k8s/overlays/prod",
    "examples",
    "benchmarks",
    "scripts",
    "monitoring/grafana/dashboards",
    "monitoring/grafana/datasources",
    "monitoring/grafana/provisioning/dashboards",
    "monitoring/grafana/provisioning/datasources"
)
foreach ($d in $dirs) { 
    $FullDir = Join-Path $ProjectRoot $d
    New-Item -ItemType Directory -Force -Path $FullDir | Out-Null 
}

# 2. Generate Python Logic Engine Files
# ------------------------------------------------------------------------------
Write-Host "📝 Generating Python Logic Engine files..."

New-ProjectFile "guidance/__init__.py" @'
"""Guidance LogitBiasEngine - Constrained generation via logit biasing."""
__version__ = "0.1.0"
'@

New-ProjectFile "guidance/ipc/__init__.py" @'
"""IPC module for gRPC communication."""
'@

New-ProjectFile "guidance/tests/__init__.py" @'
"""Test suite for Guidance LogitBiasEngine."""
'@

New-ProjectFile "guidance/engines/__init__.py" @'
"""Engine implementations for Guidance."""

from .logit_bias_engine import LogitBiasEngine
from .regex_fsm import RegexFSM

__all__ = ["LogitBiasEngine", "RegexFSM"]
'@

New-ProjectFile "guidance/engines/regex_fsm.py" @'
import re
import regex  # Use the 'regex' library for partial matching support
from typing import Set, Dict, Optional
import functools

class RegexFSM:
    """
    Implements the FSM logic to determine valid next tokens.
    Uses partial matching to simulate state transitions.
    """
    
    def __init__(self, tokenizer):
        self.tokenizer = tokenizer
        self.cache = {} # Simple in-memory cache

    @functools.lru_cache(maxsize=10000)
    def get_valid_tokens(self, regex_pattern: str, current_text: str) -> Set[int]:
        """
        Determines which tokens can validly extend 'current_text' 
        according to 'regex_pattern'.
        """
        valid_tokens = set()
        
        # Compile with partial matching flag
        try:
            pattern = regex.compile(regex_pattern)
        except Exception as e:
            return set()
        
        for token_id in range(self.tokenizer.vocab_size):
            try:
                token_str = self.tokenizer.decode([token_id])
            except:
                continue
                
            candidate = current_text + token_str
            
            # partial=True allows "12" to match "[0-9]{3}"
            match = pattern.fullmatch(candidate, partial=True)
            
            if match:
                valid_tokens.add(token_id)
                
        return valid_tokens
'@

New-ProjectFile "guidance/engines/logit_bias_engine.py" @'
from .regex_fsm import RegexFSM

class LogitBiasEngine:
    """
    The Core Engine that wraps the FSM and formats for gRPC.
    """
    def __init__(self, tokenizer):
        self.fsm = RegexFSM(tokenizer)
        # Tuning parameters
        self.BIAS_VALID = 100.0
        self.BIAS_INVALID = -100.0

    def compute_biases(self, regex_pattern: str, generated_text: str, vocab_size: int):
        valid_tokens = self.fsm.get_valid_tokens(regex_pattern, generated_text)
        
        # Construct the sparse bias map
        biases = {}
        for token_id in valid_tokens:
            biases[token_id] = self.BIAS_VALID
            
        return biases, len(valid_tokens)
'@

# 3. Generate IPC/gRPC Files (UPDATED with Metrics)
# ------------------------------------------------------------------------------
Write-Host "📝 Generating IPC/gRPC files..."

New-ProjectFile "guidance/ipc/proto/bias_service.proto" @'
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
'@

New-ProjectFile "guidance/ipc/grpc_server.py" @'
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
bias_service_pb2 = None
bias_service_pb2_grpc = None
try:
    from guidance.ipc.proto import bias_service_pb2, bias_service_pb2_grpc
except ImportError as e:
    logging.error(f"Proto files not generated. Run setup_grpc.sh first. Error: {e}")
    sys.exit(1)

from guidance.engines.logit_bias_engine import LogitBiasEngine
from transformers import AutoTokenizer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BiasEngine")

# Prometheus Metrics
REQUEST_TIME = Summary('bias_computation_seconds', 'Time spent computing biases')
REQUEST_COUNT = Counter('bias_requests_total', 'Total bias computation requests')

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
    metrics_port = int(os.getenv("METRICS_PORT", "8003"))
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
'@

# 4. Generate Go/Ollama Integration Files
# ------------------------------------------------------------------------------
Write-Host "📝 Generating Go integration files..."

New-ProjectFile "integration/ollama_enhanced/bias_client.go" @'
package enhanced

import (
    "context"
    "log"
    "time"
    "google.golang.org/grpc"
    "google.golang.org/grpc/credentials/insecure"
    pb "github.com/guidance-ai/guidance/ipc/proto" 
)

type BiasClient struct {
    conn   *grpc.ClientConn
    client pb.LogitBiasServiceClient
}

func NewBiasClient(addr string) *BiasClient {
    conn, err := grpc.Dial(addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
    if err != nil {
        log.Fatalf("did not connect: %v", err)
    }
    return &BiasClient{
        conn:   conn,
        client: pb.NewLogitBiasServiceClient(conn),
    }
}

func (c *BiasClient) GetBiases(regex string, text string, vocabSize int32) map[int32]float32 {
    ctx, cancel := context.WithTimeout(context.Background(), time.Second)
    defer cancel()

    resp, err := c.client.ComputeBiases(ctx, &pb.BiasRequest{
        RegexPattern:  regex,
        GeneratedText: text,
        VocabSize:     vocabSize,
    })
    
    if err != nil {
        log.Printf("Error getting biases: %v", err)
        return nil
    }

    result := make(map[int32]float32)
    for k, v := range resp.TokenBiases {
        result[k] = v
    }
    return result
}
'@

# 5. Generate Docker & Infrastructure Files (Updated)
# ------------------------------------------------------------------------------
Write-Host "📝 Generating Docker & Infrastructure files..."

New-LinuxScript "Dockerfile.bias-engine" @'
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Code
COPY guidance/ ./guidance/
COPY setup_grpc.sh .

# Setup Proto
RUN chmod +x setup_grpc.sh && ./setup_grpc.sh

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV TOKENIZER_MODEL=gpt2 
# Override this in docker-compose/k8s

# Run Server
CMD ["python", "-m", "guidance.ipc.grpc_server"]
'@

New-ProjectFile "requirements.txt" @'
grpcio>=1.50.0
grpcio-tools>=1.50.0
protobuf>=4.21.0
transformers>=4.30.0
torch>=2.0.0
regex>=2023.0.0
prometheus-client>=0.17.0
'@

# docker-compose.yml - Removed version, added Env Vars & Metrics Port
New-ProjectFile "docker-compose.yml" @'
services:
  bias-engine:
    build: 
      context: .
      dockerfile: Dockerfile.bias-engine
    ports:
      - "50051:50051"
      - "8003:8003" # Metrics
    environment:
      - LOG_LEVEL=INFO
      - TOKENIZER_MODEL=gpt2 # Change to "meta-llama/Meta-Llama-3-8B" if using huggingface token
    volumes:
      - ./models:/models
    networks:
      - guidance-net

  postgres:
    image: postgres:16
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=elfman
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=paperless_test
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - guidance-net

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    environment:
      - QDRANT__STORAGE__ON_DISK_PAYLOAD=true
    volumes:
      - qdrant_data:/qdrant/storage
    networks:
      - guidance-net

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    environment:
      - OLLAMA_HOST=0.0.0.0
      - BIAS_ENGINE_URL=bias-engine:50051
    depends_on:
      - bias-engine
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - guidance-net

  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - guidance-net

  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    networks:
      - guidance-net

volumes:
  ollama_data:
  postgres_data:
  qdrant_data:

networks:
  guidance-net:
'@

New-LinuxScript "setup_grpc.sh" @'
#!/bin/bash
# Installs dependencies and compiles the proto file
echo "Compiling Protocol Buffers..."
python -m grpc_tools.protoc \
  -I guidance/ipc/proto \
  --python_out=guidance/ipc/proto \
  --grpc_python_out=guidance/ipc/proto \
  guidance/ipc/proto/bias_service.proto

# Fix the import in the generated grpc file to use relative import
sed -i 's/import bias_service_pb2/from . import bias_service_pb2/' guidance/ipc/proto/bias_service_pb2_grpc.py

touch guidance/ipc/proto/__init__.py
echo "Proto compilation complete."
'@

# 6. Generate Monitoring Config
# ------------------------------------------------------------------------------
Write-Host "📝 Generating Monitoring configurations..."

New-ProjectFile "monitoring/prometheus.yml" @'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'bias-engine'
    static_configs:
      - targets: ['bias-engine:8003']

  - job_name: 'ollama'
    static_configs:
      - targets: ['ollama:8002']

  - job_name: 'visual-rag'
    static_configs:
      - targets: ['visual-rag:8001']
'@

New-ProjectFile "monitoring/grafana/provisioning/datasources/datasource.yml" @'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
'@

New-ProjectFile "monitoring/grafana/provisioning/dashboards/dashboard.yml" @'
apiVersion: 1

providers:
  - name: 'Default'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    options:
      path: /var/lib/grafana/dashboards
'@

# 7. Generate K8s Manifests (Updated with Env & Ports)
# ------------------------------------------------------------------------------
Write-Host "📝 Generating Kubernetes manifests..."

New-ProjectFile "k8s/bias-engine-deployment.yaml" @'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bias-engine
  namespace: guidance
spec:
  replicas: 2
  selector:
    matchLabels:
      app: bias-engine
  template:
    metadata:
      labels:
        app: bias-engine
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8003"
    spec:
      containers:
      - name: bias-engine
        image: guidance:bias-engine-latest
        ports:
        - containerPort: 50051
          name: grpc
        - containerPort: 8003
          name: metrics
        env:
        - name: TOKENIZER_MODEL
          value: "meta-llama/Meta-Llama-3-8B" # Example for production
        resources:
          limits:
            cpu: 4
            memory: 8Gi
'@

New-ProjectFile "README.md" @'
# Guidance LogitBiasEngine Project (V2)

A production-ready implementation of the Decoupled Logic/Inference architecture.

## Improvements V2
- **Configurable Tokenizer**: Set `TOKENIZER_MODEL` env var (default: `gpt2`)
- **Metrics**: Prometheus endpoint exposed on port 8001
- **Clean Config**: Updated Docker Compose spec

## Quick Start (Windows)

1. **Build and Run:**
   ```powershell
   docker-compose up --build
   ```

2. **Test gRPC:**
   ```powershell
   grpcurl -plaintext localhost:50051 guidance.ipc.LogitBiasService/HealthCheck
   ```

3. **View Metrics:**
   Open http://localhost:8003 for Prometheus metrics.
'@

Write-Host "✅ Setup complete!" -ForegroundColor Green
