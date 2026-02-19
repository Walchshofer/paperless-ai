$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$NodeScript = Join-Path $RootDir 'scripts\sync_dotenv_from_compose_env.js'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'Node.js is required to run env sync.'
  exit 1
}

node $NodeScript
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
