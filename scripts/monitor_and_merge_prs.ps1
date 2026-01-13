param(
  [Parameter(Mandatory=$false)]
  [int[]]$prs,
  [int]$intervalSeconds = 30,
  [int]$maxAttempts = 720 # ~6 hours by default
)

# Support passing PR numbers as positional arguments (e.g., scripts/monitor_and_merge_prs.ps1 20 21 22 23)
if (-not $prs -and $args.Count -gt 0) {
  $prs = $args | ForEach-Object { [int]$_ }
}

if (-not $prs -or $prs.Count -eq 0) {
  Write-Output "Usage: monitor_and_merge_prs.ps1 <pr1> <pr2> ... [-intervalSeconds <n>]"
  exit 2
}

function AllChecksSuccessful($pr) {
  # Returns $true if statusCheckRollup indicates all checks are successful
  $mergeable = gh pr view $pr --repo Walchshofer/paperless-ai --json mergeable --jq .mergeable 2>$null
  if (-not $mergeable -or $mergeable -ne 'MERGEABLE') { return $false }

  # Get contexts count and success count; handle null statusCheckRollup
  $contextsCount = gh pr view $pr --repo Walchshofer/paperless-ai --json statusCheckRollup --jq '.statusCheckRollup.contexts | length' 2>$null
  if (-not $contextsCount) { return $false }
  $successCount = gh pr view $pr --repo Walchshofer/paperless-ai --json statusCheckRollup --jq '.statusCheckRollup.contexts | map(select(.conclusion=="SUCCESS")) | length' 2>$null

  if (-not $successCount) { return $false }

  if ([int]$successCount -eq [int]$contextsCount) { return $true }
  return $false
}

foreach ($pr in $prs) {
  Write-Output ("[monitor] Starting watch for PR #{0}" -f $pr)
}

$attempt = 0
while ($attempt -lt $maxAttempts) {
  foreach ($pr in $prs) {
    Write-Output ("[monitor] Checking PR #{0} (attempt {1})" -f $pr, ($attempt+1))
    try {
      if (AllChecksSuccessful $pr) {
        Write-Output ("[monitor] PR #{0} is mergeable and checks passed — attempting merge" -f $pr)
        gh pr merge $pr --repo Walchshofer/paperless-ai --merge --delete-branch --admin --body "Auto-merged when CI passed (monitor script)."
        if ($LASTEXITCODE -eq 0) {
          Write-Output ("[monitor] PR #{0} merged successfully." -f $pr)
          # Remove PR from list
          $prs = $prs | Where-Object { $_ -ne $pr }
        } else {
          Write-Output ("[monitor] Merge failed for PR #{0} (exit {1}). Will retry later." -f $pr, $LASTEXITCODE)
        }
      } else {
        Write-Output ("[monitor] PR #{0} not yet mergeable or checks not all passing." -f $pr)
      }
    } catch {
      Write-Output ("[monitor] Error checking PR #{0}: {1}" -f $pr, $_)
    }
  }
  if ($prs.Length -eq 0) { Write-Output "[monitor] All PRs merged. Exiting."; exit 0 }
  Start-Sleep -Seconds $intervalSeconds
  $attempt++
}

Write-Output "[monitor] Max attempts reached; some PRs may remain unmerged: $prs"
exit 1
