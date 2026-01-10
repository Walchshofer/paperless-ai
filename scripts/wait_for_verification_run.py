#!/usr/bin/env python3
import subprocess, time, json, sys
workflow='verification-fast'
branch='fix/ci-load-env'
repo='Walchshofer/paperless-ai'
limit_minutes=10
deadline=time.time()+limit_minutes*60
print(f'Waiting up to {limit_minutes} minutes for {workflow} on branch {branch}...')
while time.time()<deadline:
    try:
        p = subprocess.run(['C:\\Program Files\\GitHub CLI\\gh.exe','run','list','--repo',repo,'--workflow',workflow,'--branch',branch,'--json','name,headBranch,status,conclusion,createdAt,url','-L','5'], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        print('gh CLI not found; exiting', file=sys.stderr); sys.exit(2)
    out = p.stdout.strip()
    if not out or out == '[]':
        print('No runs found yet; sleeping 10s')
        time.sleep(10); continue
    try:
        arr=json.loads(out)
    except Exception as e:
        print('Failed to parse gh output:', e, 'raw:', out)
        time.sleep(10); continue
    # pick the most recent run
    run=arr[0]
    print(f"Run {run.get('url')} status={run.get('status')} conclusion={run.get('conclusion')}")
    if run.get('status')=='completed':
        if run.get('conclusion')=='success':
            print('SUCCESS: verification-fast completed successfully')
            sys.exit(0)
        else:
            print('COMPLETED but not successful: conclusion=', run.get('conclusion'))
            sys.exit(1)
    time.sleep(10)
print('Timeout waiting for workflow run to complete')
sys.exit(2)
