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