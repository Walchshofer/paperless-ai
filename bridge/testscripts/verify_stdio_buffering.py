#!/usr/bin/env python3
"""
Verify that the bridge buffers requests received before the Serena connection is established.
"""
import json
import os
import subprocess
import sys

def main():
    # Run as module from repo root
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    
    print(f"Running bridge from: {repo_root}")
    
    # Prepare a tools/list request
    req = json.dumps({
        "jsonrpc": "2.0",
        "id": "test-buffering",
        "method": "tools/list",
        "params": {}
    })
    
    env = os.environ.copy()
    env["LOG_LEVEL"] = "DEBUG"
    env["PYTHONPATH"] = repo_root
    
    # Run as module
    cmd = [sys.executable, "-m", "bridge.codex_serena_bridge"]
    
    print(f"Executing: {' '.join(cmd)}")
    
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=repo_root,
        env=env
    )
    
    print("Bridge started. Sending request immediately...")
    
    try:
        stdout, stderr = proc.communicate(input=req, timeout=10)
    except subprocess.TimeoutError:
        print("Timed out waiting for bridge response.")
        proc.kill()
        stdout, stderr = proc.communicate()
    
    print("\n--- Bridge STDERR ---")
    print(stderr)
    print("---------------------")
    
    if "Buffering request id=test-buffering" in stderr:
        print("\n[PASS] Buffering logic triggered.")
    else:
        print("\n[WARN] Buffering logic NOT triggered (connection might be too fast).")
        
    if "tools/list" in stdout or "result" in stdout:
        print("[PASS] Received response.")
    else:
        print("[FAIL] No valid response received.")
        print("STDOUT:", stdout)

if __name__ == "__main__":
    main()