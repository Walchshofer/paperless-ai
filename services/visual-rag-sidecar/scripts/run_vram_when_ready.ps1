# Poll /health until model_loaded becomes true, then run VRAM verification against the largest PDF in ../..\..\paperless-ngx\media
# Usage: pwsh -File run_vram_when_ready.ps1 [-TimeoutMinutes 30] [-PollIntervalSec 10]
param(
    [int]$TimeoutMinutes = 30,
    [int]$PollIntervalSec = 10
)

$baseMedia = Join-Path $PSScriptRoot "..\..\..\..\paperless-ngx\media" | Resolve-Path -ErrorAction SilentlyContinue
if (-not $baseMedia) {
    Write-Output "Media folder not found: expected at ../paperless-ngx/media relative to script. Aborting."
    exit 2
}
$mediaPath = $baseMedia.Path
Write-Output "Watching sidecar /health for model readiness. MEDIA_PATH=$mediaPath"

$timeout = [int]($TimeoutMinutes * 60 / $PollIntervalSec)
for ($i=0; $i -lt $timeout; $i++) {
    try {
        $h = Invoke-RestMethod -Uri 'http://localhost:8001/health' -UseBasicParsing -TimeoutSec 5
    } catch {
        Write-Output "health query failed: $_"
        Start-Sleep -Seconds $PollIntervalSec
        continue
    }
    Write-Output "[$i] status=$($h.status) model_loaded=$($h.model_loaded)"
    if ($h.model_loaded -eq $true) { Write-Output "MODEL LOADED"; break }
    Start-Sleep -Seconds $PollIntervalSec
}
if ($i -ge $timeout) { Write-Output "Timeout waiting for model to load"; exit 2 }

# Wait for a PDF to appear in media (prefer largest file)
$found = $null
for ($j=0; $j -lt 300; $j++) {
    $found = Get-ChildItem -Path $mediaPath -Filter "*.pdf" -File -ErrorAction SilentlyContinue | Sort-Object Length -Descending | Select-Object -First 1
    if ($found) { break }
    Write-Output "No PDF found in $mediaPath yet... (waiting)"; Start-Sleep -Seconds 5
}
if (-not $found) { Write-Output "No PDF found after wait; aborting"; exit 2 }
$fname = $found.Name
Write-Output "Using PDF for test: $fname"

# Start GPU memory sampler as a background job
$out = Join-Path $env:TEMP "vramsamples_$(Get-Random).log"
$script = {
    param($out)
    while ($true) {
        & nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | Out-File -Append -FilePath $out
        Start-Sleep -Milliseconds 500
    }
}
$job = Start-Job -ScriptBlock $script -ArgumentList $out
Write-Output "Started GPU sampler job id=$($job.Id) out=$out"

# Baseline
$before = (& nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits).Trim()
Write-Output "Baseline GPU(mib): $before"

# Trigger indexing (sidecar expects pdf_path relative to MEDIA_DIR)
$body = @{ pdf_path = $fname } | ConvertTo-Json
try {
    $r = Invoke-RestMethod -Uri 'http://localhost:8001/index/document' -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 360
    Write-Output "Index trigger response: $r"
} catch {
    Write-Output "Index trigger failed: $_"
}

# Wait for indexing to complete (monitor /status)
for ($k=0; $k -lt 900; $k++) {
    try {
        $s = Invoke-RestMethod -Uri 'http://localhost:8001/status' -UseBasicParsing -TimeoutSec 5
    } catch { Write-Output "status query failed: $_"; Start-Sleep -Seconds 5; continue }
    Write-Output "indexing_in_progress=$($s.indexing_in_progress) indexed_docs=$($s.indexed_documents)"
    if (-not $s.indexing_in_progress -and $s.indexed_documents -gt 0) { Write-Output "Indexing complete"; break }
    Start-Sleep -Seconds 5
}

# Stop sampler and compute peak
Stop-Job -Id $job.Id -Force
Receive-Job -Id $job.Id -Keep | Out-Null
$samples = @()
if (Test-Path $out) { $samples = Get-Content $out | ForEach-Object { [int]$_ } }
$peak = 0
if ($samples) { $peak = ($samples | Measure-Object -Maximum).Maximum }
$after = (& nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits).Trim()
Write-Output "VRAM Test Summary: baseline=$before MiB after=$after MiB peak=$peak MiB"
if ($peak -gt 0 -and ($peak -as [int]) -lt 19000) { Write-Output "VRAM check PASSED (peak < 19 GiB)" } else { Write-Output "VRAM check: peak looks high or not captured" }

# Save results
$log = Join-Path $PSScriptRoot "vram_test_result_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"
@("pdf=$fname","baseline=$before","after=$after","peak=$peak") | Out-File -FilePath $log -Encoding utf8
Write-Output "Saved results to $log"

exit 0
