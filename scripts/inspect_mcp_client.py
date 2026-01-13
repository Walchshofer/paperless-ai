import importlib
mod = importlib.import_module('mcp.client')
print('mcp.client:', mod)
print('symbols:', [n for n in dir(mod) if not n.startswith('_')])
try:
    print('ClientSession?', hasattr(mod, 'ClientSession'))
except Exception as e:
    print('error checking ClientSession', e)
