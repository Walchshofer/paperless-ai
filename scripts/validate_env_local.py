#!/usr/bin/env python3
from pathlib import Path
text=Path('.env').read_text()
lines=[l for l in text.splitlines() if l.strip() and not l.strip().startswith('#')]
vars={}
for line in lines:
    if '=' in line:
        k,v=line.split('=',1)
        # strip inline comments after a ' #' or '\t#' pattern
        if ' #' in v:
            v = v.split(' #',1)[0]
        if '\t#' in v:
            v = v.split('\t#',1)[0]
        vars[k]=v.strip()
# validate
missing=[]
if not vars.get('INDEX_DIR'):
    missing.append('INDEX_DIR')
if not vars.get('MEDIA_DIR'):
    missing.append('MEDIA_DIR')
if not (vars.get('VISUAL_RAG_INDEX_NAME') or vars.get('DEFAULT_INDEX_NAME')):
    missing.append('VISUAL_RAG_INDEX_NAME|DEFAULT_INDEX_NAME')
# VIDEO_FRAME_INTERVAL
vfi=vars.get('VIDEO_FRAME_INTERVAL')
if not vfi:
    missing.append('VIDEO_FRAME_INTERVAL')
else:
    try:
        if int(vfi) < 1:
            missing.append('VIDEO_FRAME_INTERVAL_INVALID')
    except:
        missing.append('VIDEO_FRAME_INTERVAL_INVALID')
# VIDEO_KEYFRAME_DETECTION
vkd=vars.get('VIDEO_KEYFRAME_DETECTION')
if not vkd:
    missing.append('VIDEO_KEYFRAME_DETECTION')
else:
    if vkd.lower() not in ('yes','no'):
        missing.append('VIDEO_KEYFRAME_DETECTION_INVALID')
# VISUAL_RAG_INDEX_DIR consistency
if vars.get('VISUAL_RAG_INDEX_DIR') and vars.get('VISUAL_RAG_INDEX_DIR') != vars.get('INDEX_DIR'):
    missing.append('VISUAL_RAG_INDEX_DIR_MISMATCH')
if missing:
    print('ERROR: required env vars missing or invalid:')
    for m in missing:
        print(' -',m)
    raise SystemExit(1)
print(f"OK: required env vars present: INDEX_DIR={vars.get('INDEX_DIR')}, MEDIA_DIR={vars.get('MEDIA_DIR')}, VISUAL_RAG_INDEX_NAME={vars.get('VISUAL_RAG_INDEX_NAME') or vars.get('DEFAULT_INDEX_NAME')}, VIDEO_FRAME_INTERVAL={vars.get('VIDEO_FRAME_INTERVAL')}, VIDEO_KEYFRAME_DETECTION={vars.get('VIDEO_KEYFRAME_DETECTION')}")
