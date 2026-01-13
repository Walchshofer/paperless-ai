import os
import sys
os.environ['BRIDGE_TEST_STUBS'] = '0'
os.environ['SERENA_BASE'] = 'http://127.0.0.1:9121'
import pytest
sys.exit(pytest.main(['test/unit', '-q', '-r', 'a']))
