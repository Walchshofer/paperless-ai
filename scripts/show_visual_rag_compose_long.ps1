Param(
    [string]$ComposePath = 'C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml'
)
if (-not (Test-Path $ComposePath)) { Write-Error "Compose file not found: $ComposePath"; exit 1 }
$lines = Get-Content $ComposePath -Encoding UTF8
$found = $false
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i].Trim() -eq 'visual-rag:') {
        $found = $true
        $start = [Math]::Max(0, $i - 2)
        $end = [Math]::Min($lines.Length - 1, $i + 80)
        for ($j = $start; $j -le $end; $j++) {
            Write-Host ('{0,4}: {1}' -f ($j + 1), $lines[$j])
        }
        break
    }
}
if (-not $found) { Write-Error 'visual-rag service not found' ; exit 1 }
