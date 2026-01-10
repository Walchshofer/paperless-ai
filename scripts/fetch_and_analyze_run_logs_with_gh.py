#!/usr/bin/env python3
"""Download GitHub Actions logs using `gh run download` and analyze them for error snippets.
Usage: python fetch_and_analyze_run_logs_with_gh.py <run_id> [<run_id> ...]

Requires: `gh` CLI installed and authenticated for this user (gh auth login).
"""
import sys, os, re, shutil, subprocess, tempfile
from collections import Counter

ERR_PATTERNS = [re.compile(p, re.I) for p in [r'error[: ]', r'exception', r'traceback', r'failed', r'ERROR:', r'assert', r'AssertionError']]
CONTEXT = 2


def run_gh_download(run_id, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    # Try to find the gh executable; prefer PATH, otherwise fall back to common install locations
    gh_exec = shutil.which('gh')
    if not gh_exec:
        candidates = [r"C:\\Program Files\\GitHub CLI\\gh.exe", r"C:\\Program Files (x86)\\GitHub CLI\\gh.exe", "/usr/bin/gh", "/usr/local/bin/gh"]
        for p in candidates:
            if os.path.exists(p):
                gh_exec = p
                break
    if not gh_exec:
        print('ERROR: gh CLI not found. Please install and authenticate with `gh auth login`.', file=sys.stderr)
        return False, None

    # First, fetch the combined logs for the run via `gh run view --log`
    view_cmd = [gh_exec, 'run', 'view', str(run_id), '--repo', 'Walchshofer/paperless-ai', '--log']
    print('Running:', ' '.join(view_cmd))
    # capture bytes to avoid encoding errors, decode with utf-8 and replace errors
    p = subprocess.run(view_cmd, capture_output=True)
    stdout_bytes = p.stdout
    stderr_bytes = p.stderr
    if p.returncode != 0:
        stdout_decoded = stdout_bytes.decode('utf-8', errors='replace') if stdout_bytes else ''
        stderr_decoded = stderr_bytes.decode('utf-8', errors='replace') if stderr_bytes else ''
        print(f'gh returned {p.returncode} for run view. stdout:\n{stdout_decoded}\nstderr:\n{stderr_decoded}', file=sys.stderr)
        # Attempt to fallback to downloading artifacts (if any)
        download_cmd = [gh_exec, 'run', 'download', str(run_id), '--repo', 'Walchshofer/paperless-ai', '--dir', out_dir]
        print('Attempting artifacts download with:', ' '.join(download_cmd))
        q = subprocess.run(download_cmd, capture_output=True)
        if q.returncode != 0:
            qout = q.stdout.decode('utf-8', errors='replace') if q.stdout else ''
            qerr = q.stderr.decode('utf-8', errors='replace') if q.stderr else ''
            print(f'gh download returned {q.returncode}. stdout:\n{qout}\nstderr:\n{qerr}', file=sys.stderr)
            return False, None
        files = []
        for root, dirs, filenames in os.walk(out_dir):
            for f in filenames:
                files.append(os.path.join(root, f))
        return True, files
    # Write stdout to a combined log file
    combined = os.path.join(out_dir, 'combined.log')
    decoded = stdout_bytes.decode('utf-8', errors='replace') if stdout_bytes else ''
    with open(combined, 'w', encoding='utf-8') as fh:
        fh.write(decoded)
    return True, [combined]


def analyze_files(files):
    results = []
    for path in files:
        # skip large binary files heuristically
        if os.path.getsize(path) > 5 * 1024 * 1024:
            continue
        try:
            with open(path, 'r', encoding='utf-8', errors='replace') as fh:
                lines = fh.readlines()
        except Exception:
            continue
        for i, line in enumerate(lines):
            for p in ERR_PATTERNS:
                if p.search(line):
                    start = max(0, i - CONTEXT)
                    end = min(len(lines), i + CONTEXT + 1)
                    snippet = ''.join(lines[start:end]).strip()
                    results.append((path, i+1, snippet))
                    break
    return results


def main():
    if len(sys.argv) < 2:
        print('Usage: python fetch_and_analyze_run_logs_with_gh.py <run_id> [<run_id> ...]')
        sys.exit(1)
    run_ids = sys.argv[1:]
    per_run = {}
    for rid in run_ids:
        out_dir = os.path.abspath(os.path.join('logs', str(rid)))
        if os.path.exists(out_dir):
            shutil.rmtree(out_dir)
        print('\n=== Processing run', rid, '===')
        ok, files = run_gh_download(rid, out_dir)
        if not ok:
            print('Failed to download logs for run', rid)
            continue
        print(f'Downloaded {len(files)} files for run {rid}')
        snippets = analyze_files(files)
        print(f'Found {len(snippets)} error-like snippets in run {rid}')
        per_run[rid] = snippets
    # Summarize
    print('\n--- Per-run summary ---')
    common_msgs = {}
    for rid, snippets in per_run.items():
        print(f'Run {rid}: {len(snippets)} error snippets')
        seen_texts = set()
        for path, lineno, snippet in snippets[:30]:
            txt = ' '.join(line.strip() for line in snippet.splitlines())
            print(f'- {os.path.relpath(path)}:{lineno}: {txt[:400]}')
            seen_texts.add(txt)
        for t in seen_texts:
            common_msgs.setdefault(t, set()).add(rid)
    # Cross-run comparison
    multi = {t: rs for t, rs in common_msgs.items() if len(rs) > 1}
    print('\n--- Messages appearing in multiple runs ---')
    if not multi:
        print('None found')
    else:
        for t, rs in sorted(multi.items(), key=lambda kv: -len(kv[1])):
            print(f'- Appears in {len(rs)} runs: runs={sorted(rs)}: {t[:300]}')

if __name__ == '__main__':
    main()
