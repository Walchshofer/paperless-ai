#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# Source is the repo-root `docker-compose.env`; generate repo-root `.env` for compatibility
SRC="$ROOT_DIR/docker-compose.env"
DST="$ROOT_DIR/.env"

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
# Required variables for validation (safe CI defaults)
INDEX_DIR=/tmp/index
MEDIA_DIR=/tmp/media
DEFAULT_INDEX_NAME=test_index
VIDEO_FRAME_INTERVAL=1
VIDEO_KEYFRAME_DETECTION=yes
# Translation-related fallbacks to exercise translation codepaths in CI
OCR_CHECKPOINT_TRANSLATIONS_ENABLED=yes
TRANSLATION_MIN_CHARS=3
# Note: This is a CI/testing fallback; do not use in production.
EOF
  chmod 600 "$DST"
  echo "Generated fallback $DST" >&2
  exit 0
fi

# Check Bash version - associative arrays require Bash 4+
# macOS ships with Bash 3.2 by default, so we fall back to Node.js if needed
BASH_MAJOR="${BASH_VERSION%%.*}"
if [ "$BASH_MAJOR" -lt 4 ]; then
  echo "INFO: Bash $BASH_VERSION detected (< 4.0). Using Node.js fallback for parsing." >&2
  # Check if Node.js is available
  if ! command -v node &> /dev/null; then
    echo "ERROR: Bash 4+ or Node.js required for env sync. Please install Node.js or upgrade Bash." >&2
    exit 1
  fi
  # Use Node.js to parse and resolve the env file
  node -e "
const fs = require('fs');
const src = process.argv[1];
const dst = process.argv[2];

const content = fs.readFileSync(src, 'utf8');
const kv = {};

// Parse KEY=VALUE lines
for (const line of content.split(/\\r?\\n/)) {
  if (/^\\s*#/.test(line) || !/\\S/.test(line)) continue;
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    let [, key, val] = match;
    // Strip inline comments (whitespace + #)
    val = val.replace(/\\s+#.*$/, '');
    kv[key] = val;
  }
}

// Resolve \${VAR:-fallback} patterns
const resolve = (val) => {
  let prev = '';
  while (val !== prev) {
    prev = val;
    val = val.replace(/\\\$\\{([^}:]+)(?::-([^}]*))?\\}/g, (_, varName, fallback) => {
      if (kv[varName]) return kv[varName];
      if (process.env[varName]) return process.env[varName];
      return fallback || '';
    });
  }
  return val;
};

for (const key of Object.keys(kv)) {
  kv[key] = resolve(kv[key]);
}

// Write output
const header = [
  '# Auto-generated .env (compatibility for legacy docker-compose)',
  '# Generated from: ' + src,
  '# Do not edit directly — edit docker-compose.env and re-run scripts/sync_dotenv_from_compose_env.sh',
  ''
].join('\\n');

const lines = Object.keys(kv).sort().map(k => k + '=' + kv[k]).join('\\n');
fs.writeFileSync(dst, header + lines + '\\n', { mode: 0o600 });
console.log('Generated ' + dst + ' from ' + src + ' (resolved values)');
" "$SRC" "$DST"
  exit 0
fi

# Bash 4+ path: use associative arrays for efficient parsing
declare -A kv_map

# Parse key=value lines (split on first '=') without executing as shell
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip comments and blank lines
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// /}" ]] && continue
  # Match KEY=VALUE pattern (key starts with uppercase letter or underscore)
  if [[ "$line" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    # Strip inline comments: remove ' #...' from end of value
    # Only strip if there's whitespace before the # to preserve # in URLs/passwords
    if [[ "$val" =~ ^(.*[^[:space:]])[[:space:]]+#.*$ ]]; then
      val="${BASH_REMATCH[1]}"
    elif [[ "$val" =~ ^[[:space:]]+#.*$ ]]; then
      val=""
    fi
    kv_map["$key"]="$val"
  fi
done < "$SRC"

# Helper function to resolve ${VAR:-fallback} patterns using the kv_map
resolve_value() {
  local val="$1"
  local prev=""
  # Iterate until no more substitutions are made
  while [[ "$val" != "$prev" ]]; do
    prev="$val"
    # Match ${VAR:-fallback} or ${VAR} patterns
    if [[ "$val" =~ \$\{([^}:]+)(:-([^}]*))?\} ]]; then
      local full_match="${BASH_REMATCH[0]}"
      local var_name="${BASH_REMATCH[1]}"
      local fallback="${BASH_REMATCH[3]:-}"
      local replacement=""
      # Check kv_map first, then environment, then use fallback
      if [[ -n "${kv_map[$var_name]:-}" ]]; then
        replacement="${kv_map[$var_name]}"
      elif [[ -n "${!var_name:-}" ]]; then
        replacement="${!var_name}"
      else
        replacement="$fallback"
      fi
      # Replace only the first occurrence of the pattern
      val="${val/"$full_match"/"$replacement"}"
    fi
  done
  echo "$val"
}

# Resolve all values in kv_map
for key in "${!kv_map[@]}"; do
  kv_map["$key"]="$(resolve_value "${kv_map[$key]}")"
done

# Write header
{
  echo "# Auto-generated .env (compatibility for legacy docker-compose)"
  echo "# Generated from: $SRC"
  echo "# Do not edit directly — edit docker-compose.env and re-run scripts/sync_dotenv_from_compose_env.sh"
  echo
} > "$DST"

# Emit resolved key=value pairs (sorted for deterministic output)
for key in $(echo "${!kv_map[@]}" | tr ' ' '\n' | sort); do
  printf '%s=%s\n' "$key" "${kv_map[$key]}" >> "$DST"
done

chmod 600 "$DST"

echo "Generated $DST from $SRC (resolved values)"
