import os
os.environ['BRIDGE_TEST_STUBS'] = '1'
# Ensure python imports find local mcp package during tests
import pytest
import sys
sys.exit(pytest.main(['test/unit', '-q', '-r', 'a']))
