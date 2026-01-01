Param(
    [int]$RunId = 20961665979,
    [int]$PrNum = 19,
    [int]$IntervalSeconds = 15,
    [int]$MaxPolls = 120
)
Write-Host "Monitoring workflow run $RunId for PR #$PrNum. Will merge if test (3.11) succeeds."
$poll = 0
while ($poll -lt $MaxPolls) {
    $poll++
    try {
        $jjson = gh run view $RunId --json status,conclusion 2>$null
        $j = $jjson | ConvertFrom-Json
    } catch {
        Write-Host "gh run view failed (attempt $poll), retrying in $IntervalSeconds s..."
        Start-Sleep -Seconds $IntervalSeconds
        continue
    }
    Write-Host "Poll #$poll: status=$($j.status), conclusion=$($j.conclusion)"
    if ($j.status -eq 'completed') { break }
    Start-Sleep -Seconds $IntervalSeconds
}
if ($poll -ge $MaxPolls) {
    Write-Host "Timed out waiting for workflow to complete after $MaxPolls polls."; exit 2
}
Write-Host "Workflow completed. Checking test (3.11) conclusion..."
$prjson = gh pr view $PrNum --json statusCheckRollup 2>$null
$pr = $prjson | ConvertFrom-Json
$test = $pr.statusCheckRollup | Where-Object { $_.name -eq 'test (3.11)' }
if (-not $test) { Write-Host 'No test (3.11) check found; aborting merge.'; exit 3 }
Write-Host "test (3.11) conclusion: $($test.conclusion)"
if ($test.conclusion -eq 'SUCCESS') {
    Write-Host "Merging PR #$PrNum..."
    gh pr merge $PrNum --merge --delete-branch --admin
    $m = gh pr view $PrNum --json state,mergedAt,mergedBy | ConvertFrom-Json
    Write-Host "PR #$PrNum state: $($m.state), mergedAt: $($m.mergedAt), mergedBy: $($m.mergedBy.login)"
    exit 0
} else {
    Write-Host "Not merging: test (3.11) conclusion is $($test.conclusion)."; exit 4
}
