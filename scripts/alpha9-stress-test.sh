#!/bin/bash
# Alpha-9 Visual Search Stress Test
#
# Stress test script for RTX 3090 Ti performance validation.
# Tests concurrent MaxSim lookups and monitors VRAM usage.
#
# Architecture Reference: ticket:007.3
#
# Usage:
#   ./scripts/alpha9-stress-test.sh [OPTIONS]
#
# Options:
#   --url URL           Sidecar URL (default: http://localhost:8001)
#   --api-url URL       API URL (default: http://localhost:3000)
#   --duration SECS     Test duration in seconds (default: 60)
#   --rps-start NUM     Starting requests per second (default: 1)
#   --rps-max NUM       Maximum requests per second (default: 10)
#   --output DIR        Output directory for results (default: ./stress-results)
#   --skip-nvidia       Skip nvidia-smi monitoring
#   --help              Show this help message

set -e

# Default configuration
SIDECAR_URL="${SIDECAR_URL:-http://localhost:8001}"
API_URL="${API_URL:-http://localhost:3000}"
DURATION=60
RPS_START=1
RPS_MAX=10
OUTPUT_DIR="./stress-results"
SKIP_NVIDIA=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            SIDECAR_URL="$2"
            shift 2
            ;;
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --duration)
            DURATION="$2"
            shift 2
            ;;
        --rps-start)
            RPS_START="$2"
            shift 2
            ;;
        --rps-max)
            RPS_MAX="$2"
            shift 2
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --skip-nvidia)
            SKIP_NVIDIA=true
            shift
            ;;
        --help)
            head -30 "$0" | tail -25
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Create output directory
mkdir -p "$OUTPUT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="$OUTPUT_DIR/stress_results_$TIMESTAMP.json"
METRICS_FILE="$OUTPUT_DIR/gpu_metrics_$TIMESTAMP.csv"
REPORT_FILE="$OUTPUT_DIR/stress_report_$TIMESTAMP.md"

# Minimal base64 PNG for testing (1x1 red pixel)
TEST_IMAGE="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

echo "================================================"
echo "Alpha-9 Visual Search Stress Test"
echo "================================================"
echo "Sidecar URL: $SIDECAR_URL"
echo "API URL:     $API_URL"
echo "Duration:    ${DURATION}s"
echo "RPS Range:   $RPS_START - $RPS_MAX"
echo "Output:      $OUTPUT_DIR"
echo "Timestamp:   $TIMESTAMP"
echo "================================================"

# Check sidecar health
echo ""
echo "Checking sidecar health..."
HEALTH=$(curl -s -w "\n%{http_code}" "$SIDECAR_URL/health" 2>/dev/null || echo -e "error\n000")
HTTP_CODE=$(echo "$HEALTH" | tail -1)
HEALTH_BODY=$(echo "$HEALTH" | head -n -1)

if [ "$HTTP_CODE" != "200" ]; then
    echo "ERROR: Sidecar not healthy (HTTP $HTTP_CODE)"
    echo "Response: $HEALTH_BODY"
    exit 1
fi

echo "Sidecar healthy: $HEALTH_BODY"

# Start nvidia-smi monitoring if available
NVIDIA_PID=""
if [ "$SKIP_NVIDIA" = false ] && command -v nvidia-smi &> /dev/null; then
    echo ""
    echo "Starting GPU monitoring..."
    echo "timestamp,gpu_util,memory_used,memory_total,temperature,power" > "$METRICS_FILE"

    (while true; do
        nvidia-smi --query-gpu=timestamp,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw \
            --format=csv,noheader,nounits 2>/dev/null >> "$METRICS_FILE"
        sleep 1
    done) &
    NVIDIA_PID=$!
    echo "GPU monitoring started (PID: $NVIDIA_PID)"
fi

# Initialize results
echo "{" > "$RESULTS_FILE"
echo "  \"config\": {" >> "$RESULTS_FILE"
echo "    \"sidecar_url\": \"$SIDECAR_URL\"," >> "$RESULTS_FILE"
echo "    \"api_url\": \"$API_URL\"," >> "$RESULTS_FILE"
echo "    \"duration\": $DURATION," >> "$RESULTS_FILE"
echo "    \"rps_range\": [$RPS_START, $RPS_MAX]," >> "$RESULTS_FILE"
echo "    \"timestamp\": \"$TIMESTAMP\"" >> "$RESULTS_FILE"
echo "  }," >> "$RESULTS_FILE"
echo "  \"stages\": [" >> "$RESULTS_FILE"

# Run stress test stages
STAGE_NUM=0
TOTAL_REQUESTS=0
TOTAL_SUCCESS=0
TOTAL_FAILURES=0
LATENCIES=""

for RPS in $(seq $RPS_START $RPS_MAX); do
    STAGE_NUM=$((STAGE_NUM + 1))
    STAGE_DURATION=$((DURATION / (RPS_MAX - RPS_START + 1)))

    echo ""
    echo "Stage $STAGE_NUM: $RPS requests/second for ${STAGE_DURATION}s"

    STAGE_START=$(date +%s%N)
    STAGE_SUCCESS=0
    STAGE_FAILURES=0
    STAGE_LATENCIES=()

    # Calculate delay between requests (in ms)
    DELAY_MS=$((1000 / RPS))

    END_TIME=$(($(date +%s) + STAGE_DURATION))

    while [ $(date +%s) -lt $END_TIME ]; do
        # Send request and measure latency
        REQUEST_START=$(date +%s%N)

        RESPONSE=$(curl -s -w "\n%{http_code}\n%{time_total}" \
            -X POST "$API_URL/api/visual-rag/search/visual" \
            -H "Content-Type: application/json" \
            -H "X-Request-Id: stress-$TIMESTAMP-$TOTAL_REQUESTS" \
            -d "{\"image\": \"$TEST_IMAGE\", \"collection\": \"visual_pages\", \"k\": 5}" \
            2>/dev/null || echo -e "error\n000\n0")

        HTTP_CODE=$(echo "$RESPONSE" | tail -2 | head -1)
        LATENCY=$(echo "$RESPONSE" | tail -1)
        LATENCY_MS=$(echo "$LATENCY * 1000" | bc 2>/dev/null || echo "0")

        TOTAL_REQUESTS=$((TOTAL_REQUESTS + 1))

        if [ "$HTTP_CODE" = "200" ]; then
            STAGE_SUCCESS=$((STAGE_SUCCESS + 1))
            TOTAL_SUCCESS=$((TOTAL_SUCCESS + 1))
            STAGE_LATENCIES+=("$LATENCY_MS")
            LATENCIES="$LATENCIES $LATENCY_MS"
        else
            STAGE_FAILURES=$((STAGE_FAILURES + 1))
            TOTAL_FAILURES=$((TOTAL_FAILURES + 1))
        fi

        # Delay before next request
        sleep "0.${DELAY_MS}s" 2>/dev/null || sleep 0.1s
    done

    # Calculate stage statistics
    STAGE_END=$(date +%s%N)
    STAGE_ELAPSED=$(( (STAGE_END - STAGE_START) / 1000000 ))

    # Calculate percentiles (simplified)
    if [ ${#STAGE_LATENCIES[@]} -gt 0 ]; then
        SORTED_LATENCIES=($(printf '%s\n' "${STAGE_LATENCIES[@]}" | sort -n))
        P50_IDX=$(( ${#SORTED_LATENCIES[@]} / 2 ))
        P95_IDX=$(( ${#SORTED_LATENCIES[@]} * 95 / 100 ))
        P99_IDX=$(( ${#SORTED_LATENCIES[@]} * 99 / 100 ))

        P50="${SORTED_LATENCIES[$P50_IDX]:-0}"
        P95="${SORTED_LATENCIES[$P95_IDX]:-0}"
        P99="${SORTED_LATENCIES[$P99_IDX]:-0}"
    else
        P50=0
        P95=0
        P99=0
    fi

    # Write stage results
    if [ $STAGE_NUM -gt 1 ]; then
        echo "," >> "$RESULTS_FILE"
    fi

    echo "    {" >> "$RESULTS_FILE"
    echo "      \"stage\": $STAGE_NUM," >> "$RESULTS_FILE"
    echo "      \"rps\": $RPS," >> "$RESULTS_FILE"
    echo "      \"duration_ms\": $STAGE_ELAPSED," >> "$RESULTS_FILE"
    echo "      \"requests\": $((STAGE_SUCCESS + STAGE_FAILURES))," >> "$RESULTS_FILE"
    echo "      \"success\": $STAGE_SUCCESS," >> "$RESULTS_FILE"
    echo "      \"failures\": $STAGE_FAILURES," >> "$RESULTS_FILE"
    echo "      \"latency_p50_ms\": $P50," >> "$RESULTS_FILE"
    echo "      \"latency_p95_ms\": $P95," >> "$RESULTS_FILE"
    echo "      \"latency_p99_ms\": $P99" >> "$RESULTS_FILE"
    echo -n "    }" >> "$RESULTS_FILE"

    echo "  Success: $STAGE_SUCCESS, Failures: $STAGE_FAILURES, p50: ${P50}ms, p95: ${P95}ms"
done

# Close JSON
echo "" >> "$RESULTS_FILE"
echo "  ]," >> "$RESULTS_FILE"
echo "  \"summary\": {" >> "$RESULTS_FILE"
echo "    \"total_requests\": $TOTAL_REQUESTS," >> "$RESULTS_FILE"
echo "    \"total_success\": $TOTAL_SUCCESS," >> "$RESULTS_FILE"
echo "    \"total_failures\": $TOTAL_FAILURES," >> "$RESULTS_FILE"
echo "    \"success_rate\": $(echo "scale=4; $TOTAL_SUCCESS / $TOTAL_REQUESTS * 100" | bc 2>/dev/null || echo "0")" >> "$RESULTS_FILE"
echo "  }" >> "$RESULTS_FILE"
echo "}" >> "$RESULTS_FILE"

# Stop nvidia-smi monitoring
if [ -n "$NVIDIA_PID" ]; then
    kill $NVIDIA_PID 2>/dev/null || true
    echo ""
    echo "GPU monitoring stopped"
fi

# Generate report
echo ""
echo "Generating report..."

cat > "$REPORT_FILE" << EOF
# Alpha-9 Visual Search Stress Test Report

**Timestamp:** $TIMESTAMP
**Hardware Target:** RTX 3090 Ti (24GB VRAM)

## Configuration

| Parameter | Value |
|-----------|-------|
| Sidecar URL | $SIDECAR_URL |
| API URL | $API_URL |
| Duration | ${DURATION}s |
| RPS Range | $RPS_START - $RPS_MAX |

## Summary

| Metric | Value |
|--------|-------|
| Total Requests | $TOTAL_REQUESTS |
| Successful | $TOTAL_SUCCESS |
| Failed | $TOTAL_FAILURES |
| Success Rate | $(echo "scale=2; $TOTAL_SUCCESS / $TOTAL_REQUESTS * 100" | bc 2>/dev/null || echo "0")% |

## Results by Stage

See \`stress_results_$TIMESTAMP.json\` for detailed metrics.

## GPU Metrics

$(if [ -f "$METRICS_FILE" ] && [ "$SKIP_NVIDIA" = false ]; then
    echo "See \`gpu_metrics_$TIMESTAMP.csv\` for GPU utilization data."
    echo ""
    echo "### VRAM Summary"
    echo ""
    echo "| Metric | Value |"
    echo "|--------|-------|"
    if [ -s "$METRICS_FILE" ]; then
        AVG_MEM=$(tail -n +2 "$METRICS_FILE" | awk -F',' '{sum+=$3; count++} END {if(count>0) printf "%.0f", sum/count; else print "N/A"}')
        MAX_MEM=$(tail -n +2 "$METRICS_FILE" | awk -F',' 'BEGIN{max=0} {if($3>max)max=$3} END {print max}')
        echo "| Average Memory Used | ${AVG_MEM} MiB |"
        echo "| Peak Memory Used | ${MAX_MEM} MiB |"
    fi
else
    echo "GPU monitoring was skipped or nvidia-smi not available."
fi)

## SLO Verification

| SLO | Target | Status |
|-----|--------|--------|
| Visual sidecar latency (p95) | < 500ms | $([ "$P95" -lt 500 ] && echo "PASS" || echo "FAIL") |
| Success Rate | > 95% | $([ $(echo "$TOTAL_SUCCESS * 100 / $TOTAL_REQUESTS" | bc 2>/dev/null || echo 0) -ge 95 ] && echo "PASS" || echo "FAIL") |

---
*Generated by alpha9-stress-test.sh*
EOF

echo ""
echo "================================================"
echo "Stress Test Complete"
echo "================================================"
echo "Results:  $RESULTS_FILE"
echo "Metrics:  $METRICS_FILE"
echo "Report:   $REPORT_FILE"
echo ""
echo "Total: $TOTAL_REQUESTS requests, $TOTAL_SUCCESS success, $TOTAL_FAILURES failures"
echo "Success Rate: $(echo "scale=2; $TOTAL_SUCCESS / $TOTAL_REQUESTS * 100" | bc 2>/dev/null || echo "0")%"
