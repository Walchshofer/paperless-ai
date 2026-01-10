#!/usr/bin/env bash
# Validate that critical env vars in docker-compose.env are present and non-empty
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/../paperless-ngx/docker-compose.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: expected env file at $ENV_FILE" >&2
  exit 2
fi

# Compatibility: legacy `docker-compose` (hyphen) loads a `.env` file from the compose dir
# If it is missing, auto-generate it from the authoritative `docker-compose.env` so users
# who run `docker-compose` (old client) won't see missing-variable warnings.
DOT_ENV="$(dirname "$ENV_FILE")/.env"
if [ ! -f "$DOT_ENV" ]; then
  echo "WARN: $DOT_ENV not found; generating from $ENV_FILE to ensure 'docker-compose' interpolation works."
  # Generate a compatibility `.env` from the authoritative `docker-compose.env`.
  # This keeps `docker-compose.env` as the single source of truth.
  "$ROOT_DIR/scripts/sync_dotenv_from_compose_env.sh" || echo "FAILED: could not generate $DOT_ENV — please run scripts/sync_dotenv_from_compose_env.sh manually."
fi

# Load env (ignores comments)
set -a
# shellcheck disable=SC1090
source <(grep -v '^#' "$ENV_FILE" | sed '/^[[:space:]]*$/d')
set +a

missing=()
check_nonempty() {
  local name="$1"
  local val="${!name:-}"  # indirect expansion (requires set -u guard earlier)
  if [ -z "$val" ]; then
    missing+=("$name")
  fi
}

# Required variables for Visual RAG and media mapping
check_nonempty "INDEX_DIR"
# At least one index-name variable must be present
if [ -z "${VISUAL_RAG_INDEX_NAME:-}" ] && [ -z "${DEFAULT_INDEX_NAME:-}" ]; then
  missing+=("VISUAL_RAG_INDEX_NAME|DEFAULT_INDEX_NAME")
fi
check_nonempty "MEDIA_DIR"

if [ ${#missing[@]} -ne 0 ]; then
  echo "ERROR: required env vars missing or empty:" >&2
  for m in "${missing[@]}"; do
    echo "  - $m" >&2
  done
  echo
  echo "Please set these variables in paperless-ngx/docker-compose.env (or provide overrides via env files)." >&2
  exit 3
fi

# Ensure VISUAL_RAG_INDEX_DIR (if set) aligns with INDEX_DIR to avoid runtime mismatches
if [ -n "${VISUAL_RAG_INDEX_DIR:-}" ] && [ "${VISUAL_RAG_INDEX_DIR}" != "${INDEX_DIR}" ]; then
  echo "ERROR: VISUAL_RAG_INDEX_DIR (${VISUAL_RAG_INDEX_DIR}) does not match INDEX_DIR (${INDEX_DIR}). Align these in paperless-ngx/docker-compose.env." >&2
  exit 4
fi

# Validate video sampling env vars
# VIDEO_FRAME_INTERVAL must be a positive integer (seconds between sampled frames)
if [ -z "${VIDEO_FRAME_INTERVAL:-}" ]; then
  echo "ERROR: VIDEO_FRAME_INTERVAL is not set. Please set VIDEO_FRAME_INTERVAL in paperless-ngx/docker-compose.env (e.g., 1)" >&2
  exit 5
fi
if ! [[ "${VIDEO_FRAME_INTERVAL}" =~ ^[0-9]+$ ]] || [ "${VIDEO_FRAME_INTERVAL}" -lt 1 ]; then
  echo "ERROR: VIDEO_FRAME_INTERVAL must be an integer >= 1 (current: ${VIDEO_FRAME_INTERVAL})" >&2
  exit 6
fi

# VIDEO_KEYFRAME_DETECTION must be 'yes' or 'no'
if [ -z "${VIDEO_KEYFRAME_DETECTION:-}" ]; then
  echo "ERROR: VIDEO_KEYFRAME_DETECTION is not set. Please set VIDEO_KEYFRAME_DETECTION=yes|no in paperless-ngx/docker-compose.env" >&2
  exit 7
fi
vkd_lc="${VIDEO_KEYFRAME_DETECTION,,}"
if [ "${vkd_lc}" != "yes" ] && [ "${vkd_lc}" != "no" ]; then
  echo "ERROR: VIDEO_KEYFRAME_DETECTION must be 'yes' or 'no' (current: ${VIDEO_KEYFRAME_DETECTION})" >&2
  exit 8
fi

echo "OK: required env vars present: INDEX_DIR=${INDEX_DIR}, MEDIA_DIR=${MEDIA_DIR}, VISUAL_RAG_INDEX_NAME=${VISUAL_RAG_INDEX_NAME:-$DEFAULT_INDEX_NAME}, VIDEO_FRAME_INTERVAL=${VIDEO_FRAME_INTERVAL}, VIDEO_KEYFRAME_DETECTION=${VIDEO_KEYFRAME_DETECTION}"