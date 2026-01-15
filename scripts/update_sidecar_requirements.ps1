# Update visual-rag-sidecar requirements to enforce native Byaldi support
# Run from: paperless-ai/scripts/

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$ReqFile = Join-Path $ScriptDir "..\services\visual-rag-sidecar\requirements.txt"

Write-Host "🔍 Updating requirements in: $ReqFile" -ForegroundColor Cyan

if (Test-Path $ReqFile) {
    $content = Get-Content -Path $ReqFile
    $updated = $false
    $newContent = $content | ForEach-Object {
        if ($_ -match "^byaldi") {
            $updated = $true
            "byaldi>=0.0.7" 
        } else { $_ }
    }
    
    if (-not $updated) { $newContent += "byaldi>=0.0.7" }
    
    $newContent | Set-Content -Path $ReqFile
    Write-Host "✅ Pinned 'byaldi>=0.0.7' in requirements.txt" -ForegroundColor Green
} else {
    Write-Host "❌ Requirements file not found at: $ReqFile" -ForegroundColor Red
}