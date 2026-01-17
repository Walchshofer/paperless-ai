#!/usr/bin/env python3
import re
from pathlib import Path
p=Path('docker-compose.env')
text=p.read_text()
lines=text.splitlines()
vars=[]
raw={}
for line in lines:
    s=line.strip()
    if not s or s.startswith('#'):
        continue
    if '=' in line:
        k,v=line.split('=',1)
        k=k.strip()
        v=v.strip()
        vars.append(k)
        raw[k]=v
# resolver
pat=re.compile(r"\$\{([^}:]+)(:-([^}]*))?\}")

def resolve_value(val, depth=0):
    if depth>20:
        return val
    def repl(m):
        name=m.group(1)
        default=m.group(3) if m.group(3) is not None else ''
        if name in raw and raw[name] != '':
            return resolve_value(raw[name], depth+1)
        else:
            return default
    new=pat.sub(repl, val)
    if new==val:
        return new
    return resolve_value(new, depth+1)

resolved={}
for k in vars:
    v=raw.get(k,'')
    resolved[k]=resolve_value(v)

# write .env
out = []
for k in vars:
    out.append(f"{k}={resolved.get(k,'')}")
Path('.env').write_text('\n'.join(out) + '\n')
print('Wrote .env with', len(out), 'entries')
