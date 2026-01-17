import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT = ROOT / 'scripts' / 'validate_env_py.py'


def test_validate_env_py_runs():
    """Run the Python env validator and assert it exits with 0."""
    res = subprocess.run([sys.executable, str(SCRIPT)], cwd=str(ROOT))
    assert res.returncode == 0, f"validate_env_py.py failed with exit code {res.returncode}"