# Task: Visual RAG Environment & Dependency Hardening

Epic: Ensure Visual RAG sidecar runs reliably with correct env defaults, package versions, and operational guardrails (RTX 3090 Ti target).

Owner: Implementation Agent
Priority: High

## Background
We observed production issues where `INDEX_DIR` being present but empty in `docker-compose.env` caused the sidecar to treat `.` as the index path, leading to invalid-index errors at startup. Additionally, the sidecar's `requirements.txt` pins `byaldi` and `transformers` to versions that are incompatible with ColQwen3 and modern Qwen family models. This task aims to harden env defaults, bump dependencies, and add tests and documentation.

## Findings (env & Dockerfile gaps)
- **DEFAULT_INDEX_NAME vs VISUAL_RAG_INDEX_NAME**: the Python sidecar uses `DEFAULT_INDEX_NAME` (default `paperless_visual`) while `docker-compose.env` and some JS scripts (migration tooling) use `VISUAL_RAG_INDEX_NAME`. This inconsistency may cause misconfiguration and brittle CI checks. Recommendation: **standardize on `VISUAL_RAG_INDEX_NAME`** (preferred), update the Python service to read `VISUAL_RAG_INDEX_NAME` (with a fallback to `DEFAULT_INDEX_NAME` for backward compatibility), or set `DEFAULT_INDEX_NAME=${VISUAL_RAG_INDEX_NAME}` in `docker-compose.env`.

- **MEDIA_DIR vs PAPERLESS_MEDIA_ROOT**: the sidecar expects `MEDIA_DIR` (default `/media/paperless`) but `docker-compose.env` uses `PAPERLESS_MEDIA_ROOT=/usr/src/paperless/media`. The compose service currently mounts `./media:/media/paperless` (so runtime works), but the env name mismatch is confusing. Recommendation: add an explicit `MEDIA_DIR=${PAPERLESS_MEDIA_ROOT:-/media/paperless}` entry in `docker-compose.env` and/or add an `environment` entry for the `visual-rag` service to make the mapping explicit.

- **INDEX env parity**: `INDEX_DIR` and `VISUAL_RAG_INDEX_DIR` both appear in the compose file; the service reads `INDEX_DIR` while docs reference `VISUAL_RAG_INDEX_DIR`. Ensure both are present or canonicalize to one name and document it.

- **Health & observability**: the service logs the resolved index path but does not include `index_resolved_path` or `hf_hub_offline_mode` in `/health` (`/status` does include `index_path`). Request adding those fields to `/health` and exposing a Prometheus metric `visual_rag_index_resolved_path` or `visual_rag_hf_hub_offline_mode` for easier debugging.

- **Dockerfile / build-time vars**: `services/visual-rag-sidecar/Dockerfile` sets `TORCH_CUDA_ARCH_LIST`, `MAX_JOBS`, and installs CUDA tools. Ensure the Dockerfile documents required `CUDA_TOOLKIT` and PyTorch wheel compatibility (`cu124`) and expose build args (e.g., `ARG CUDA_TOOLKIT`) so CI images can match runtime capabilities.

## Work Items
1. Env defaults & docs (safe, non-breaking):
   - Set and commit the recommended defaults in `docker-compose.env` (already updated locally):
     - `INDEX_DIR=/data/indices`
     - `VISUAL_RAG_INDEX_DIR=/data/indices`
     - `VISUAL_RAG_INDEX_NAME=paperless_visual`
     - `MAX_SPLIT_SIZE_MB=512`
     - `PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512`
     - `VISION_RENDER_DPI=300` (recommended for ColQwen3 workloads; higher fidelity for tables/charts; increases memory/index size)
- `VIDEO_FRAME_INTERVAL=1` (seconds between sampled frames when indexing video; lower values increase coverage and index size)
- `VIDEO_KEYFRAME_DETECTION=yes` (enable keyframe/scene-change sampling to reduce redundant frames; yes|no)
     - `MAX_VISION_PAGES=5`
     - `VISUAL_RAG_TIMEOUT=600000`
     - `ENABLE_VISUAL_RAG_SIDECAR=yes`
   - **New:** Add `MEDIA_DIR=${PAPERLESS_MEDIA_ROOT:-/media/paperless}` to `docker-compose.env` and/or add an explicit `environment:` mapping under the `visual-rag` service so `MEDIA_DIR` is always set.
   - **New:** Add duplication or backward-compatibility mapping in `docker-compose.env` such as `DEFAULT_INDEX_NAME=${VISUAL_RAG_INDEX_NAME}` to handle tools still using `DEFAULT_INDEX_NAME`.
   - **New:** Update the Python sidecar configuration (`services/visual-rag-sidecar/main.py`) to prefer `VISUAL_RAG_INDEX_NAME` and fall back to `DEFAULT_INDEX_NAME` to avoid future mismatches.
   - Add doc changes to `docs/VISUAL_RAG_INTEGRATION.md` & `docs/ENVIRONMENT_VARIABLES.md` (done).

2. Dependency upgrade (breaking, but necessary):
   - Update `services/visual-rag-sidecar/requirements.txt`:
     - `byaldi>=0.4.0`
     - `transformers>=4.49.0`
     - Document flash-attn / accelerate / PyTorch CUDA requirements.
   - Update the sidecar `Dockerfile` with a note to use CUDA-compatible wheels (e.g., cu124) and add build arguments for `CUDA_TOOLKIT` if not present.

3. Tests & validations:
   - Add a unit/integration test that starts the sidecar (in CI or locally) and asserts:
     - `curl /health` returns `index_dir` equal to `/data/indices` (or the value of `INDEX_DIR`) and includes `hf_hub_offline_mode` and `index_resolved_path` in the payload (or make the same assertions against `/status`).
     - On first load (HF_HUB_OFFLINE unset), the sidecar eventually writes `/data/indices/.hf_hub_download_complete` (simulate with a pre-seeded cache in CI).
     - Assert the service reports `model` equal to the locked model `TomoroAI/tomoro-colqwen3-embed-8b` in `/version`.
   - Add a linter/test ensuring `docker-compose.env` does not contain empty critical variables (CI check that fails PRs where `INDEX_DIR=` or `VISUAL_RAG_INDEX_DIR=` are empty).
   - **New:** Extend the linter to assert at least one index-name variable is present and non-empty: `VISUAL_RAG_INDEX_NAME` or `DEFAULT_INDEX_NAME`.
   - **New:** Add a CI check that `MEDIA_DIR` is set (or that `visual-rag` service has a `volumes:` entry mapping the expected host `./media` to `/media/paperless`).
   - **New:** Add an integration smoke test that verifies `/status` or `/health` returns `index_path` and that it equals the expected `INDEX_DIR` mount point (this ensures the docker-compose mapping is correct).

4. Observability & rollback plan:
   - Add a Prometheus metric and/or health payload field indicating `index_resolved_path` and `hf_hub_offline_mode` for easier debugging. Suggested metric names: `visual_rag_index_resolved_path` (label or exported as string) and `visual_rag_hf_hub_offline_mode` (0/1 gauge).
   - Ensure `/health` includes `index_resolved_path` and `hf_hub_offline_mode` (or that `/status` is guaranteed to contain `index_path`) so simple curl checks can confirm runtime behavior.
   - Add a rollback plan to revert dependency bump and publish a hotfix if regressions appear. Include a smoke-test checklist for rolling back (build image, run health checks, run integration tests).

## Acceptance Criteria
- `docs/VISUAL_RAG_INTEGRATION.md` and `docs/ENVIRONMENT_VARIABLES.md` updated with the guidance and recommended values. ✅
- `docker-compose.env` contains the recommended defaults and is committed to a feature branch. ✅
- `services/visual-rag-sidecar/requirements.txt` updated with the new version bounds and a PR opened. ✅ (PR contains smoke test results if possible)
- CI includes a test that fails if `INDEX_DIR` or `VISUAL_RAG_INDEX_DIR` is empty in `docker-compose.env`. ✅
- Sidecar health shows the correct index path and either creates `.hf_hub_download_complete` during a first-run integration test or respects the marker when pre-seeded. ✅

## Notes
- Be conservative with dependency bumps — coordinate with the infra team for CUDA/PyTorch versions used across other services (Guidance, Ollama).  
- If automating the initial model download in CI is infeasible (networking/HF rate-limits), mock the presence of the marker file and assert offline behavior.

---

Please pick up and implement these changes. Ping if you need me to open the PRs for the requirements change and provide test skeletons.