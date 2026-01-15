# Cleanup script for deprecated ColQwen3 registry injection
# Run from: paperless-ai/scripts/

$ErrorActionPreference = "Stop"
$ScriptDir = $PSScriptRoot
$SidecarDir = Join-Path $ScriptDir "..\services\visual-rag-sidecar"
$RegistryFile = Join-Path $SidecarDir "colqwen3_registry.py"
$MainFile = Join-Path $SidecarDir "main.py"

Write-Host "🔍 Checking for deprecated ColQwen3 registry files..." -ForegroundColor Cyan

# 1. Delete the deprecated registry file
if (Test-Path $RegistryFile) {
    Remove-Item -Path $RegistryFile -Force
    Write-Host "✅ Deleted deprecated file: $RegistryFile" -ForegroundColor Green
} else {
    Write-Host "ℹ️  File not found (already deleted): $RegistryFile" -ForegroundColor Gray
}

# 2. Clean up imports in main.py
if (Test-Path $MainFile) {
    $content = Get-Content -Path $MainFile -Raw
    if ($content -match "colqwen3_registry") {
        # Remove the import line (regex handles indentation and newline)
        $newContent = $content -replace "(?m)^\s*from colqwen3_registry import.*(\r?\n)?", ""
        Set-Content -Path $MainFile -Value $newContent -NoNewline
        Write-Host "✅ Removed registry imports from: $MainFile" -ForegroundColor Green
        Write-Host "⚠️  ACTION REQUIRED: Please manually verify and remove the 'try/except' fallback block in main.py." -ForegroundColor Yellow
    } else {
        Write-Host "ℹ️  No registry imports found in: $MainFile" -ForegroundColor Gray
    }
}
