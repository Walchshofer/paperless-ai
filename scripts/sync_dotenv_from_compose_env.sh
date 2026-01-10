#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT_DIR/../paperless-ngx/docker-compose.env"
DST="$(dirname "$SRC")/.env"

if [ ! -f "$SRC" ]; then
  echo "ERROR: source env file not found at $SRC" >&2
  exit 2
fi

# We want the generated .env to contain resolved values (no ${VAR:-fallback} expressions)
# Strategy: source the cleaned env file in a subshell so shell expansion (including fallback)
# is applied, then write the selected keys and their resolved values to the destination file.

tmp_keys=$(mktemp)
# Extract candidate keys (simple A-Z0-9_ names with '=')
grep -v '^#' "$SRC" | sed '/^[[:space:]]*$/d' | awk -F= '/^[A-Z_][A-Z0-9_]+=/{print $1}' | sort -u > "$tmp_keys"

# Source the env file in a clean environment so expansions are applied as the shell would.
set -a
# shellcheck disable=SC1090
source <(grep -v '^#' "$SRC" | sed '/^[[:space:]]*$/d')
set +a

# Write header
{
  echo "# Auto-generated .env (compatibility for legacy docker-compose)"
  echo "# Generated from: $SRC"
  echo "# Do not edit directly — edit docker-compose.env and re-run scripts/sync_dotenv_from_compose_env.sh"
  echo
} > "$DST"

# Emit resolved key=value pairs for the detected keys
while read -r key; do
  # Use indirect expansion to get resolved value (may be empty)
  val="${!key:-}"
  # Ensure values containing newlines are quoted safely
  # We'll output as KEY=VALUE (without additional quoting) — this matches docker-compose .env format
  printf '%s=%s
' "$key" "$val" >> "$DST"
done < "$tmp_keys"

chmod 600 "$DST"
rm -f "$tmp_keys"

echo "Generated $DST from $SRC (resolved values)"
