#!/usr/bin/env python3
import re
from pathlib import Path
p=Path('docker-compose.env')
text=p.read_text()
lines=text.splitlines()
# Build raw var values from assignments
raw={}
for line in lines:
    s=line.strip()
    if not s or s.startswith('#'): continue
    if '=' in line:
        k,v=line.split('=',1)
        k=k.strip(); v=v.strip()
        raw[k]=v
# resolver
pat=re.compile(r"\$\{([^}:]+)(:-([^}]*))?\}")

def resolve_value(val, depth=0):
    if depth>20: return val
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

out_lines=[]
for line in lines:
    if '${' in line:
        out_lines.append(pat.sub(lambda m: resolve_value(m.group(0)), line))
    else:
        out_lines.append(line)
Path('.env').write_text('\n'.join(out_lines) + '\n')
print('Wrote .env (preserved comments), total lines:', len(out_lines))
