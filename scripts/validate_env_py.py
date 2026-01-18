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

# VIDEO_* variables are optional unless ENABLE_VISUAL_RAG is 'yes'
visual_rag_enabled = env.get('ENABLE_VISUAL_RAG', '').lower() == 'yes'
if visual_rag_enabled:
    if not env.get('VIDEO_FRAME_INTERVAL'):
        missing.append('VIDEO_FRAME_INTERVAL')
    if not env.get('VIDEO_KEYFRAME_DETECTION'):
        missing.append('VIDEO_KEYFRAME_DETECTION')

if missing:
    print('ERROR: required env vars missing or empty:', file=sys.stderr)
    for m in missing:
        print(' -', m, file=sys.stderr)
    sys.exit(3)

# Validate VIDEO_FRAME_INTERVAL is a positive integer
video_frame_interval = env.get('VIDEO_FRAME_INTERVAL', '')
if video_frame_interval:
    try:
        vfi = int(video_frame_interval)
        if vfi < 1:
            print(f"ERROR: VIDEO_FRAME_INTERVAL must be an integer >= 1 (current: {video_frame_interval})", file=sys.stderr)
            sys.exit(6)
    except ValueError:
        print(f"ERROR: VIDEO_FRAME_INTERVAL must be an integer >= 1 (current: {video_frame_interval})", file=sys.stderr)
        sys.exit(6)

# Validate VIDEO_KEYFRAME_DETECTION is 'yes' or 'no'
video_keyframe = env.get('VIDEO_KEYFRAME_DETECTION', '').lower()
if video_keyframe and video_keyframe not in ('yes', 'no'):
    print(f"ERROR: VIDEO_KEYFRAME_DETECTION must be 'yes' or 'no' (current: {env.get('VIDEO_KEYFRAME_DETECTION')})", file=sys.stderr)
    sys.exit(8)

# Check parity
viz_dir = env.get('VISUAL_RAG_INDEX_DIR')
index_dir = env.get('INDEX_DIR')
if viz_dir and viz_dir != index_dir:
    print(f"ERROR: VISUAL_RAG_INDEX_DIR ({viz_dir}) does not match INDEX_DIR ({index_dir}).", file=sys.stderr)
    sys.exit(4)

msg = f"OK: required env vars present: INDEX_DIR={index_dir}, MEDIA_DIR={env.get('MEDIA_DIR')}, VISUAL_RAG_INDEX_NAME={env.get('VISUAL_RAG_INDEX_NAME', env.get('DEFAULT_INDEX_NAME'))}"
if visual_rag_enabled:
    msg += f", VIDEO_FRAME_INTERVAL={env.get('VIDEO_FRAME_INTERVAL')}, VIDEO_KEYFRAME_DETECTION={env.get('VIDEO_KEYFRAME_DETECTION')}"
print(msg)
sys.exit(0)
