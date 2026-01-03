#!/bin/bash
# Installs dependencies and compiles the proto file
echo "Compiling Protocol Buffers..."
python -m grpc_tools.protoc \
  -I guidance/ipc/proto \
  --python_out=guidance/ipc/proto \
  --grpc_python_out=guidance/ipc/proto \
  guidance/ipc/proto/bias_service.proto

touch guidance/ipc/proto/__init__.py
echo "Proto compilation complete."