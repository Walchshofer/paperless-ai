#!/usr/bin/env python3
import os, sys, subprocess
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
path = os.path.join(repo_root, 'prompts', '016-verification-checklist.md')
if not os.path.exists(path):
    print(f'ERROR: file not found: {path}', file=sys.stderr)
    sys.exit(1)
# ensure branch
subprocess.run(['git','checkout','fix/ci-load-env'], check=False)
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()
if 'CI trigger: touch this file' in text:
    print('Trigger already present')
    sys.exit(0)
text += '\n<!-- CI trigger: touch this file to cause verification-fast to run for PR testing -->\n'
with open(path, 'w', encoding='utf-8') as f:
    f.write(text)
# commit and push
subprocess.run(['git','add', path], check=True)
res = subprocess.run(['git','commit','-m','ci: trigger verification-fast run by touching prompt file'], capture_output=True, text=True)
if res.returncode != 0:
    print('No changes to commit or commit failed; stdout:\n', res.stdout, '\nstderr:\n', res.stderr)
else:
    print('Committed change')
subprocess.run(['git','push','origin','HEAD:fix/ci-load-env'], check=False)
print('Pushed change to fix/ci-load-env')
