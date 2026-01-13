import os, sys
# Ensure repo root is first on sys.path so our local 'test' package shadows stdlib 'test'
sys.path.insert(0, os.getcwd())
# Ensure env
os.environ.pop('BRIDGE_TEST_STUBS', None)
os.environ['LOG_LEVEL'] = 'DEBUG'

import pytest
args = [
    'test/integration/test_connection_lifecycle.py::test_bridge_connects_and_fetches_tools',
    '-q', '-r', 'a', '-s', '-vv',
]
print('Running pytest with args:', args)
rc = pytest.main(args)
print('pytest rc:', rc)
sys.exit(rc)
