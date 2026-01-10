# Apply env mapping for visual-rag in external docker-compose.yml
Param(
    [string]$ComposeDir = 'C:\Users\pwalc\MyApps\paperless-ngx'
)
$File = Join-Path $ComposeDir 'docker-compose.yml'
if (-not (Test-Path $File)) {
    Write-Error "Compose file not found at $File"; exit 1
}

$text = Get-Content $File -Raw -Encoding UTF8
# Normalize line endings
$arr = $text -split "\r?\n"
$idx = -1
for ($i=0; $i -lt $arr.Length; $i++) {
    if ($arr[$i].Trim() -match '^visual-rag:\s*$') { $idx = $i; break }
}
if ($idx -lt 0) { Write-Error 'visual-rag service not found in docker-compose.yml'; exit 1 }
# Check for existing env mapping within next 20 lines
$exists = $false
for ($j = $idx+1; $j -lt [math]::Min($idx+20, $arr.Length); $j++) {
    if ($arr[$j].TrimStart().StartsWith('env_file:') -or $arr[$j].TrimStart().StartsWith('environment:')) { $exists = $true; break }
}
if ($exists) { Write-Host 'env mapping already exists under visual-rag; no change made'; exit 0 }

$insert = @(
    '    env_file:',
    '      - docker-compose.env',
    '    environment:',
    '      - MEDIA_DIR=${MEDIA_DIR}',
    '      - INDEX_DIR=${INDEX_DIR}',
    '      - VISUAL_RAG_INDEX_DIR=${VISUAL_RAG_INDEX_DIR}',
    '      - VISUAL_RAG_INDEX_NAME=${VISUAL_RAG_INDEX_NAME}',
    '      - DEFAULT_INDEX_NAME=${DEFAULT_INDEX_NAME}',
    '      - BIAS_ENGINE_LOG_LEVEL=${BIAS_ENGINE_LOG_LEVEL}'
)

$head = $arr[0..$idx]
$tail = if ($idx+1 -lt $arr.Length) { $arr[($idx+1)..($arr.Length-1)] } else { @() }
$new = $head + $insert + $tail
$new -join "`n" | Set-Content -Path $File -Encoding UTF8
Write-Host 'Inserted env mapping into docker-compose.yml'

# If git repo, commit changes
if (Test-Path (Join-Path $ComposeDir '.git')) {
    Push-Location $ComposeDir
    try {
        git checkout -b chore/add-visual-rag-env-mapping
    } catch {}
    git add docker-compose.yml
    git commit -m 'chore: ensure visual-rag receives explicit env mapping' -q || Write-Host 'No changes to commit or commit failed'
    git --no-pager show --name-only --pretty="" HEAD
    Pop-Location
    Write-Host 'Committed changes on new branch chore/add-visual-rag-env-mapping'
} else {
    Write-Host 'Not a git repo; changes are local only (docker-compose.yml modified)'
}
