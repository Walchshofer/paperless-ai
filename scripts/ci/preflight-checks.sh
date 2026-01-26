#!/usr/bin/env bash
# CI preflight checks for Visual-RAG and Qdrant, with exponential backoff and diagnostics.
# Usage: bash scripts/ci/preflight-checks.sh --timeout 300

set -euo pipefail
: ${TIMEOUT:=300}
: ${INITIAL_WAIT:=5}
: ${MAX_WAIT:=30}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --timeout) TIMEOUT="$2"; shift 2;;
    --initial) INITIAL_WAIT="$2"; shift 2;;
    --max) MAX_WAIT="$2"; shift 2;;
    --help) echo "Usage: $0 [--timeout seconds] [--initial seconds] [--max seconds]"; exit 0;;
    *) shift;;
  esac
done

START=$(date +%s)
ATTEMPT=0
WAIT=$INITIAL_WAIT

VISUAL_RAG_URL=${VISUAL_RAG_URL:-http://127.0.0.1:8001}
QDRANT_URL=${QDRANT_URL:-http://127.0.0.1:6333}
TEXT_RAG_URL=${TEXT_RAG_URL:-http://127.0.0.1:8004}

fail_and_dump() {
  echo "\n--- PRELFIGHT FAILURE DIAGNOSTICS ---"
  echo "Elapsed: $(( $(date +%s) - START ))s, attempts: $ATTEMPT"
  echo "VERIFY JSON:" || true
  if [ -f scripts/verify_services.json ]; then
    cat scripts/verify_services.json || true
  fi
  echo "\nDOCKER PS:"
  if command -v docker >/dev/null 2>&1; then
    docker ps -a --no-trunc || true
    echo "\nTAIL visual_rag logs:" || true
    docker logs visual_rag --tail 200 || true
    echo "\nTAIL qdrant logs:" || true
    docker logs paperless_qdrant --tail 200 || true
  else
    echo "docker not available in this runner; skipping container logs"
  fi
  echo "--- END DIAGNOSTICS ---\n"
}

while true; do
  ATTEMPT=$((ATTEMPT+1))
  echo "[preflight] Attempt #$ATTEMPT: running scripts/verify_services.py"
  set +e
  python3 scripts/verify_services.py > /dev/null 2>&1
  RC=$?
  set -e

  if [ $RC -eq 0 ]; then
    echo "[preflight] All services reported as healthy"
    exit 0
  fi

  NOW=$(date +%s)
  ELAPSED=$((NOW-START))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "[preflight] Timeout reached after $ELAPSED seconds (timeout=$TIMEOUT). Giving up."
    fail_and_dump
    exit 2
  fi

  echo "[preflight] Services not ready yet (rc=$RC). Sleeping $WAIT seconds and retrying..."
  sleep $WAIT
  WAIT=$(( WAIT*2 ))
  if [ $WAIT -gt $MAX_WAIT ]; then WAIT=$MAX_WAIT; fi
done
