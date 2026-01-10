#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT_DIR/../paperless-ngx/docker-compose.env"
DST="$(dirname "$SRC")/.env"

if [ ! -f "$SRC" ]; then
  echo "WARNING: source env file not found at $SRC" >&2
  # In CI environments we prefer to continue with a minimal, safe fallback so tests can run.
  # Create destination directory if missing and emit a minimal .env for CI/testing.
  mkdir -p "$(dirname "$DST")"
  if [ ! -d "$(dirname "$DST")" ]; then
    echo "ERROR: failed to create directory $(dirname "$DST")" >&2
    exit 2
  fi
  cat > "$DST" <<'EOF'
# Auto-generated fallback .env for CI (safe defaults)
POSTGRES_USER=elfman
POSTGRES_PASSWORD=password
POSTGRES_DB=paperless_test
# Translation-related fallbacks to exercise translation codepaths in CI
OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes
TRANSLATION_MIN_CHARS=3
# Note: This is a CI/testing fallback; do not use in production.
EOF
  chmod 600 "$DST"
  echo "Generated fallback $DST" >&2
  exit 0
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
