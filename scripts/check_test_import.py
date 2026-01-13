import os, sys
print('cwd:', os.getcwd())
print('sys.path sample:', sys.path[:5])
# Ensure repo root on PYTHONPATH
os.environ['PYTHONPATH'] = os.getcwd()
print('PYTHONPATH set to', os.environ['PYTHONPATH'])
try:
    import test.fixtures.mock_serena_server as ms
    print('Imported mock_serena_server from', ms)
    print('Attributes:', dir(ms)[:20])
except Exception as e:
    print('Import failed:', repr(e))
    import pkgutil
    found = [m for m in pkgutil.iter_modules() if m.name == 'test']
    print('pkgutil found test modules:', found)
    import glob
    print('test files:', glob.glob('test/**/*', recursive=True)[:20])
