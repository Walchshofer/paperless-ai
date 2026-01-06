#!/usr/bin/env bash
# Prepare cleanup commit that removes deprecated legacy prompt files
set -euo pipefail

defs=(
  "prompts/verification-db-schema.md"
  "prompts/verification-frontend-islands.md"
  "prompts/verification-telemetry.md"
  "prompts/verification-circuit-breaker.md"
  "prompts/integration-feedback-e2e.md"
  "prompts/VERIFICATION_CHECKLIST.md"
)

echo "Preparing cleanup commit that removes deprecated prompt files..."
for f in "${defs[@]}"; do
  if [ -f "$f" ]; then
    git rm "$f"
    echo "Staged removal of $f"
  else
    echo "Not found: $f"
  fi
done

git commit -m "chore(prompts): remove deprecated unnumbered verification prompts (replaced by 009-014)"

echo "Cleanup commit prepared. Create a PR from this branch to main/release as needed."