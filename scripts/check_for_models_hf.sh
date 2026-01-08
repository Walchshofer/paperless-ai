#!/usr/bin/env bash
# CI helper: exit non-zero if models/hf is present in the tree
if git ls-files models/hf | grep -q .; then
  echo "ERROR: tracked files under models/hf are not allowed. Remove them and add to .gitignore." >&2
  git ls-files models/hf >&2
  exit 1
fi
# Also check working tree for uncommitted additions
if git status --porcelain | grep -E '^\s*[AM]\s+models/hf/'; then
  echo "ERROR: Modifying models/hf in this PR is not allowed." >&2
  git status --porcelain | grep -E '^\s*[AM]\s+models/hf/' >&2
  exit 1
fi
exit 0
