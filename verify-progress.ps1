# Loop Verification Script: Tracks 0-Error/0-Warning Policy Progress
$ReportFile = "LINT_PROGRESS.md"
$CurrentDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host "🔍 Starting Ground Truth Audit..." -ForegroundColor Cyan

# 1. Run TSC and capture error count
$TscOutput = npx tsc --noEmit 2>&1
$TscCount = ($TscOutput | Select-String "error TS").Count

# 2. Run ESLint and capture warning/error count
$LintOutput = npm run lint --silent 2>&1
$LintCount = ($LintOutput | Select-String "problem").Count
if ($null -eq $LintCount) { $LintCount = 0 }

# 3. Targeted 'any' count (The 'no-explicit-any' monitor)
$AnyCount = (Get-ChildItem -Recurse -Include *.ts, *.tsx | Get-Content | Select-String ": any" | Measure-Object).Count

# 4. Generate/Update Markdown Report
$Header = "## 📊 Quality Audit Report - $CurrentDate"
$Stats = @"
* **TypeScript Errors:** $TscCount
* **Lint Problems:** $LintCount
* **Explicit 'any' Usages:** $AnyCount
* **Policy Compliance:** $(if ($TscCount + $LintCount -eq 0) { "✅ 100% (Ready for Merge)" } else { "⚠️ In-Progress" })

---
"@

$Stats | Out-File -FilePath $ReportFile -Append
Write-Host "✅ Audit Complete. Report updated in $ReportFile" -ForegroundColor Green

# 5. Output for Gemini's next context
Write-Host "`nCurrent Baseline for next iteration:"
Write-Host "TSC: $TscCount, Lint: $LintCount, 'any': $AnyCount" -ForegroundColor Yellow