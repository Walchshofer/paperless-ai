# Visual RAG — Tomoro (ColQwen3) Integration

This short reference explains what the Visual RAG sidecar is, the **Tomoro / ColQwen3** model we use (`tomoro-colqwen3-embed-8b`), and how it is used inside the Expert Pipeline.

## At-a-glance ✅

- **Service:** Visual RAG Sidecar (FastAPI) — provides vision-language embeddings and element detection for documents and frames.
- **Model:** Tomoro / ColQwen3 (`TomoroAI/tomoro-colqwen3-embed-8b`) — multimodal vision-language embedding model (embedding dim: **320**, context: **32k**, recommended VRAM **12GB+**).
- **Primary use:** OCR-free retrieval and layout-aware search (tables, charts, fonts, bounding boxes) used by the Expert Pipeline for visual-first retrieval and field extraction.

---

## Key model characteristics 🔧

- Embedding-focused: the model produces visual-layout-aware embeddings (320-d) that capture structure and appearance, not just raw text.
- Vision-language: it understands the relationship between visual layout and textual content, enabling precise field localization and table/chart retrieval.
- Resource needs: GPU recommended; **12GB+ VRAM** for inference and indexing; CPU-only setups are possible but not recommended for production.
- Compatibility: for stable use we pin `transformers==4.57.3` and load `byaldi` (use `git+https://github.com/AnswerDotAI/byaldi@main#egg=byaldi` until a compatible release exists).

---

## Configuration & environment variables ⚙️

Important envs (also present in `paperless-ngx/docker-compose.env`):

- `VISUAL_RAG_MODEL` — e.g. `TomoroAI/tomoro-colqwen3-embed-8b`
- `VISUAL_RETRIEVAL_MODEL` — same as above (alias used by some deployment scripts)
- `BYALDI_VERSION` — use `main` to pick up ColQwen3 support until a release is available
- `TRANSFORMERS_VERSION` — recommended `4.57.3`
- `VISION_RENDER_DPI` — recommended **300** for better table/chart detection (reduces false negatives at the cost of larger images)
- `VISUAL_RAG_MAX_CONCURRENT` — limit concurrent visual queries (default **5**) to protect VRAM and latency
- `HF_HUB_OFFLINE_MODE` / marker files — used to avoid long first-run downloads in offline CI

Note: When changing the model or Byaldi version, coordinate with infra for image rebuilds and GPU/driver compatibility checks.

---

## How the Expert Pipeline uses Visual RAG 🔁

1. During Stage 4 (Parallel OCR + Visual Element Detection) the pipeline calls the visual sidecar to detect elements (tables, text blocks, figures) and get page-level embeddings.
2. Stage 5.5 (Visual Query Generation) creates targeted queries (bounding-box-focused questions) which are executed against the Visual RAG index in Stage 8.
3. Results are returned with bounding boxes and evidence references and then reconciled with OCR outputs (Tesseract or visual OCR) in extraction stages.
4. The system uses Visual-first Retrieval (V2): prefer visual hits for structured data (tables, numbers), fall back to text retrieval for text-heavy documents.

Operational policies:
- Visual results must include evidence refs and a bounding box to be used for automated extraction.
- The circuit-breaker protects the pipeline from long-running or failing visual queries — when open, visual stages are skipped and extraction-only logic proceeds.

---

## Indexing and ingestion notes 📦

- The sidecar indexes rendered PDF pages (images) and stores vector indices — re-indexing is required if switching models or index settings.
- For offline CI: pre-seed index directory with `.hf_hub_download_complete` and a valid index snapshot to avoid large downloads during test runs.
- Recommended PDF render DPI: **300** (higher improves detection of small fonts/tables at cost of memory and index size).

---

## Healthchecks & tests ✅

- Health endpoints:
  - `GET /ready` — returns 200 when `model_loaded:true`
  - `GET /health` — contains fields: `model_loaded`, `hf_hub_offline_mode`, `last_error`, `index_resolved_path`
  - `GET /status` — includes `ready` and `last_error`

- CI & smoke tests:
  - `python test/smoke/test_visual_rag_health.py` — verifies `/health` and `/status` expectations
  - Docs tests expect references to ColQwen3/Tomoro in `VISUAL_RAG_INTEGRATION.md` and `docs` (keep contents in sync)

- Docker Compose healthcheck snippet (useful in `paperless-ngx/docker-compose.yml`):

```yaml
healthcheck:
  test: ['CMD-SHELL', "curl -fsS --max-time 5 http://localhost:8001/ready || (curl -fsS --max-time 5 http://localhost:8001/health | grep -q 'model_loaded.*true')"]
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 30s
```

---

## Troubleshooting checklist ⚠️

If the sidecar fails to load or `model_loaded:false`:
- Check container logs for Byaldi/transformers errors (incompatible wheel, CUDA driver mismatch).
- Ensure `BYALDI_VERSION` is `main` if you require an upstream patch for ColQwen3.
- Verify `TRANSFORMERS_VERSION==4.57.3` and compatible `torch` wheel for the target CUDA toolkit.
- Confirm GPU availability and VRAM (12GB+) or reduce concurrency and DPI for low-memory hosts.
- For CI: ensure index directory contains `.hf_hub_download_complete` to avoid heavy downloads.

If queries return poor hits:
- Increase `VISION_RENDER_DPI` or reduce `VISUAL_RAG_MAX_CONCURRENT` to reduce GPU memory pressure.
- Verify that visual queries include OCR snippets as context and that the Query Generator uses appropriate domain templates.
- Re-index with higher DPI or different segmentation parameters.

---

## Acceptance & migration notes ✅

- When changing model or BYALDI, update the docs first (`docs/ENVIRONMENT_VARIABLES.md` and `docs/VISUAL_RAG_INTEGRATION.md`), then update `paperless-ngx/docker-compose.env`, `services/visual-rag-sidecar/requirements.txt`, and open a PR with a short migration checklist and CI validation steps.

---

## Quick checklist (copy-paste) 📋

- [ ] Set `VISUAL_RAG_MODEL=TomoroAI/tomoro-colqwen3-embed-8b`
- [ ] Pin `TRANSFORMERS_VERSION=4.57.3` and `BYALDI_VERSION=main` if needed
- [ ] Ensure GPU with >=12GB VRAM or reduce `VISION_RENDER_DPI` / concurrency
- [ ] Add docker-compose healthcheck and wait for `healthy` in CI
- [ ] Seed indices for offline CI or pre-download hub artifacts
- [ ] Run `python test/smoke/test_visual_rag_health.py` and `npm test` (docs tests)

---

If you want, I can also add a short troubleshooting flowchart or a quick-run script for local validation (start visual sidecar, wait for ready, run smoke test).