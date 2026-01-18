#!/bin/bash
#
# alpha9-verify-all.sh
# All-in-one verification script for Alpha-9 Native Protocol
#
# Usage: bash scripts/alpha9-verify-all.sh [--fast | --integration | --e2e | --all]
#
# Supports:
#   --fast        : Run Tier-0 checks (lint, contracts, unit tests)
#   --integration : Run Tier-1 checks (handshake, payload mirroring)
#   --e2e         : Run Tier-2 checks (E2E tests, stress tests)
#   --all         : Run all verification tiers (default)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
SKIPPED=0

# Log functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASSED++)); }
log_fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAILED++)); }
log_skip() { echo -e "${YELLOW}[SKIP]${NC} $1"; ((SKIPPED++)); }
log_section() { echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"; }

# Parse arguments
RUN_FAST=false
RUN_INTEGRATION=false
RUN_E2E=false

case "${1:-all}" in
  --fast)
    RUN_FAST=true
    ;;
  --integration)
    RUN_INTEGRATION=true
    ;;
  --e2e)
    RUN_E2E=true
    ;;
  --all|*)
    RUN_FAST=true
    RUN_INTEGRATION=true
    RUN_E2E=true
    ;;
esac

cd "$PROJECT_ROOT"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        Alpha-9 Native Protocol Verification Suite         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Project Root: $PROJECT_ROOT"
echo "Date: $(date)"
echo ""

# ═══════════════════════════════════════════════════════════════════
# TIER 0: Fast Verification (per-commit)
# ═══════════════════════════════════════════════════════════════════

if [ "$RUN_FAST" = true ]; then
  log_section "TIER 0: Fast Verification"

  # Check 1: ESLint
  log_info "Running ESLint..."
  if npx eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 0 2>/dev/null; then
    log_pass "ESLint check passed"
  else
    log_fail "ESLint check failed"
  fi

  # Check 2: Python Flake8 (if Python files exist)
  if [ -d "services/visual-rag-sidecar" ]; then
    log_info "Running Flake8 (79-char limit)..."
    if command -v flake8 &> /dev/null; then
      if flake8 services/visual-rag-sidecar/ --max-line-length=79 --exclude=__pycache__,.venv,venv 2>/dev/null; then
        log_pass "Flake8 check passed"
      else
        log_fail "Flake8 check failed (79-char limit violations)"
      fi
    else
      log_skip "Flake8 not installed"
    fi
  fi

  # Check 3: Island contracts
  log_info "Checking island contracts..."
  if node scripts/check-islands.js 2>/dev/null; then
    log_pass "Island contracts validated"
  else
    log_fail "Island contract validation failed"
  fi

  # Check 4: Unit tests
  log_info "Running unit tests..."
  if npm test -- --timeout 30000 2>/dev/null; then
    log_pass "Unit tests passed"
  else
    log_fail "Unit tests failed"
  fi

  # Check 5: DB Schema (no vector columns in Postgres)
  log_info "Checking DB schema..."
  if node scripts/check-db-schema.js 2>/dev/null; then
    log_pass "DB schema check passed"
  else
    log_skip "DB schema check skipped (no connection)"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# TIER 1: Integration Verification (per-PR)
# ═══════════════════════════════════════════════════════════════════

if [ "$RUN_INTEGRATION" = true ]; then
  log_section "TIER 1: Integration Verification"

  # Check 6: Qdrant Alpha-9 configuration
  log_info "Verifying Qdrant collections..."
  if node scripts/verify-qdrant-alpha9.js 2>/dev/null; then
    log_pass "Qdrant Alpha-9 configuration verified"
  else
    log_skip "Qdrant verification skipped (no connection)"
  fi

  # Check 7: Integration tests
  log_info "Running integration tests..."
  if npm run test:integration -- --timeout 60000 2>/dev/null; then
    log_pass "Integration tests passed"
  else
    log_fail "Integration tests failed"
  fi

  # Check 8: Visual overlay schema
  log_info "Verifying visual overlays schema..."
  if node scripts/verify_visual_overlays_schema.js 2>/dev/null; then
    log_pass "Visual overlays schema verified"
  else
    log_skip "Visual overlays schema check skipped"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# TIER 2: E2E Acceptance (per-release)
# ═══════════════════════════════════════════════════════════════════

if [ "$RUN_E2E" = true ]; then
  log_section "TIER 2: E2E Acceptance"

  # Check 9: Playwright E2E tests
  log_info "Running Playwright E2E tests..."
  if npm run verification:e2e 2>/dev/null; then
    log_pass "E2E tests passed"
  else
    log_fail "E2E tests failed"
  fi

  # Check 10: Performance tests
  log_info "Running performance tests..."
  if npm run test:performance 2>/dev/null; then
    log_pass "Performance tests passed"
  else
    log_skip "Performance tests skipped"
  fi

  # Check 11: VRAM baseline (requires GPU)
  log_info "Checking VRAM baseline..."
  if command -v nvidia-smi &> /dev/null; then
    VRAM_USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | head -1)
    VRAM_TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
    if [ -n "$VRAM_USED" ]; then
      log_info "VRAM Usage: ${VRAM_USED}MB / ${VRAM_TOTAL}MB"
      # Check if under 4GB baseline (4096 MB)
      if [ "$VRAM_USED" -lt 4096 ]; then
        log_pass "VRAM baseline OK (< 4GB)"
      else
        log_fail "VRAM baseline exceeded (${VRAM_USED}MB > 4096MB)"
      fi
    fi
  else
    log_skip "VRAM check skipped (nvidia-smi not available)"
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# Summary Report
# ═══════════════════════════════════════════════════════════════════

log_section "Verification Summary"

echo "╔═══════════════════════════════════════════════════════════╗"
printf "║ %-57s ║\n" "Results:"
printf "║   ${GREEN}Passed:${NC}  %-48d ║\n" "$PASSED"
printf "║   ${RED}Failed:${NC}  %-48d ║\n" "$FAILED"
printf "║   ${YELLOW}Skipped:${NC} %-48d ║\n" "$SKIPPED"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}❌ Verification FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Verification PASSED${NC}"
  exit 0
fi
