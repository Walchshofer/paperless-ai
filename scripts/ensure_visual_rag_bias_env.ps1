Param(
    [string]$ComposePath = 'C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml'
)
if (-not (Test-Path $ComposePath)) { Write-Error "Compose file not found: $ComposePath"; exit 1 }
$lines = Get-Content $ComposePath -Encoding UTF8
$inVisual = $false
$envStart = -1
$envEnd = -1
for ($i=0; $i -lt $lines.Length; $i++) {
    $line = $lines[$i]
    if ($line.Trim() -eq 'visual-rag:') { $inVisual = $true; continue }
    if ($inVisual -and $line.TrimStart().StartsWith('environment:')) { $envStart = $i; continue }
    if ($inVisual -and $envStart -ge 0) {
        # environment block continues until we hit a non-indented line or next top-level key
        if ($line -match '^\s{2}\S' -and -not ($line.Trim().StartsWith('-') -or $line.Trim().StartsWith('#'))) {
            # likely top-level next key
            $envEnd = $i - 1
            break
        }
    }
    # stop searching if we've passed the visual-rag service block (hit volumes or deploy)
    if ($inVisual -and $envStart -ge 0 -and $line.TrimStart().StartsWith('volumes:')) { $envEnd = $i - 1; break }
}
# If envStart set but envEnd not, set envEnd to next several lines
if ($envStart -ge 0 -and $envEnd -lt 0) { $envEnd = [Math]::Min($envStart + 20, $lines.Length - 1) }

if ($envStart -lt 0) { Write-Error 'environment: block under visual-rag not found'; exit 1 }

# Search for BIAS_ENGINE_LOG_LEVEL within env block
$foundBias = $false
for ($k = $envStart+1; $k -le $envEnd; $k++) {
    if ($lines[$k].Trim() -match 'BIAS_ENGINE_LOG_LEVEL') { $foundBias = $true; break }
}

if ($foundBias) { Write-Host 'BIAS_ENGINE_LOG_LEVEL already present in visual-rag environment; no change' ; exit 0 }

# Insert BIAS_ENGINE_LOG_LEVEL after DEFAULT_INDEX_NAME if present, else append before envEnd
$insertIndex = -1
for ($k = $envStart+1; $k -le $envEnd; $k++) {
    if ($lines[$k].Trim() -match 'DEFAULT_INDEX_NAME') { $insertIndex = $k + 1; break }
}
if ($insertIndex -lt 0) { $insertIndex = $envEnd }
$insertion = '      - BIAS_ENGINE_LOG_LEVEL=${BIAS_ENGINE_LOG_LEVEL}'

# Build new content
$newLines = @()
for ($i=0;$i -lt $lines.Length; $i++) {
    if ($i -eq $insertIndex) { $newLines += $insertion }
    $newLines += $lines[$i]
}

$newLines -join "`n" | Set-Content -Path $ComposePath -Encoding UTF8
Write-Host 'Inserted BIAS_ENGINE_LOG_LEVEL into visual-rag environment'

# Commit if git
$ComposeDir = Split-Path $ComposePath -Parent
if (Test-Path (Join-Path $ComposeDir '.git')) {
    Push-Location $ComposeDir
    try { git checkout -b chore/add-visual-rag-bias-env } catch {}
    git add docker-compose.yml
    git commit -m 'chore: add BIAS_ENGINE_LOG_LEVEL to visual-rag env mapping' -q || Write-Host 'No changes to commit or commit failed'
    git --no-pager show --name-only --pretty="" HEAD
    Pop-Location
    Write-Host 'Committed changes on new branch chore/add-visual-rag-bias-env'
} else {
    Write-Host 'Not a git repo; changes are local only (docker-compose.yml modified)'
}
