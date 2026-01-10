#!/usr/bin/env python3
"""Download and analyze GitHub Actions logs for given run IDs.
Usage: python fetch_and_analyze_run_logs.py <run_id> [<run_id> ...]

The script fetches the logs zip for each run, extracts it to a temp dir, searches for error-like lines and common failure signatures,
then prints a per-run summary and a cross-run comparison of common messages.
"""
import sys, os, json, tempfile, zipfile, re
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

REPO = os.environ.get('GITHUB_REPO','Walchshofer/paperless-ai')
TOKEN = os.environ.get('GITHUB_TOKEN')
HEADERS = {'User-Agent': 'paperless-ai-log-fetcher'}
if TOKEN:
    HEADERS['Authorization'] = f'token {TOKEN}'

ERR_PATTERNS = [re.compile(p, re.I) for p in [r'error[: ]', r'exception', r'traceback', r'failed', r'ERROR:', r'assert', r'ERROR', r'AssertionError']]
CONTEXT = 2


def fetch_logs_zip(run_id):
    url = f'https://api.github.com/repos/{REPO}/actions/runs/{run_id}/logs'
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=30) as resp:
            data = resp.read()
            return data
    except HTTPError as e:
        print(f'HTTP error when fetching logs for {run_id}: {e.code} {e.reason}', file=sys.stderr)
    except URLError as e:
        print(f'Network error when fetching logs for {run_id}: {e.reason}', file=sys.stderr)
    except Exception as e:
        print(f'Unexpected error when fetching logs for {run_id}: {e}', file=sys.stderr)
    return None


def analyze_run(run_id, data):
    results = []
    with tempfile.TemporaryDirectory() as td:
        zpath = os.path.join(td, f'{run_id}.zip')
        with open(zpath, 'wb') as f:
            f.write(data)
        try:
            with zipfile.ZipFile(zpath, 'r') as z:
                z.extractall(td)
        except zipfile.BadZipFile:
            print(f'Bad zip file for run {run_id}', file=sys.stderr)
            return results
        # Walk files
        for root, dirs, files in os.walk(td):
            for fn in files:
                path = os.path.join(root, fn)
                # Skip binarys heuristically
                try:
                    with open(path, 'r', encoding='utf-8', errors='replace') as fh:
                        lines = fh.readlines()
                except Exception:
                    continue
                for i, line in enumerate(lines):
                    for p in ERR_PATTERNS:
                        if p.search(line):
                            start = max(0, i-CONTEXT)
                            end = min(len(lines), i+CONTEXT+1)
                            snippet = ''.join(lines[start:end]).strip()
                            results.append((path[len(td)+1:].lstrip('\\/'), i+1, snippet))
                            break
    return results


def main():
    if len(sys.argv) < 2:
        print('Usage: python fetch_and_analyze_run_logs.py <run_id> [<run_id> ...]')
        sys.exit(1)
    run_ids = sys.argv[1:]
    per_run = {}
    for rid in run_ids:
        print(f'Fetching logs for run {rid}...')
        data = fetch_logs_zip(rid)
        if not data:
            print(f'  Failed to fetch logs for {rid}')
            continue
        print(f'  Analyzing logs for run {rid}...')
        res = analyze_run(rid, data)
        per_run[rid] = res
        print(f'  Found {len(res)} error-like snippets in run {rid}')
    # Summarize
    print('\n--- Per-run summary ---')
    common_msgs = {}
    for rid, snippets in per_run.items():
        print(f'Run {rid}: {len(snippets)} error snippets')
        seen_texts = set()
        for path, lineno, snippet in snippets[:20]:
            # Normalize message
            txt = ' '.join(line.strip() for line in snippet.splitlines())
            print(f'- {path}:{lineno}: {txt[:400]}')
            seen_texts.add(txt)
        for t in seen_texts:
            common_msgs.setdefault(t, set()).add(rid)
    # Compute messages common to multiple runs
    multi = {t: rs for t, rs in common_msgs.items() if len(rs) > 1}
    print('\n--- Messages appearing in multiple runs ---')
    if not multi:
        print('None found')
    else:
        for t, rs in sorted(multi.items(), key=lambda kv: -len(kv[1])):
            print(f'- Appears in {len(rs)} runs: runs={sorted(rs)}: {t[:300]}')

if __name__ == '__main__':
    main()
