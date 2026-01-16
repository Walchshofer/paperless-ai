PR Draft: Stateless Visual RAG Sidecar (Tracking)

Summary
-------
This PR series implements a feature-flagged refactor to allow the Visual RAG sidecar to run in a stateless compute-only mode (`VISUAL_RAG_STATELESS`). The initial PRs will be small and incremental (docs + env + tests), followed by implementing runtime behavior changes.

Changes (planned incremental PRs)
--------------------------------
1. Docs & env defaults (this PR)
   - Add `VISUAL_RAG_STATELESS` to `docs/ENVIRONMENT_VARIABLES.md`
   - Add a design doc `docs/STATELESS_VISUAL_RAG_REFACTOR.md`
2. Small behavior change (PR #2)
   - Add env var parsing and a unit test to `main.py` to handle stateless behavior
   - Add tests to ensure `.pt` files are not created when stateless
3. Improve persistence flow (PR #3)
   - Implement optional `VISUAL_RAG_PERSIST_TO_QDRANT` or return embeddings to caller
   - Add batched upserts and metrics
4. Optional: S3/MinIO upload support for full tensor storage

Test Plan
---------
- Unit tests for stateless paths
- Integration tests simulating both stateful and stateless modes
- CI job to run the integration tests with a dev Qdrant instance

Acceptance Criteria
-------------------
- Env var is available and documented
- `main.py` respects `VISUAL_RAG_STATELESS` and behaves as expected
- Tests cover both modes and pass in CI

Reviewers
---------
- @implement (code)
- @test (integration)

Notes
-----
This PR series follows the "docs-first" rule: we will merge docs and design details first to ensure upstream teams understand the migration path before runtime changes land.