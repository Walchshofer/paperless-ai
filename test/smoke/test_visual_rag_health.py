import os
import sys
import requests

VISUAL_RAG_URL = os.getenv('VISUAL_RAG_URL', 'http://localhost:8001')


def main():
    try:
        r = requests.get(f"{VISUAL_RAG_URL}/health", timeout=5)
        r.raise_for_status()
    except Exception as e:
        print(f"ERROR: failed to fetch /health from {VISUAL_RAG_URL}: {e}")
        sys.exit(2)

    j = r.json()
    required = ['model_loaded', 'index_resolved_path', 'hf_hub_offline_mode']
    missing = [k for k in required if k not in j]
    if missing:
        print("ERROR: missing keys in /health:", missing)
        print(j)
        sys.exit(3)

    # Basic content checks
    index_path = j.get('index_resolved_path', '')
    if not index_path:
        print("ERROR: index_resolved_path is empty")
        sys.exit(4)

    hf_mode = j.get('hf_hub_offline_mode')
    if not isinstance(hf_mode, bool):
        print("ERROR: hf_hub_offline_mode is not boolean: ", hf_mode)
        sys.exit(5)

    print('OK: visual-rag /health looks good:', j)


if __name__ == '__main__':
    main()
