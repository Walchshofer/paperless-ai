# Bias-engine build notes

- The Dockerfile runs `setup_grpc.sh` during image build to generate Python gRPC bindings for `bias_service.proto`.
- The `setup_grpc.sh` script verifies that `grpcio-tools` is available, compiles the proto, fixes imports, and places generated files into `guidance/ipc/proto`.
- **Validation**: The build process includes strict validation to ensure `bias_service_pb2.py` and `bias_service_pb2_grpc.py` are correctly generated and non-empty.

## Troubleshooting Proto Generation

If the Docker build fails during the `setup_grpc.sh` step:

1.  **Check Build Context**: Ensure you are building from the root of the repository (or the `containers/bias-engine` directory if using that Dockerfile directly).
2.  **Missing Dependencies**: Ensure `requirements.txt` includes `grpcio-tools`.
3.  **Proto Syntax Error**: Validate `guidance/ipc/proto/bias_service.proto` for syntax errors.
4.  **Permission Issues**: Ensure `setup_grpc.sh` has executable permissions (`chmod +x setup_grpc.sh`).
5.  **Line Endings**: On Windows, ensure `setup_grpc.sh` uses LF line endings (the Dockerfile includes a `sed` command to fix this automatically).

## Local Development

If you need to regenerate bindings locally:

```bash
cd containers/bias-engine
pip install -r requirements.txt
./setup_grpc.sh
```

Ensure `grpcio-tools` is installed in your local Python environment.