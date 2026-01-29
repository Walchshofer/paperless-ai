# Support compatibility: if generated pb2 modules are present as plain files in this directory
# ensure they are importable under the package name `guidance.ipc.proto` by loading
# them into sys.modules with that canonical name.
import importlib.util
import sys
from pathlib import Path

BASE = Path(__file__).parent
for name in ('bias_service_pb2', 'bias_service_pb2_grpc'):
    path = BASE / f"{name}.py"
    module_name = f"guidance.ipc.proto.{name}"
    if path.exists() and module_name not in sys.modules:
        spec = importlib.util.spec_from_file_location(module_name, str(path))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sys.modules[module_name] = module
