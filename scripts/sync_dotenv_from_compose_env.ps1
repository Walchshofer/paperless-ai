# Generate .env for compatibility with legacy `docker-compose` on Windows
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# Define header early so it's available for both fallback and normal paths
$header = "# Auto-generated .env (compatibility for legacy docker-compose)`n# Generated from: docker-compose.env`n# Do not edit directly — edit docker-compose.env and re-run this script: scripts\sync_dotenv_from_compose_env.ps1`n"

# Use repo-root docker-compose.env as the authoritative source and generate repo-root .env for compatibility
$SRC = Join-Path $RootDir 'docker-compose.env' | Resolve-Path -ErrorAction SilentlyContinue
if (-not $SRC) {
  Write-Warning "Source env file not found at: $($RootDir)\docker-compose.env"
    # Emit a minimal fallback .env for CI/testing so workflows can continue with safe defaults
    $fallback = @{
        POSTGRES_USER = 'elfman'
        POSTGRES_PASSWORD = 'password'
        POSTGRES_DB = 'paperless_test'
        INDEX_DIR = '/tmp/index'
        MEDIA_DIR = '/tmp/media'
        DEFAULT_INDEX_NAME = 'test_index'
        VIDEO_FRAME_INTERVAL = '1'
        VIDEO_KEYFRAME_DETECTION = 'yes'
        OCR_CHECKPOINT_TRANSLATIONS_ENABLED = 'yes'
        TRANSLATION_MIN_CHARS = '3'
    }
    # Write to repo-root .env (not paperless-ngx)
    $DST = Join-Path $RootDir '.env'
    # Ensure parent directory exists
    $dstDir = Split-Path $DST -Parent
    if (-not (Test-Path -Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Set-Content -Path $DST -Value $header -Encoding UTF8
    foreach ($k in $fallback.Keys) {
        Add-Content -Path $DST -Value ("$k=$($fallback[$k])") -Encoding UTF8
    }
    Write-Host "Generated fallback $DST";
    exit 0
}
$SRC = $SRC.Path
$DST = Join-Path (Split-Path $SRC -Parent) '.env'

# Update header with actual source path
$header = "# Auto-generated .env (compatibility for legacy docker-compose)`n# Generated from: $SRC`n# Do not edit directly — edit docker-compose.env and re-run this script: scripts\sync_dotenv_from_compose_env.ps1`n"

# Read and parse simple KEY=VALUE lines (ignore comments and blank lines)
$lines = Get-Content $SRC | Where-Object { $_ -notmatch '^[\s]*#' -and $_ -match '\S' }
$kv = @{}
foreach ($line in $lines) {
    if ($line -match '^[A-Z_][A-Z0-9_]+=(.*)$') {
        $k = $line.Split('=')[0]
        $v = $line.Substring($line.IndexOf('=') + 1)
        # Strip inline comments: remove ' #...' or ' # ...' from end of value
        # Be careful to not strip # that's part of the value (e.g., in URLs or passwords)
        # Only strip if there's whitespace before the #
        if ($v -match '^(.*?)\s+#.*$') {
            $v = $Matches[1]
        }
        $kv[$k] = $v
    }
}

# Resolve ${VAR:-fallback} patterns iteratively using the inline kv table
$pattern = '\$\{([^}:]+)(?::-([^}]+))?\}'
$keys = @($kv.Keys)
foreach ($k in $keys) {
    $v = $kv[$k]
    $prev = $null
    while ($v -match $pattern -and $v -ne $prev) {
        $prev = $v
        $v = [regex]::Replace($v, $pattern, {
            param($m)
            $var = $m.Groups[1].Value
            $fallback = if ($m.Groups[2].Success) { $m.Groups[2].Value } else { '' }
            if ($kv.ContainsKey($var) -and $kv[$var]) { return $kv[$var] }
            $envVal = [Environment]::GetEnvironmentVariable($var)
            if ($envVal) { return $envVal }
            return $fallback
        })
    }
    $kv[$k] = $v
}

# Write header and resolved key=values
Set-Content -Path $DST -Value $header -Encoding UTF8
foreach ($k in $kv.Keys) {
    Add-Content -Path $DST -Value ("$k=$($kv[$k])") -Encoding UTF8
}

Write-Host "Generated $DST from $SRC (resolved values)"
