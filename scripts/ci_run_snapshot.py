#!/usr/bin/env python3
"""Fetch a snapshot of GitHub Actions runs for this repo and filter for validate-env and verification-fast on main."""
import os
import sys
import json
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
    print(f"HTTP error: {e.code} {e.reason}", file=sys.stderr)
    sys.exit(2)
except URLError as e:
    print(f"Network error: {e.reason}", file=sys.stderr)
    sys.exit(2)
except Exception as e:
    print(f"Unexpected error: {e}", file=sys.stderr)
    sys.exit(2)

try:
    data = json.loads(body)
except Exception as e:
    print(f"Failed to parse JSON: {e}", file=sys.stderr)
    sys.exit(2)

runs = data.get("workflow_runs", [])
matches = [r for r in runs if r.get("name") in ("validate-env", "verification-fast") and r.get("head_branch") == "main"]
if not matches:
    print("No matching runs found")
    sys.exit(0)

for r in matches:
    print(f"- [{r.get('id')}] {r.get('name')} status={r.get('status')} conclusion={r.get('conclusion')} created={r.get('created_at')} url={r.get('html_url')}")

sys.exit(0)
