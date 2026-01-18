#!/bin/bash
#
# vram-monitor.sh
# Monitor VRAM usage during visual RAG operations
#
# Usage: bash scripts/vram-monitor.sh [duration_seconds] [interval_seconds]
#
# Default: 60 seconds duration, 2 second interval
#
# Requires: nvidia-smi (NVIDIA GPU driver)
#

set -e

DURATION=${1:-60}
INTERVAL=${2:-2}
LOG_FILE="vram-usage-$(date +%Y%m%d-%H%M%S).csv"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Alpha-9 VRAM thresholds (in MB)
BASELINE_MB=3584    # ~3.5GB expected baseline
WARNING_MB=6144     # 6GB warning threshold
CRITICAL_MB=8192    # 8GB critical threshold

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           Alpha-9 VRAM Monitoring Tool                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Check for nvidia-smi
if ! command -v nvidia-smi &> /dev/null; then
  echo -e "${RED}Error: nvidia-smi not found${NC}"
  echo "This script requires an NVIDIA GPU with drivers installed."
  exit 1
fi

# Get GPU info
GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
GPU_MEMORY=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)

echo "GPU: $GPU_NAME"
echo "Total VRAM: ${GPU_MEMORY}MB"
echo "Duration: ${DURATION}s"
echo "Interval: ${INTERVAL}s"
echo "Log file: $LOG_FILE"
echo ""
echo "Thresholds:"
echo "  Baseline: ${BASELINE_MB}MB (~3.5GB)"
echo "  Warning:  ${WARNING_MB}MB (6GB)"
echo "  Critical: ${CRITICAL_MB}MB (8GB)"
echo ""

# Initialize CSV log
echo "timestamp,memory_used_mb,memory_free_mb,memory_total_mb,utilization_pct,status" > "$LOG_FILE"

# Monitoring loop
START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION))
SAMPLE_COUNT=0
PEAK_USAGE=0
TOTAL_USAGE=0

echo "Starting VRAM monitoring..."
echo "Press Ctrl+C to stop early."
echo ""
echo "Time       | Used (MB) | Free (MB) | Status"
echo "-----------|-----------|-----------|--------"

while [ $(date +%s) -lt $END_TIME ]; do
  TIMESTAMP=$(date +%H:%M:%S)

  # Query GPU metrics
  VRAM_USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | head -1)
  VRAM_FREE=$(nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits 2>/dev/null | head -1)
  VRAM_TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
  GPU_UTIL=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1)

  # Determine status
  if [ "$VRAM_USED" -lt "$BASELINE_MB" ]; then
    STATUS="${GREEN}OK${NC}"
    STATUS_LOG="OK"
  elif [ "$VRAM_USED" -lt "$WARNING_MB" ]; then
    STATUS="${YELLOW}WARN${NC}"
    STATUS_LOG="WARN"
  elif [ "$VRAM_USED" -lt "$CRITICAL_MB" ]; then
    STATUS="${YELLOW}HIGH${NC}"
    STATUS_LOG="HIGH"
  else
    STATUS="${RED}CRIT${NC}"
    STATUS_LOG="CRITICAL"
  fi

  # Log to CSV
  echo "$(date -Iseconds),$VRAM_USED,$VRAM_FREE,$VRAM_TOTAL,$GPU_UTIL,$STATUS_LOG" >> "$LOG_FILE"

  # Display
  printf "%s | %9d | %9d | %b\n" "$TIMESTAMP" "$VRAM_USED" "$VRAM_FREE" "$STATUS"

  # Track statistics
  SAMPLE_COUNT=$((SAMPLE_COUNT + 1))
  TOTAL_USAGE=$((TOTAL_USAGE + VRAM_USED))
  if [ "$VRAM_USED" -gt "$PEAK_USAGE" ]; then
    PEAK_USAGE=$VRAM_USED
  fi

  sleep $INTERVAL
done

# Calculate statistics
if [ "$SAMPLE_COUNT" -gt 0 ]; then
  AVG_USAGE=$((TOTAL_USAGE / SAMPLE_COUNT))
else
  AVG_USAGE=0
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                    Monitoring Summary                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Samples collected: $SAMPLE_COUNT"
echo "Peak VRAM usage:   ${PEAK_USAGE}MB"
echo "Average usage:     ${AVG_USAGE}MB"
echo "Log file:          $LOG_FILE"
echo ""

# Verdict
if [ "$PEAK_USAGE" -lt "$BASELINE_MB" ]; then
  echo -e "${GREEN}✅ VRAM usage within Alpha-9 baseline (< 3.5GB)${NC}"
elif [ "$PEAK_USAGE" -lt "$WARNING_MB" ]; then
  echo -e "${YELLOW}⚠️  VRAM usage slightly elevated but acceptable${NC}"
else
  echo -e "${RED}❌ VRAM usage exceeded acceptable thresholds${NC}"
  echo "Consider investigating memory leaks or reducing batch size."
  exit 1
fi
