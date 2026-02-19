#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

NODE_BIN=""
if command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
elif command -v node.exe >/dev/null 2>&1; then
  NODE_BIN="node.exe"
fi

if [ -z "$NODE_BIN" ]; then
  echo "ERROR: Node.js is required to run env sync." >&2
  exit 1
fi

SCRIPT_PATH="$ROOT_DIR/scripts/sync_dotenv_from_compose_env.js"
if [ "$NODE_BIN" = "node.exe" ]; then
  if command -v wslpath >/dev/null 2>&1; then
    SCRIPT_PATH="$(wslpath -w "$SCRIPT_PATH")"
  elif command -v cygpath >/dev/null 2>&1; then
    SCRIPT_PATH="$(cygpath -w "$SCRIPT_PATH")"
  fi
fi

"$NODE_BIN" "$SCRIPT_PATH"
