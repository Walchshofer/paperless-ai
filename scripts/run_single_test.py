import os
import sys
import subprocess

# Configure environment for the test run
os.environ.pop('BRIDGE_TEST_STUBS', None)
os.environ['PYTHONPATH'] = os.getcwd()
os.environ['LOG_LEVEL'] = 'DEBUG'

cmd = [sys.executable, '-m', 'pytest', 'test/integration/test_connection_lifecycle.py::test_bridge_connects_when_serena_becomes_available', '-q', '-r', 'a', '-s', '-vv']
print('Running:', ' '.join(cmd))
rc = subprocess.call(cmd)
print('Exit code:', rc)
sys.exit(rc)
