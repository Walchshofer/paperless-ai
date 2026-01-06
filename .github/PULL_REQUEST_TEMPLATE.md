## PR: Cleanup deprecated verification prompt files

This PR removes legacy unnumbered verification prompt files which were replaced by numbered prompts (009-014).

Steps included:
- Run `bash scripts/cleanup-deprecated-prompts.sh` locally on a branch.
- Verify no unrelated files are staged.
- Push branch and open PR against `main` or the release branch.

Why:
- Numbered prompts improve traceability and align with the prompt execution order.

Testing:
- CI `verification-fast` should pass.
- Verify that no references to the deprecated files remain in docs or other prompts.

If you want me to open the PR, provide repo write access or tell me the branch name to use and I'll prepare the branch locally.