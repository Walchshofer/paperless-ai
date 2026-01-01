import importlib, pkgutil, sys
print('sys.executable:', sys.executable)
loader = pkgutil.find_loader('mcp')
print('find_loader:', loader)
try:
    mcp = importlib.import_module('mcp')
    print('mcp module:', mcp, 'file:', getattr(mcp, '__file__', None))
    if hasattr(mcp, '__path__'):
        print('mcp __path__:', list(mcp.__path__))
    try:
        import inspect
        source = inspect.getsource(mcp)
        print('mcp __init__ first 400 chars:\n', source[:400])
    except Exception as e:
        print('could not read mcp source:', e)
except Exception as e:
    print('import mcp failed:', repr(e))
    print('sys.path sample:', sys.path[:10])
