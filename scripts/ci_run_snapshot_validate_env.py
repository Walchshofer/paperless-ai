#!/usr/bin/env python3
"""Fetch GitHub Actions runs for validate-env on main and summarize status."""
import os, sys, json
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

REPO = "Walchshofer/paperless-ai"
URL = f"https://api.github.com/repos/{REPO}/actions/runs?per_page=100"
HEADERS = {"User-Agent": "paperless-ai-monitor"}
TOKEN = os.environ.get("GITHUB_TOKEN")
if TOKEN:
    HEADERS["Authorization"] = f"token {TOKEN}"

req = Request(URL, headers=HEADERS)
try:
    with urlopen(req, timeout=15) as resp:
        body = resp.read().decode('utf-8')
except HTTPError as e:
    print(f"HTTP error: {e.code} {e.reason}", file=sys.stderr); sys.exit(2)
except URLError as e:
    print(f"Network error: {e.reason}", file=sys.stderr); sys.exit(2)
except Exception as e:
    print(f"Unexpected error: {e}", file=sys.stderr); sys.exit(2)

try:
    data = json.loads(body)
except Exception as e:
    print(f"Failed to parse JSON: {e}", file=sys.stderr); sys.exit(2)

runs = data.get('workflow_runs', [])
val_runs = [r for r in runs if r.get('name') == 'validate-env' and r.get('head_branch') == 'main']
if not val_runs:
    print('No validate-env runs found on main')
    sys.exit(0)

# Sort by created_at desc
val_runs.sort(key=lambda r: r.get('created_at'), reverse=True)
for r in val_runs[:25]:
    print(f"- [{r.get('id')}] status={r.get('status')} conclusion={r.get('conclusion')} created={r.get('created_at')} url={r.get('html_url')}")

# Summary counts
from collections import Counter
ctr = Counter((r.get('conclusion') or 'none') for r in val_runs)
print('\nSummary:')
for k,v in ctr.items():
    print(f"- {k}: {v}")

sys.exit(0)
