#!/usr/bin/env sh
set -e
# Installs dependencies and compiles the proto file

echo "Compiling Protocol Buffers..."

# Verify grpc_tools.protoc is available
python - <<'PY'
import sys
try:
    import grpc_tools.protoc as protoc
    print('grpc_tools.protoc OK')
except Exception as e:
    print('ERROR: grpc_tools.protoc not available:', e, file=sys.stderr)
    raise
PY

# Ensure package init files exist
mkdir -p guidance/ipc/proto
: > guidance/ipc/__init__.py
: > guidance/ipc/proto/__init__.py

# Run protoc; include guidance root to improve import resolution
python -m grpc_tools.protoc \
  -I guidance -I guidance/ipc/proto \
  --python_out=guidance/ipc/proto \
  --grpc_python_out=guidance/ipc/proto \
  guidance/ipc/proto/bias_service.proto

# Patch all generated bias pb files in-place to normalise imports and module names (handles nested output)
find guidance -type f -name 'bias_service_pb2*.py' -print | while IFS= read -r f; do
  echo "Patching generated file: $f"
  python - "$f" <<PY
import sys
from pathlib import Path
import re
p = Path(sys.argv[1])
s = p.read_text()
if p.name.endswith('_pb2_grpc.py'):
    # Replace 'from ipc.proto import bias_service_pb2 as ALIAS' with guidance-qualified import
    s_new = re.sub(r'from\s+ipc\.proto\s+import\s+bias_service_pb2\s+as\s+(\w+)', r'from guidance.ipc.proto import bias_service_pb2 as \1', s)
    # If above didn't match, try replacing plain 'import bias_service_pb2 as ALIAS' to relative import
    if s_new == s:
        s_new = re.sub(r'\bimport\s+bias_service_pb2\s+as\s+(\w+)', r'from . import bias_service_pb2 as \1', s_new)
    # normalize any descriptor module references
    s_new = re.sub(r'ipc\s*\.\s*proto\s*\.\s*bias_service_pb2', 'guidance.ipc.proto.bias_service_pb2', s_new)
    s = s_new
else:
    # For pb2 modules, normalize descriptor module path and other occurrences
    s = re.sub(r'ipc\s*\.\s*proto\s*\.\s*bias_service_pb2', 'guidance.ipc.proto.bias_service_pb2', s)

p.write_text(s)
print('Patched', p)
PY
done || true

# Fix generated imports and module names to include guidance package
if [ -f guidance/ipc/proto/bias_service_pb2_grpc.py ]; then
  echo "Patching generated grpc file imports..."
  python - <<'PY'
from pathlib import Path
p = Path('guidance/ipc/proto/bias_service_pb2_grpc.py')
s = p.read_text()
# Prefix incorrect top-level package imports (e.g., 'ipc.proto') with 'guidance.'
s = s.replace('from ipc.proto import bias_service_pb2 as', 'from guidance.ipc.proto import bias_service_pb2 as')
# Also handle any plain 'import bias_service_pb2' occurrences
s = s.replace('import bias_service_pb2 as', 'from . import bias_service_pb2 as')
s = s.replace('\nimport bias_service_pb2\n', '\nfrom . import bias_service_pb2\n')
p.write_text(s)
print('Patched:', p)
PY
fi

# Patch biases module to set correct module path in descriptors
if [ -f guidance/ipc/proto/bias_service_pb2.py ]; then
  echo "Patching pb2 module descriptor module name..."
  python - <<'PY'
from pathlib import Path
p = Path('guidance/ipc/proto/bias_service_pb2.py')
s = p.read_text()
# Replace module name used in BuildTopDescriptorsAndMessages from 'ipc.proto.bias_service_pb2' to 'guidance.ipc.proto.bias_service_pb2'
import re
s = re.sub(r"ipc\s*\.\s*proto\s*\.\s*bias_service_pb2", "guidance.ipc.proto.bias_service_pb2", s, flags=re.S)
# Also adjust source comment if needed
s = s.replace('source: ipc/proto/bias_service.proto', 'source: ipc/proto/bias_service.proto')
p.write_text(s)
print('Patched:', p)
PY
fi

# Move generated files into the proto package root if protoc created nested package directories
# (protoc may create guidance/ipc/proto/guidance/ipc/... when using --python_out=guidance/ipc/proto)
# Move nested generated files into the proto root (targeted fallback)
if [ -f guidance/ipc/proto/ipc/proto/bias_service_pb2.py ]; then
  echo "Moving nested generated files to guidance/ipc/proto/"
  mv -f guidance/ipc/proto/ipc/proto/bias_service_pb2.py guidance/ipc/proto/ || true
  mv -f guidance/ipc/proto/ipc/proto/bias_service_pb2_grpc.py guidance/ipc/proto/ || true
  rm -rf guidance/ipc/proto/ipc || true
fi
# Fallback generic move (best-effort)
find guidance/ipc/proto -type f -name 'bias_service_pb2*.py' -mindepth 2 -exec mv -f {} guidance/ipc/proto/ \; || true
# Clean up empty nested directories (attempted twice to be robust)
find guidance/ipc/proto -type d -empty -delete || true
find guidance/ipc -type d -empty -delete || true

# List directory for debugging
ls -la guidance/ipc/proto || true

# Final validation
echo "Validating generated files..."
if [ ! -f "guidance/ipc/proto/bias_service_pb2.py" ]; then
  echo "ERROR: guidance/ipc/proto/bias_service_pb2.py was not generated"
  exit 1
fi
if [ ! -f "guidance/ipc/proto/bias_service_pb2_grpc.py" ]; then
  echo "ERROR: guidance/ipc/proto/bias_service_pb2_grpc.py was not generated"
  exit 1
fi

# Basic malformation check (ensure files are not empty)
if [ ! -s "guidance/ipc/proto/bias_service_pb2.py" ]; then
  echo "ERROR: guidance/ipc/proto/bias_service_pb2.py is empty"
  exit 1
fi

echo "Proto compilation complete and validated."
