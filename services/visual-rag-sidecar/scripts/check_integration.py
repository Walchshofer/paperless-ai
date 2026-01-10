#!/usr/bin/env python3
"""Integration check for Visual RAG sidecar (VRAM + Retrieval smoke tests)

Usage: python scripts/check_integration.py [--base-url http://localhost:8001]

Performs:
- nvidia-smi VRAM check (best-effort)
- Calls /vram endpoint
- Performs simple search for term 'Invoice total table' (no-op if model not ready)
"""

import argparse
import json
import os
import subprocess
import sys
from urllib.parse import urljoin

import requests


def nvidia_smi():
    try:
        out = subprocess.check_output(["nvidia-smi", "--query-gpu=memory.used,memory.total,utilization.gpu", "--format=csv,noheader,nounits"], stderr=subprocess.STDOUT)
        lines = out.decode().strip().splitlines()
        return lines
    except Exception as e:
        return f"nvidia-smi not available: {e}"


def call_vram(base_url):
    try:
        r = requests.get(urljoin(base_url, "/vram"), timeout=5)
        return r.status_code, r.json()
    except Exception as e:
        return None, {"error": str(e)}


def call_search(base_url):
    try:
        r = requests.post(urljoin(base_url, "/search"), json={"query": "Invoice total table", "k": 3}, timeout=8)
        return r.status_code, r.json() if r.status_code == 200 else {"error": r.text}
    except Exception as e:
        return None, {"error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.getenv("VISUAL_RAG_BASE_URL", "http://localhost:8001"))
    args = parser.parse_args()

    print("Running local integration checks against:", args.base_url)
    print("nvidia-smi:")
    print(nvidia_smi())

    status, vram = call_vram(args.base_url)
    print("vram endpoint:", status)
    print(json.dumps(vram, indent=2))

    status, sr = call_search(args.base_url)
    print("search endpoint:", status)
    print(json.dumps(sr, indent=2))


if __name__ == "__main__":
    main()
