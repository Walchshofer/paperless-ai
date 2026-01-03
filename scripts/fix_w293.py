"""
Remove trailing whitespace on blank-only lines.
Scans all .py files under the repo (excluding common virtual envs) and replaces
lines that contain only spaces or tabs with an empty newline.

Usage: python scripts/fix_w293.py
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IGNORE_DIRS = {'.git', '__pycache__', 'venv', '.venv', 'env', 'build'}

changed_files = []
for py in ROOT.rglob('*.py'):
    if any(part in IGNORE_DIRS for part in py.parts):
        continue
    text = py.read_text(encoding='utf-8')
    new_text = re.sub(r'^[ \t]+(?=\r?\n)', '', text, flags=re.M)
    if new_text != text:
        py.write_text(new_text, encoding='utf-8')
        changed_files.append(str(py.relative_to(ROOT)))

if changed_files:
    print('Fixed W293 in the following files:')
    for f in changed_files:
        print(' -', f)
else:
    print('No W293 fixes needed.')
