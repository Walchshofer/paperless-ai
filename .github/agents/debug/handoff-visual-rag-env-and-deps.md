# Handoff: Visual RAG Env & Dependencies — Debug Agent

**To:** debug-agent
**Priority:** High
**Created:** 2026-01-09
**Context:** Based on an audit of `paperless-ngx` and `paperless-ai` envs, Dockerfiles and service code.

## Summary of findings
- Index-name inconsistency: `DEFAULT_INDEX_NAME` vs `VISUAL_RAG_INDEX_NAME` (risk of misconfiguration).
- `MEDIA_DIR` alias missing in `docker-compose.env` while sidecar expects `/media/paperless`.
- Critical envs may be left empty (e.g. `INDEX_DIR`), resulting in Python `Path('')` -> `.` mistakes.
- `/health` lacked `index_resolved_path` and `hf_hub_offline_mode` fields (now added but verify runtime).
- Dockerfile build args and CUDA/PyTorch/flash-attn documentation lacking; need to ensure wheel/tooling compatibility and CI coordination.

## What I changed (done by implement agent)
- Added `MEDIA_DIR=${PAPERLESS_MEDIA_ROOT:-/media/paperless}` to `paperless-ngx/docker-compose.env`.
- Added `DEFAULT_INDEX_NAME=${VISUAL_RAG_INDEX_NAME:-paperless_visual}` alias in env file.
- Added `environment:` mapping to `visual-rag` service in `paperless-ngx/docker-compose.yml` for explicit `MEDIA_DIR` and index vars.
- Added `scripts/validate_env.sh` and a stubbed `.github/workflows/validate-env.yml` job.
- Updated `services/visual-rag-sidecar/main.py` to prefer `VISUAL_RAG_INDEX_NAME` (fallback to `DEFAULT_INDEX_NAME`) and added `index_resolved_path` + `hf_hub_offline_mode` to `/health`.
- Added `test/smoke/test_visual_rag_health.py` smoke test.

## TODO list for Debug Agent (concrete steps)
1. Verify config & env locally (priority: P0)
   - Run: `bash ./scripts/validate_env.sh` (fix any missing vars in `paperless-ngx/docker-compose.env`).
   - From `paperless-ngx` run: `docker compose up -d visual-rag`
   - Confirm `visual-rag` container uses expected volumes:
     - Model cache: `visual_model_cache:/root/.cache/huggingface`
     - Indices: `./data/visual_indices:/data/indices`
     - Media: `./media:/media/paperless:ro`

2. Smoke-run the sidecar (P0)
   - Run: `python3 test/smoke/test_visual_rag_health.py` (ensure Python `requests` is available in your env).
   - If failing: capture `docker logs visual_rag` and inspect `/status` endpoint for `last_error` and `index_path`.

3. Verify HF offline behavior & marker file (P1)
   - Confirm that after successful first model load, the sidecar writes: `/data/indices/.hf_hub_download_complete`.
   - If you cannot trigger a real model download, create the marker file in the mounted volume and restart the container; verify `HF_HUB_OFFLINE` enforced and `/health` shows `hf_hub_offline_mode: true`.

4. Dockerfile & dependency checks (P1)
   - Verify `services/visual-rag-sidecar/Dockerfile` has clear build ARGs and comments for CUDA compatibility. If not, add `ARG CUDA_TOOLKIT` and a comment about using PyTorch cu124 wheels and matching `flash-attn` builds.
   - Run a local build (if you have GPU/driver/host toolchain): `docker build -t visual-rag:dev ./services/visual-rag-sidecar` and observe `flash-attn` and `torch` install behavior.

5. CI integration & tests (P1)
   - Extend `.github/workflows/validate-env.yml` to include an integration job that:
     - Brings up the `visual-rag` service (or a minimal compose stack), and runs `python3 test/smoke/test_visual_rag_health.py`.
     - If network downloads are not permitted in CI, mock marker file or use pre-seeded cache volume.
   - Add a linter job to fail PRs where critical envs are empty (`INDEX_DIR`, `VISUAL_RAG_INDEX_NAME` or `DEFAULT_INDEX_NAME`, `MEDIA_DIR`).

6. Prometheus metrics & telemetry (P2)
   - Implement Prometheus metric(s): `visual_rag_hf_hub_offline_mode` (gauge 0/1) and optionally `visual_rag_index_resolved_path` (label or info metric). Add tests to ensure metrics endpoint exists if metrics are enabled.

7. Communication & rollback plan (P2)
   - If you make dependency changes (byaldi / transformers / flash-attn), include a rollback checklist and a PR note on how to revert to previous versions and what to validate (smoke tests + model load + integration tests).

## Acceptance Criteria (done = pass)
- `bash ./scripts/validate_env.sh` returns OK.
- `python3 test/smoke/test_visual_rag_health.py` passes in local run and CI job (or mocked CI run).
- The `visual-rag` container `/health` contains `index_resolved_path` and `hf_hub_offline_mode` (boolean) and values match the mounted volumes.
- A GitHub Actions integration job runs on PRs and fails when critical envs are empty.
- Dockerfile doc strings / ARG added for `CUDA_TOOLKIT` and the README notes the required wheel tags (e.g., cu124), or an issue opened to coordinate infra.

## Context / files to inspect
- `paperless-ai/.github/agents/implement/visual-rag-env-and-deps-task.md`
- `paperless-ai/docs/ENVIRONMENT_VARIABLES.md`
- `paperless-ai/services/visual-rag-sidecar/main.py`
- `paperless-ai/services/visual-rag-sidecar/Dockerfile`
- `paperless-ngx/docker-compose.env`
- `paperless-ngx/docker-compose.yml`
- `paperless-ai/scripts/validate_env.sh`
- `paperless-ai/test/smoke/test_visual_rag_health.py`

---

If you want, I can also open the PR(s) with the CI change + test job (I can prepare the job that brings up a minimal compose stack and runs the smoke test). Let me know whether you prefer me to open the PR or you will pick this up.

## Debug Agent Findings (2026-01-09)
- Ran the validator script logic; `bash` was not available in this environment so I inspected `paperless-ngx/docker-compose.env` directly — **INDEX_DIR**, **MEDIA_DIR**, and **VISUAL_RAG_INDEX_NAME** are present and non-empty.
- Started the sidecar: `cd paperless-ngx && docker compose up -d visual-rag`. Docker Compose emitted interpolation warnings (e.g., `MEDIA_DIR`, `INDEX_DIR`, `VISUAL_RAG_INDEX_DIR`, `VISUAL_RAG_INDEX_NAME`, `DEFAULT_INDEX_NAME` not set), which caused the container to receive empty env values for those keys. Use `docker compose --env-file docker-compose.env up -d --build visual-rag` or export the envs into your shell before `docker compose up` so variable interpolation works as expected.
- Smoke test failed: `/health` response was missing `index_resolved_path` and `hf_hub_offline_mode`.

**Evidence collected:**
- `docker logs visual_rag` (excerpt):

```
2026-01-09 03:48:01,187 - visual_rag - INFO - Index directory: .
2026-01-09 03:48:01,187 - visual_rag - INFO - Media directory: .
2026-01-09 03:48:06,683 - visual_rag - WARNING - Index path . exists but is not a valid Byaldi index. Proceeding to load model only.
2026-01-09 03:48:06,683 - visual_rag - ERROR - Failed to load model: This pre-release version of Byaldi only supports ColPali and ColQwen2 for now. Incorrect model name specified.
Traceback (most recent call last):
  ... ValueError: This pre-release version of Byaldi only supports ColPali and ColQwen2 for now. Incorrect model name specified.
```

- `/status` output:

```
{"indexing_in_progress":false,"indexed_documents":0,"index_name":"","index_path":".","last_error":"Failed to load model: This pre-release version of Byaldi only supports ColPali and ColQwen2 for now. Incorrect model name specified.","ready":false}
```

**Root causes:**
1. Docker Compose variable interpolation did not pick up values from `docker-compose.env`, resulting in container envs being empty (index/media path became `.` and index name blank).
2. The configured model (`TomoroAI/tomoro-colqwen3-embed-8b`) is incompatible with the Byaldi version in the image (Byaldi pre-release supports ColPali and ColQwen2 only).

**Recommended next steps:**
1. Recreate the `visual-rag` container with correct variable interpolation:
   - `docker compose --env-file docker-compose.env up -d --build visual-rag` (preferred), or
   - `export $(grep -v '^#' docker-compose.env | xargs) && docker compose up -d --build visual-rag`.
2. Resolve model compatibility:
   - Option A: Update `VISUAL_RAG_MODEL` to a model supported by Byaldi (e.g., ColPali or ColQwen2), or
   - Option B: Update Byaldi in `services/visual-rag-sidecar` to a version that supports `TomoroAI/tomoro-colqwen3-embed-8b`, then rebuild (`docker compose build visual-rag`) and restart.
3. Re-run: `python test/smoke/test_visual_rag_health.py` and verify `/health` contains `index_resolved_path` and `hf_hub_offline_mode` and that `model_loaded:true` and `index_loaded:true` where appropriate.

**Action:** Updating handoff and assigning back to `implement-agent` for model compatibility or image rebuild. Please review the recommended steps and confirm whether you prefer a model change or an image upgrade; I can open the PR or a follow-up issue once you confirm.
