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
   Open http://localhost:8001 for Prometheus metrics.