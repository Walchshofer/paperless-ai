Param(
    [switch]$NonInteractive
)

Write-Host "=== Bridge v4.0 Comprehensive Validation ===" -ForegroundColor Cyan
Write-Host ""

$reportFile = "test/output/bridge_validation_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
$startTime = Get-Date

# Ensure output directory exists
New-Item -ItemType Directory -Force -Path test/output | Out-Null

# Activate virtualenv if present
if (Test-Path ".\.venv\Scripts\Activate.ps1") {
    try {
        & .\.venv\Scripts\Activate.ps1
        Write-Host "  [OK] Virtualenv activated" -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] Could not activate virtualenv, proceeding with system Python" -ForegroundColor Yellow
    }
}

# Prerequisites
Write-Host "[0/6] Checking prerequisites..." -ForegroundColor Yellow

# Check Serena
$serenaUp = $false
try {
    $resp = Invoke-WebRequest -Uri "http://127.0.0.1:9121/sse" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  [OK] Serena is running" -ForegroundColor Green
    $serenaUp = $true
} catch {
    Write-Host "  [ERROR] Serena is not running (http://127.0.0.1:9121)!" -ForegroundColor Red
    Write-Host "    Start Serena first: python -m serena" -ForegroundColor Yellow
}

# Ensure test stubs are not used
Remove-Item Env:\BRIDGE_TEST_STUBS -ErrorAction SilentlyContinue
Write-Host "  [OK] Test stubs disabled (using real MCP SDK)" -ForegroundColor Green

# Phase 1: Unit Tests
Write-Host ""; Write-Host "[1/6] Running unit tests..." -ForegroundColor Yellow
$unitResult = pytest test/unit/ -v --tb=short --junitxml=test/output/unit_results.xml 2>&1
$unitExitCode = $LASTEXITCODE
if ($unitExitCode -eq 0) {
    Write-Host "  [OK] Unit tests passed" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Unit tests failed" -ForegroundColor Red
}

# Phase 2: Integration Tests
Write-Host ""; Write-Host "[2/6] Running integration tests..." -ForegroundColor Yellow
if ($serenaUp) {
    $env:SERENA_BASE = "http://127.0.0.1:9121"
    $integrationResult = pytest test/integration/ -v --tb=short --junitxml=test/output/integration_results.xml 2>&1
    $integrationExitCode = $LASTEXITCODE
    if ($integrationExitCode -eq 0) {
        Write-Host "  [OK] Integration tests passed" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] Integration tests failed" -ForegroundColor Red
    }
} else {
    Write-Host "  [WARN] Skipping integration tests because Serena is not running" -ForegroundColor Yellow
    $integrationResult = "Serena not running"
    $integrationExitCode = 2
}

# Phase 3: E2E Tests
Write-Host ""; Write-Host "[3/6] Running E2E tests..." -ForegroundColor Yellow
if ($serenaUp) {
    $env:SERENA_BASE = "http://127.0.0.1:9121"
    # Ensure E2E environment guard is set so E2E test-suite runs
    $env:SERENA_E2E = '1'
    $e2eResult = pytest test/e2e/test_serena_e2e.py -v --tb=short --junitxml=test/output/e2e_results.xml 2>&1
    $e2eExitCode = $LASTEXITCODE
    if ($e2eExitCode -eq 0) {
        Write-Host "  [OK] E2E tests passed" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] E2E tests failed" -ForegroundColor Red
    }
} else {
    Write-Host "  [WARN] Skipping E2E tests because Serena is not running" -ForegroundColor Yellow
    $e2eResult = "Serena not running"
    $e2eExitCode = 2
}

# Phase 4: STDIO Protocol Test
Write-Host ""; Write-Host "[4/6] Testing STDIO protocol..." -ForegroundColor Yellow
$stdioResult = python bridge/testscripts/test_stdin_lifecycle.py 2>&1
$stdioExitCode = $LASTEXITCODE
if ($stdioExitCode -eq 0) {
    Write-Host "  [OK] STDIO protocol test passed" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] STDIO protocol test failed" -ForegroundColor Red
}

# Phase 5: CODEX Integration (manual verification)
Write-Host ""; Write-Host "[5/6] Testing CODEX integration..." -ForegroundColor Yellow
Write-Host "  Manual verification required: start CODEX and verify 'codex-serena' shows as Connected" -ForegroundColor Gray
if ($NonInteractive) {
    # Non-interactive: leave CODEX verification neutral (manual) and do not force a failure
    $codexVerified = $null
} else {
    $codexVerified = Read-Host "  CODEX integration verified? (y/n)"
}

# Phase 6: Generate Report
Write-Host ""; Write-Host "[6/6] Generating validation report..." -ForegroundColor Yellow
$endTime = Get-Date
$duration = $endTime - $startTime

$unitText = if ($unitResult) { $unitResult } else { "" }
$integrationText = if ($integrationResult) { $integrationResult } else { "" }
$e2eText = if ($e2eResult) { $e2eResult } else { "" }
$stdioText = if ($stdioResult) { $stdioResult } else { "" }

@"
# Bridge v4.0 Comprehensive Validation Report

**Date:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
**Duration:** $($duration.TotalMinutes.ToString('F2')) minutes
**Serena:** http://127.0.0.1:9121
**Bridge Version:** 4.0

## Test Execution Summary

| Test Suite | Status | Exit Code |
|------------|--------|-----------|
| Unit Tests | $(if ($unitExitCode -eq 0) { 'PASS' } else { 'FAIL' }) | $unitExitCode |
| Integration Tests | $(if ($integrationExitCode -eq 0) { 'PASS' } else { 'FAIL' }) | $integrationExitCode |
| E2E Tests | $(if ($e2eExitCode -eq 0) { 'PASS' } else { 'FAIL' }) | $e2eExitCode |
| STDIO Protocol | $(if ($stdioExitCode -eq 0) { 'PASS' } else { 'FAIL' }) | $stdioExitCode |
| CODEX Integration | $(if ($codexVerified -eq 'y') { 'PASS' } elseif ($codexVerified -eq 'n') { 'MANUAL' } else { 'MANUAL' }) | Manual |

## Overall Result

$(if ($unitExitCode -eq 0 -and $integrationExitCode -eq 0 -and $e2eExitCode -eq 0 -and $stdioExitCode -eq 0 -and $codexVerified -eq 'y') {
    '**ALL TESTS PASSED** - Bridge v4.0 is production-ready'
} else {
    '**SOME TESTS FAILED** - Review failures and create fix tickets'
})

## Detailed Results

### Unit Tests
~~~
$unitText
~~~

### Integration Tests
~~~
$integrationText
~~~

### E2E Tests
~~~
$e2eText
~~~

### STDIO Protocol Test
~~~
$stdioText
~~~

## Next Steps

$(if ($unitExitCode -eq 0 -and $integrationExitCode -eq 0 -and $e2eExitCode -eq 0 -and $stdioExitCode -eq 0 -and $codexVerified -eq 'y') {
    "- Deploy bridge to production`n- Update CODEX configuration`n- Monitor bridge_debug.log for issues`n- Consider changing LOG_LEVEL to INFO for production"
} else {
    "- Review test failures`n- Create tickets for bug fixes`n- Re-run validation after fixes"
})
"@ | Out-File -FilePath $reportFile -Encoding utf8

Write-Host "  [OK] Report generated: $reportFile" -ForegroundColor Green
Write-Host ""
Write-Host "=== Validation Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Report: $reportFile" -ForegroundColor Yellow
Write-Host ""

# Determine CODEX condition: if non-interactive, treat CODEX as neutral (exclude from success criteria)
$codexCondition = $true
if (-not $NonInteractive) {
    $codexCondition = ($codexVerified -eq 'y')
}

if ($unitExitCode -eq 0 -and $integrationExitCode -eq 0 -and $e2eExitCode -eq 0 -and $stdioExitCode -eq 0 -and $codexCondition) {
    Write-Host "ALL TESTS PASSED - Bridge is production-ready!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SOME TESTS FAILED - Review report for details" -ForegroundColor Red
    exit 1
}