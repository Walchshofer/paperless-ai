#!/usr/bin/env bash
set -euo pipefail

# Verify Flash Attention presence by measuring GPU memory delta during a PDF processing request
# Usage: ./verify_flash_attn_vram.sh [SERVICE_URL] [PDF_URL] [POLL_INTERVAL]
# Example: ./verify_flash_attn_vram.sh http://localhost:8001/process_pdf https://example.com/large.pdf 0.5

SERVICE_URL="${1:-http://localhost:8001/process_pdf}"
PDF_URL="${2:-https://example.com/large_multipage.pdf}"
INTERVAL="${3:-0.5}"
OUT="/tmp/verify_flash_attn_samples_$$.log"
RESP="/tmp/verify_flash_attn_response_$$.json"

if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "nvidia-smi is not available on this machine; cannot measure GPU memory." >&2
  exit 2
fi

echo "Starting GPU memory sampling every ${INTERVAL}s. Service: ${SERVICE_URL}, PDF: ${PDF_URL}"

# Start background sampler
peak=0
( while true; do
    m=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | tr -d ' ' | head -n1 || echo 0)
    echo "$(date +%s.%3N) $m" >> "$OUT"
    sleep "$INTERVAL"
done ) &
SAMPLER_PID=$!

START_TS=$(date +%s.%3N)
# Trigger service request (adjust payload/endpoint to match your API)
curl -s -X POST -H "Content-Type: application/json" -d "{\"pdf_url\":\"${PDF_URL}\"}" "${SERVICE_URL}" > "$RESP" || true
END_TS=$(date +%s.%3N)

# Allow a second for GPU to quiesce then stop sampler
sleep 1
kill "$SAMPLER_PID" 2>/dev/null || true

# Compute peak
if [ -f "$OUT" ]; then
  FINAL_PEAK=$(awk '{ if ($2+0 > m+0) m=$2 } END { print (m+0) }' "$OUT" || echo 0)
else
  FINAL_PEAK=0
fi

echo "Start: ${START_TS}  End: ${END_TS}"
echo "Peak GPU memory (MiB): ${FINAL_PEAK}"
echo "Response saved to ${RESP}"

echo "Sample log: ${OUT}"

exit 0
