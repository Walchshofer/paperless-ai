# Guidance LogitBiasEngine Project (V2)

A production-ready implementation of the Decoupled Logic/Inference architecture.

## Improvements V2
- **Configurable Tokenizer**: Set `TOKENIZER_MODEL` env var (default: `gpt2`)
- **Metrics**: Prometheus endpoint exposed on port 8001
- **Clean Config**: Updated Docker Compose spec

## Build & Proto Generation

The LogitBiasEngine uses gRPC for high-performance token bias computation. The Python bindings for the gRPC service are **generated during the Docker image build process**.

- **Build-time Validation**: The build will fail if `setup_grpc.sh` cannot compile the `.proto` files.
- **No Runtime Fallback**: For production reliability, the server no longer attempts to compile protos at startup.

## Quick Start (Windows)

1. **Build and Run:**
   ```powershell
   docker-compose up --build
   ```

2. **Verify Proto Generation (Optional):**
   If you need to verify the generated files inside the container:
   ```bash
   docker exec -it <container_id> ls -la /app/guidance/ipc/proto/
   ```

3. **Test gRPC:**
   ```powershell
   grpcurl -plaintext localhost:50051 guidance.ipc.LogitBiasService/HealthCheck
   ```

4. **View Metrics:**
   Open http://localhost:8001 for Prometheus metrics.