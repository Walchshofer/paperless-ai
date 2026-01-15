#!/usr/bin/env python3
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / 'docker-compose.env'
FALLBACK_ENV = ROOT / '.env'
if not ENV_FILE.exists():
    if FALLBACK_ENV.exists():
        print(f"WARNING: source env file not found at {ENV_FILE}; using fallback {FALLBACK_ENV}", file=sys.stderr)
        ENV_FILE = FALLBACK_ENV
    else:
        print(f"ERROR: expected env file at {ENV_FILE}", file=sys.stderr)
        sys.exit(2)

# Parse file (ignore comments and empty lines)
env = {}
with ENV_FILE.open() as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' in line:
            k, v = line.split('=', 1)
            # Strip inline comments from values (anything after '#') to allow in-file annotations
            if '#' in v:
                v = v.split('#', 1)[0]
            env[k.strip()] = v.strip()

# Resolve simple ${VAR:-fallback} and ${VAR} style expansions using the parsed env dict
import re
pattern = re.compile(r"\$\{([^}:]+)(?::-([^}]+))?\}")
for key, val in list(env.items()):
    def _repl(m):
        var = m.group(1)
        fallback = m.group(2)
        return env.get(var, fallback if fallback is not None else '')
    env[key] = pattern.sub(_repl, val)
missing = []
if not env.get('INDEX_DIR'):
    missing.append('INDEX_DIR')
if not env.get('MEDIA_DIR'):
    missing.append('MEDIA_DIR')
if not (env.get('VISUAL_RAG_INDEX_NAME') or env.get('DEFAULT_INDEX_NAME')):
    missing.append('VISUAL_RAG_INDEX_NAME|DEFAULT_INDEX_NAME')

if missing:
    print('ERROR: required env vars missing or empty:', file=sys.stderr)
    for m in missing:
        print(' -', m, file=sys.stderr)
    sys.exit(3)

# Check parity
viz_dir = env.get('VISUAL_RAG_INDEX_DIR')
index_dir = env.get('INDEX_DIR')
if viz_dir and viz_dir != index_dir:
    print(f"ERROR: VISUAL_RAG_INDEX_DIR ({viz_dir}) does not match INDEX_DIR ({index_dir}).", file=sys.stderr)
    sys.exit(4)

print(f"OK: required env vars present: INDEX_DIR={index_dir}, MEDIA_DIR={env.get('MEDIA_DIR')}, VISUAL_RAG_INDEX_NAME={env.get('VISUAL_RAG_INDEX_NAME', env.get('DEFAULT_INDEX_NAME'))}")
sys.exit(0)
