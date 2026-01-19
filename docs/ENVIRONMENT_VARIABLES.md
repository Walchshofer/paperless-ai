# Environment Variables Reference

This document provides a complete reference for all environment variables used in the paperless-ai system, with a focus on model configuration.

## Source of Truth (Multi-Container)
The authoritative environment file for the multi-container setup is:
- `C:\Users\pwalc\MyApps\paperless-ai\docker-compose.env` (repo root)

> A compatibility `.env` (repo root `./.env`) is auto-generated from `docker-compose.env` for legacy `docker-compose` clients.

All runtime variables for Paperless-NGX + paperless-ai should live there. Other
`.env` files are pointers only to avoid duplication. Always run Compose with:
`docker compose --env-file docker-compose.env ...`

> Compatibility note: some environments (notably older `docker-compose`/`docker-compose` hyphen clients on Windows) automatically load a `.env` file from the compose directory. To keep `docker-compose.env` as the single source of truth, we provide `scripts/sync_dotenv_from_compose_env.sh` (and a PowerShell variant) which generates `paperless-ngx/.env` from `docker-compose.env` as-needed. Run `scripts/sync_dotenv_from_compose_env.sh` to create/update the compatibility `.env` file. The generated `.env` is ignored by Git (see `.gitignore`).

> If the source `docker-compose.env` is missing (for example on hosted CI runners), the sync scripts now emit a warning and create a **minimal, safe fallback** `.env` (containing test DB credentials and translation test defaults) so validation workflows can proceed. This fallback is intended for CI/testing only and should not be used in production.

## Gaps found between docs and compose files (summary) ⚠️

> See also: the migration guide: `docs/ENV_DOTENV_MIGRATION.md` — provides a step-by-step checklist for migrating to a repo-root `.env` compatibility file and CI validation flows.


We audited `docs/ENVIRONMENT_VARIABLES.md` against the authoritative `paperless-ngx/docker-compose.env` and `paperless-ngx/docker-compose.yml` and found these practical gaps and pain points:

- **Index-name inconsistency (HIGH RISK)**: Some code and tools reference `DEFAULT_INDEX_NAME`, while compose and docs recommend `VISUAL_RAG_INDEX_NAME`. This creates brittle config and test failures. Recommendation: standardize on `VISUAL_RAG_INDEX_NAME` and maintain `DEFAULT_INDEX_NAME` as a backward-compatible alias (e.g., set `DEFAULT_INDEX_NAME=${VISUAL_RAG_INDEX_NAME}` in `docker-compose.env`).

- **MEDIA_DIR canonicalization (IMPLEMENTED)**: The webserver uses `PAPERLESS_MEDIA_ROOT` (`/usr/src/paperless/media`) while the sidecar expects `MEDIA_DIR` (`/media/paperless`). This is resolved via environment variable aliasing in `docker-compose.env:60`:

  ```bash
  MEDIA_DIR=${PAPERLESS_MEDIA_ROOT:-/media/paperless}
  ```

  The visual-rag service explicitly receives `MEDIA_DIR` via `docker-compose.yml:116` environment mapping. The dual mount paths are intentional:
  - Host `./media` → webserver `/usr/src/paperless/media` (read-write)
  - Host `./media` → visual-rag `/media/paperless:ro` (read-only)

  This separation prevents accidental writes from the visual-rag sidecar.

- **Empty/optional envs left blank**: Several envs (e.g. `DEFAULT_INDEX_NAME`) are defined but left empty in `docker-compose.env`. This increases risk of accidental empty-override behavior. Recommendation: ensure critical envs are explicitly set or use variable expansion to fall back to recommended defaults.

- **Health/observability mismatch**: Operators expect `index_resolved_path` and `hf_hub_offline_mode` to be surfaced on `/health` (easy curl checks). The sidecar only logs these and exposes them in `/status`. Recommendation: include `index_resolved_path` and `hf_hub_offline_mode` in `/health` and export Prometheus-friendly gauges (e.g., `visual_rag_hf_hub_offline_mode`).

- **Dockerfile docs vs required build args**: Sidecar Dockerfile expects CUDA/PyTorch wheels (cu124) and sets compilation-related `TORCH_CUDA_ARCH_LIST`. Recommendation: document `ARG CUDA_TOOLKIT` and required wheel tags in both Dockerfile comments and `docs/ENVIRONMENT_VARIABLES.md` so CI and infra can coordinate CUDA toolchain versions.

---

## Recommended env-management strategy (simple, safe) ✅
Goal: keep `paperless-ngx/docker-compose.env` as the single source of truth while making device/service-specific mappings explicit and testable.

1. **Canonical names & safe aliases**
   - Pick canonical env names for service-critical settings. Example for Visual RAG:
     - Canonical: `VISUAL_RAG_INDEX_NAME`, `VISUAL_RAG_INDEX_DIR`, `VISUAL_RAG_TIMEOUT`, `MEDIA_DIR`
     - Back-compat alias: set `DEFAULT_INDEX_NAME=${VISUAL_RAG_INDEX_NAME}` in `docker-compose.env`
   - Document the canonical names in `docs/ENVIRONMENT_VARIABLES.md` and mark aliases as compat-only.

> CI: A GitHub Actions workflow `validate-env` runs on PRs and `main`. It attempts to generate a compatibility `.env` from `docker-compose.env` (repo root) and runs `scripts/validate_env_py.py` and the unit tests. The job will fail when required variables are missing or empty; this prevents changes that break the env contract from being merged.
2. **Explicit service environment mapping in `docker-compose.yml`**
   - Use `env_file: .env` (generated from `docker-compose.env` for legacy `docker-compose` compatibility) for global vars, and add an `environment:` block for any service-specific variable renames or required fallbacks. This makes intent explicit and prevents silent misconfiguration.

3. **.env.example + required-vars schema**
   - Commit `docker-compose.env.example` containing the minimal required variables (no secrets). Keep `docker-compose.env` authoritative in the deployment repo; developers make local copies from the example.
   - Add `docker-compose.env.schema.json` (or YAML) that lists required variables and defaults.

4. **CI validation + pre-merge check**
   - Add a `scripts/validate_env.sh` (or `validate_env.py`) to assert critical variables are present and non-empty: `INDEX_DIR`, `VISUAL_RAG_INDEX_NAME` (or `DEFAULT_INDEX_NAME`), `MEDIA_DIR`. Run this script in a new GitHub Actions job `validate-env` on PRs.

5. **Secrets & sensitive values**
   - Migrate secrets (API keys, DB passwords) out of the repo file into Docker secrets or use environment secret managers in CI/CD. Keep `docker-compose.env` minimal for required runtime non-sensitive defaults.

6. **Observability and health checks**
   - Add `index_resolved_path` and `hf_hub_offline_mode` to `/health` (or `/status`) and emit prometheus gauges. Add a smoke-test that curls `/health` and asserts these values during CI smoke runs.

7. **Document the process**
   - Add a short `CONTRIBUTING` section describing the steps to add/change envs: update `docker-compose.env`, run `scripts/validate_env.sh`, and update `docs/ENVIRONMENT_VARIABLES.md`.

---

## Implementation checklist (practical steps) 🔧
1. Update `docker-compose.env` (repo root):
   - Add `MEDIA_DIR=${PAPERLESS_MEDIA_ROOT:-/media/paperless}`
   - Add `DEFAULT_INDEX_NAME=${VISUAL_RAG_INDEX_NAME:-paperless_visual}` (or set non-empty value)
2. Update `docker-compose.yml` (repo root):
   - Under `visual-rag` service add `environment:` entries for `MEDIA_DIR`, `INDEX_DIR`, `VISUAL_RAG_INDEX_NAME`, `DEFAULT_INDEX_NAME`.
3. Update `docs/ENVIRONMENT_VARIABLES.md` with this rationale and add a CONTRIBUTING snippet that explains the process (see below).

### How to run validation & smoke tests locally
- Validate env file (non-destructive):

```bash
# from repo root
bash ./scripts/validate_env.sh
```

- Smoke test Visual RAG `/health` (requires `visual-rag` running locally or in your compose stack):

```bash
# ensure the sidecar is available at VISUAL_RAG_URL or default http://localhost:8001
python3 test/smoke/test_visual_rag_health.py
```

4. Add a `validate-env` GitHub Actions job that runs `scripts/validate_env.sh` on PRs (we added a workflow stub `.github/workflows/validate-env.yml`). Ensure the validator includes checks for the new video env vars: `VIDEO_FRAME_INTERVAL` (positive integer) and `VIDEO_KEYFRAME_DETECTION` (yes|no).
5. Add explicit validations in `scripts/validate_env.sh` to:
   - Fail if `INDEX_DIR`, `VISUAL_RAG_INDEX_NAME` (or `DEFAULT_INDEX_NAME`) or `MEDIA_DIR` are empty.
   - Validate `VIDEO_FRAME_INTERVAL` is an integer >= 1.
   - Validate `VIDEO_KEYFRAME_DETECTION` is one of `yes|no`.
6. Optionally add a `docker-compose.env.example` with minimal, non-sensitive defaults for developers to copy.


## Model Configuration Environment Variables

### Production Tier - Router/Classification
- `PLANNER_MODEL` - Multimodal planner for visual classification (default: `qwen3-vl:8b`)
- `ROUTER_MODEL` - Expert pipeline router model (default: `qwen3-vl:8b`)
- `OLLAMA_VISION_MODEL` - Default vision model for Ollama (default: `qwen3-vl:8b`)

### Router Retry Configuration
- `ROUTER_MAX_RETRIES` - Maximum retry attempts for router classification (default: `3`)
- `ROUTER_RETRY_BASE_DELAY` - Base delay in milliseconds for exponential backoff (default: `1000`)
- `ROUTER_RETRY_MAX_DELAY` - Maximum delay cap in milliseconds for exponential backoff (default: `10000`)
- `ROUTER_ENABLE_MODEL_CHECK` - Enable pre-flight model availability check (default: `yes`)
- `ROUTER_MODEL_CHECK_TIMEOUT` - Timeout for model availability check in milliseconds (default: `5000`)

Adjust these values when operating in high-latency or resource-constrained environments. For example, reduce `ROUTER_RETRY_BASE_DELAY` for faster transient retry cycles in CI tests, or increase `ROUTER_MAX_RETRIES` for unstable network conditions.

### Production Tier - Medical Domain
- `MEDICAL_VISION_MODEL` - Medical imaging analysis model (default: `llava-med-v1.6`)
- `MEDICAL_ANALYSIS_MODEL` - Clinical text extraction model (default: `medtext-llama3`)
- `MEDICAL_RADIOLOGY_MODEL` - Radiology imaging analysis model (default: `llava-med-v1.6`)

### Production Tier - Financial Domain
- `FINANCIAL_ANALYSIS_MODEL` - Financial reasoning and math validation model (default: `fino1-8b`)
- `FINANCIAL_VISION_MODEL` - Financial extraction and multilingual analysis model (default: `llm-pro-finance-8b`)
- `VAT_EXPERT_MODEL` - VAT compliance and tax analysis model (default: uses `FINANCIAL_VISION_MODEL`)

### Production Tier - General Purpose
- `GENERAL_MODEL` - General fallback model for unclassified documents (default: `sauerkraut-llama3.1:8b`)
- `OLLAMA_MODEL` - Default text model for Ollama (default: `sauerkraut-llama3.1:8b`)

### Advanced Tier - Reasoning Models (Optional, Feature-Flagged)
- `DRAGON_MODEL` - Advanced multilingual reasoning model for complex analysis (default: null, planned: `llm-pro-finance-8b`)
- `GPT_OSS_MODEL` - OpenAI-compatible reasoning model for agentic tasks (default: null, planned: `gpt-oss`)
- `ENABLE_ADVANCED_REASONING` - Feature flag to enable advanced reasoning models (default: `no`)

### Infrastructure Tier - Orchestration & Embeddings
- `ORCHESTRATOR_MODEL` - System orchestration and routing model (default: `nemotron-orchestrator:8b`)
- `EMBEDDING_MODEL` - Semantic embedding model for RAG (default: `nomic-embed-text-v1.5`)
- `VISUAL_RAG_MODEL` - Visual RAG sidecar model (default: `TomoroAI/tomoro-ai-colqwen3-embed-4b-awq`)
- `INDEX_DIR` - Index directory for Visual RAG sidecar (default: `/data/indices`) **MUST NOT be empty**. **Note:** The sidecar is stateful by default — it writes `.pt` tensor files into `INDEX_DIR` and expects this path to be mounted to persistent storage (see `docker-compose.yml`). If you prefer a stateless compute-only sidecar that returns embeddings and leaves storage to the main application, follow the "Stateful vs Stateless" guidance in `services/visual-rag-sidecar/README.md`.
- `QDRANT_HOST` - Qdrant host (default: `qdrant`)
- `QDRANT_PORT` - Qdrant HTTP port (default: `6333`)
- `QDRANT_API_KEY` - Qdrant API key (optional; required for cloud deployments)
- `ENABLE_VISUAL_RETRIEVAL` - Feature flag for visual search capabilities (default: `no`)
- `ENABLE_ORCHESTRATOR` - Feature flag for intelligent expert routing (default: `no`)
- `ORCHESTRATOR_PREVISION_NORMALIZATION_ENABLED` - Enable pre-vision image normalization tool calls (default: `no`, inherits `ORCHESTRATOR_PREVISION_TOOLS_ENABLED`)
- `HF_TOKEN` - Hugging Face authentication token for accessing private/gated models (e.g., TomoroAI ColQwen3 models). Required for private repositories. Get your token from https://huggingface.co/settings/tokens (default: **not set**)
- `HF_HUB_OFFLINE` - When set to `1|true`, the sidecar will run in offline-only mode and not contact Hugging Face Hub; if unset, the sidecar may allow an initial one-time download for first-run setup (default: **not set**)

**Offline runtime behavior:** The Visual RAG sidecar writes a marker file (`.hf_hub_download_complete`) into the configured `INDEX_DIR` (default `/data/indices`) after the first successful model load. If the marker is present, the sidecar will set `HF_HUB_OFFLINE=1` on subsequent starts and refuse further downloads. To pre-seed a fully offline system, populate the Hugging Face cache volume and create the marker file before starting the container (e.g., `touch ./data/indices/.hf_hub_download_complete`).

---

## Visual RAG - Tuning and Safety Recommendations (RTX 3090 Ti)

**Problem:** If `INDEX_DIR` is present in the environment file but left empty (for example `INDEX_DIR=`), Python's `os.getenv("INDEX_DIR", "/data/indices")` returns an empty string and `Path('')` resolves to `.` (the container working directory). This causes the sidecar to treat the current working directory as the index location and can trigger 'invalid index' errors at startup.

**Required fix:** Ensure `INDEX_DIR` and `VISUAL_RAG_INDEX_DIR` are explicitly set and aligned with your compose volumes (defaults are provided below). Do NOT leave these variables empty.

Recommended values for a single NVIDIA RTX 3090 Ti (24GB VRAM):

- `INDEX_DIR=/data/indices` (container mount)
- `VISUAL_RAG_INDEX_DIR=/data/indices` (must match INDEX_DIR)
- `VISUAL_RAG_INDEX_NAME=paperless_visual`
- `MAX_SPLIT_SIZE_MB=512` (mirrors `PYTORCH_CUDA_ALLOC_CONF`)
- `PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512`
- `VISION_RENDER_DPI=300` (recommended for ColQwen3 workloads; use `150` for conservative settings to reduce memory/index size)
- `MAX_VISION_PAGES=5` (conservative; increase only if testing shows headroom)
- `VISUAL_RAG_TIMEOUT=600000` (10 minutes; used during initial indexing)
- `VIDEO_FRAME_INTERVAL=1` (seconds between sampled frames when indexing video; lower increases coverage and index size)
- `VIDEO_KEYFRAME_DETECTION=yes` (enable keyframe/scene-based sampling to reduce redundant frames)

**Notes:**
- `VISION_RENDER_DPI=300` gives better fidelity for small fonts, tables and charts; increase only if you have sufficient GPU memory and storage. Video indexing can be configured by `VIDEO_FRAME_INTERVAL` or by enabling `VIDEO_KEYFRAME_DETECTION` to capture scene changes rather than fixed intervals.
- `VISUAL_RAG_QUERY_TIMEOUT=500` (ms; short query-level timeout used for visual search operations - defaults to 500ms to preserve low-latency behavior)
- `VISUAL_RAG_MAX_CONCURRENT=5` (max concurrent visual queries against the sidecar; default 5 to limit resource contention)

**Package upgrades required in `services/visual-rag-sidecar/requirements.txt`**:
- `git+https://github.com/AnswerDotAI/byaldi@main#egg=byaldi` (use `@main` until a release includes ColQwen3 name/compatibility fixes)
- `transformers==4.57.3` (Qwen2.5-VL / ColQwen3 compatibility — use the 4.57.x release series)
- `torch==2.7.1` and `numpy==1.26.4` (aligned with `colpali-engine` constraints and RTX 3090 Ti compatibility)
- Ensure `flash-attn` and any acceleration libs are built for your CUDA toolkit (see sidecar README for build steps)

**Operational notes:**
- **Authentication for private models (TomoroAI)**: If using `VISUAL_RAG_MODEL=TomoroAI/tomoro-colqwen3-embed-8b` or other private/gated models, you MUST set `HF_TOKEN` in `docker-compose.env`. Obtain your token from https://huggingface.co/settings/tokens and ensure it has access to the private repository. Without a valid token, model loading will fail with a 401 Unauthorized error.
- Leave `HF_HUB_OFFLINE` unset on first startup to allow the one-time download, then set it to `1` (or use the presence of the marker file) for strictly offline restarts.
- Confirm marker creation: `/data/indices/.hf_hub_download_complete` after a successful initial model load.

## Tomoro / ColQwen3 (Vision-Language) — Supported Inputs & Processing

The ColQwen3 model (specifically `tomoro-colqwen3-embed-8b`) is a multimodal **vision-language** model. When used via the Byaldi library in the Visual RAG sidecar, it focuses on the *visual layout* of documents rather than only extracting text. Below are the supported input types and how they are handled in the sidecar:

- **PDF Documents (`.pdf`)**
  - **Rendering:** PDFs are rendered to high-resolution images (e.g., via `pdf2image` / `poppler`). We recommend rendering at **300 DPI** for most documents (configurable via `VISION_RENDER_DPI`).
  - **OCR-free retrieval:** Rather than extracting text, ColQwen3 embeds visual features (tables, charts, fonts, layout) into the vector space.
  - **Late interaction:** Text queries are encoded into the same multi-vector space and matched against visual patches (page / region level).

- **Standard Image Formats (`.png`, `.jpg`, `.jpeg`, `.tiff`, `.webp`)**
  - Images are encoded directly by the vision encoder, making the model suitable for scanned receipts, screenshots, or infographics.

- **Video Files (`.mp4`, `.avi`, `.mov`, etc.)**
  - **Frame sampling:** Videos are processed by sampling frames at configured intervals. Each sampled frame is treated like a "page" and indexed as a visual asset.
  - **Search:** Text queries can retrieve a video and a frame index by visual semantics (e.g., "person wearing red hat").

- **Text (query input)**
  - Text queries are mapped into the same vector space as images/frames, enabling Text→Image and Text→Video retrieval.

**Operational notes:**
- Byaldi handles the preprocessing (PDF→images, frame sampling) automatically when you point the sidecar at an `INDEX_DIR` directory containing PDFs/images. For large datasets or CI, consider pre-seeding indices (or the `.hf_hub_download_complete` marker) to avoid long first-run downloads.
- Recommended PDF render DPI is 300; raising DPI increases fidelity but also memory and index size.
- For video indexing, tune sampling intervals to balance coverage vs. index size.

**Summary (dev reference):**

| Input Type | Handling Mechanism | Best For |
| --- | --- | --- |
| **PDF** | Rendered to images (default 300 DPI) and visual embedding | Complex reports, financial statements, charts |
| **Images** | Direct visual encoding | Scans, photos, UI screenshots, infographics |
| **Video** | Sampled into frames that are encoded like pages | Video archives, security footage, recorded presentations |
| **Text** | Encoded as a multi-vector query | Search queries like "Find the Q3 bar chart" |

For implementation and processing details, see the Byaldi / MultiModal indexing guidance (example reference): https://www.youtube.com/watch?v=-sX1zyhdY9o

---

## Advanced (Code-Level) Environment Variables
Below are the advanced variables (section 20 in `docker-compose.env`) with recommended values and short rationale. These are intended for operators and infra engineers — change carefully and prefer using secrets managers for sensitive values.

- `ANALYSIS_RENDER_DPI` — Recommended: `150`. Controls rendered image DPI for OCR/visual features (higher increases accuracy and memory).
- `AZURE_API_KEY` — Optional (sensitive). Azure OpenAI key if using Azure provider.
- `AZURE_API_VERSION` — Optional. Azure API version string (e.g., `2023-05-15-preview`).
- `AZURE_DEPLOYMENT_NAME` — Optional. Azure deployment identifier when using Azure-hosted models.
- `AZURE_ENDPOINT` — Optional. Azure inference endpoint URL.
- `BIAS_ENGINE_METRICS_URL` — Optional. URL for bias-engine metrics endpoint when remote collection is used.
- `BIAS_ENGINE_TEST_MODE` — Default: `mock` for local tests, `real` for production testing.
- `CUSTOM_FIELDS` — Optional JSON string (e.g., `{"custom_fields":[]}`) used by prompt templates.
- `DEFAULT_INDEX_NAME` — Default: `paperless_visual`. Index name used when none provided.
- `ENABLE_EXPERT_PIPELINE` — `yes|no`. Enable expert orchestration pipelines.
- `ENABLE_LEGACY_FALLBACK` — `no` by default. When `yes`, try legacy behaviors for backward compatibility.
- `ENABLE_MEDICAL_PIPELINE` — `no` by default. Enable medical domain-specific steps and models.
- `ENABLE_METRICS` — `yes` to emit metrics to Prometheus/Grafana.
- `ENABLE_OVERLAY_EXTRACTION` — `yes` to extract overlay metadata during ingestion.
- `ENABLE_VAT_RAG` — `no` by default; enable only for VAT-specific workflows.
- `ENABLE_VISUAL_RAG_SIDECAR` — Recommended: `yes` to start sidecar in compose stacks.
- `EXPERT_MODELS_CACHE_TTL_MS` — Optional: TTL for caching expert models (ms), e.g., `86400000`.
- `EXTERNAL_API_BODY` — Optional: body template for external API calls.
- `EXTERNAL_API_ENABLED` — `yes|no`. Enable external webhook calls or integrations.
- `EXTERNAL_API_HEADERS` — Optional: JSON map of headers for external calls.
- `EXTERNAL_API_METHOD` — Default: `POST`.
- `EXTERNAL_API_TIMEOUT` — Default: `30000` (ms).
- `EXTERNAL_API_TRANSFORM` — Optional: transform script name for responses.
- `EXTERNAL_API_URL` — Optional: endpoint for external enrichment.
- `FINANCIAL_VAT_EXPERT` — Optional: model or config name for VAT workflows.
- `GUIDANCE_ENABLED` — Default: `yes`. Toggle for guidance-service integration.
- `GUIDANCE_MAX_RETRIES` — Default: `3`.
- `GUIDANCE_RETRY_DELAY` — Default: `1000` (ms).
- `GUIDANCE_STREAMING_ENABLED` — `yes|no` to enable streaming guidance outputs.
- `GUIDANCE_STREAMING_THRESHOLD` — Optional token/size threshold for streaming.
- `GUIDANCE_TAG_SCHEMA_VERSION` — Optional schema version for Guidance prompts.
- `INDEX_DIR` — **Required**: set to `/data/indices` (container path). MUST NOT be empty; leaving it empty causes Python to treat `.` as the index path and can lead to startup failures.
- `LEGACY_SOURCE_DIR` — Optional: path on host for legacy migrations.
- `LEGAL_ANALYSIS_MODEL` — Optional legal model identifier.
- `LEGAL_ORCHESTRATOR_MODEL` — Optional model for legal orchestration.
- `LEGAL_VISION_MODEL` — Optional vision model for legal workflows.
- `MOE_MIN_QUALITY` — Optional threshold float for MOE gating.
- `MOE_RETRIEVAL_ENABLED` — `yes|no` for MOE retrieval.
- `MOE_WEIGHT_FINANCIAL`, `MOE_WEIGHT_GENERAL`, `MOE_WEIGHT_LEGAL`, `MOE_WEIGHT_MEDICAL` — Floats (default `1.0`) for weighting MOE routing.
- `OCR_CHECKPOINT_CONTINUE_ON_PARTIAL_SUCCESS` — `yes|no` (default `yes` recommended for robustness).
- `OCR_CHECKPOINT_ENABLED` — `yes|no` to enable checkpointing.
- `OCR_CHECKPOINT_FAIL_FAST` — `no` recommended to tolerate partial failures.
- `OCR_CHECKPOINT_MAX_RETRIES` — Default: `3`.
- `OCR_CHECKPOINT_REQUIRED` — `yes|no` to mark checkpoint as required.
- `OCR_CHECKPOINT_RETRY_DELAY` — Default: `1000` (ms).
- `OCR_CHECKPOINT_TRANSLATIONS_ENABLED` — `yes|no` to run translation post-OCR.
- `OLLAMA_EMBEDDING_MODEL` — Optional: embedding model name used by Ollama.
- `OLLAMA_PLANNER_MODEL` — Optional: planner model name for Ollama.
- `OLLAMA_REPAIR_MODEL` — Optional: repair model name.
- `OLLAMA_ROUTER_MODEL` — Optional: router model name.
- `PAPERLESS_AI_PORT` — Default: `3000`.
- `PAPERLESS_CONSUME_DIR` — Host path for inbound documents.
- `PAPERLESS_PASSWORD` — Sensitive; store in secret manager.
- `PROCESS_ONLY_NEW_DOCUMENTS` — `yes|no` (default `no`).
- `PROCESSING_MODE` — `sync|async` (default `async`).
- `RAG_SERVICE_ENABLED` — `yes|no` (default `yes`).
- `RAG_SERVICE_URL` — Default: `http://localhost:8000` or your routed service URL.
- `RESTRICT_TO_EXISTING_CORRESPONDENTS` — `yes|no` to limit created correspondents.
- `RESTRICT_TO_EXISTING_DOCUMENT_TYPES` — `yes|no` to limit document types.
- `RESTRICT_TO_EXISTING_TAGS` — `yes|no` to limit new tag creation.
- `ROUTER_KEEP_ALIVE` — Duration string (e.g., `5m`).
- `SEMANTIC_ROUTER_ENABLED` — `yes|no` to enable semantic router.
- `SEMANTIC_ROUTER_MIN_CONFIDENCE` — Float (e.g., `0.6`).
- `SEMANTIC_ROUTER_WEIGHT_EXPERT`, `SEMANTIC_ROUTER_WEIGHT_GENERAL`, `SEMANTIC_ROUTER_WEIGHT_ROUTER` — Floats for ensemble mixing.
- `SUMMARY_FALLBACK_ENABLED` — `yes|no` to enable text summarization fallback.
- `SUMMARY_FALLBACK_MAX_INPUT_TOKENS` — Integer (e.g., `8192`).
- `SUMMARY_FALLBACK_MAX_SUMMARY_TOKENS` — Integer (e.g., `512`).
- `SUMMARY_FALLBACK_MODEL` — Model name (e.g., `gpt-4o-mini`).
- `SUMMARY_FALLBACK_TEMPERATURE` — Float between `0.0` and `1.0`.
- `SUMMARY_FALLBACK_TIMEOUT` — Integer (ms) (e.g., `300000`).
- `TRANSLATION_MIN_CHARS` — Integer (e.g., `20`).
- `TRANSLATION_MODEL` — Model name used for translations.
- `TRANSLATION_TEMPERATURE` — Float (default `0.0`).
- `TRANSLATION_TIMEOUT` — Integer (ms) (default `60000`).
- `VAT_RAG_DIR` — Optional path for VAT indexes.
- `VAT_RAG_MAX_EXCERPT_CHARS` — Integer (e.g., `500`).
- `VAT_RAG_MAX_RESULTS` — Integer (e.g., `10`).
- `VIS_OCR_EMBEDDING_MODEL` — Default: `nomic-embed-text-v1.5`.
- `VIS_OCR_ENABLED` — `yes|no` to enable visual OCR (default `no`).
- `VIS_OCR_MAX_PAGES` — Integer (default `3-5`).
- `VIS_OCR_MIN_QUALITY` — Integer quality threshold (default `60`).
- `VIS_OCR_TIMEOUT` — Integer (ms) (default `60000`).

**Note:** For any variable that holds secrets (API keys, passwords), prefer using Docker secrets or your environment secret manager instead of plain text in `docker-compose.env`.

### Bias Engine Configuration
- `TOKENIZER_MODEL` - Tokenizer model for bias engine (default: `gpt2`)
  - Controls token ID mapping for logit bias computation in gRPC service
  - Must match or be compatible with models used in guidance-service
  - Location: `guidance-bias-engine/guidance/ipc/grpc_server.py:40`
  - Common options: `gpt2`, `microsoft/phi-2`, `meta-llama/Llama-2-7b-hf`

**Tokenizer Compatibility Matrix**:

| Ollama Model | Recommended Tokenizer | Notes |
|--------------|----------------------|-------|
| `sauerkraut-llama3.1:8b` | `gpt2` | Default, widely compatible |
| `qwen3-vl:8b` | `gpt2` | Default tokenizer works |
| `llama3.1:8b` | `meta-llama/Llama-3.1-8B` | Use Llama tokenizer for exact match |
| `phi-2` | `microsoft/phi-2` | Use Phi tokenizer for exact match |

**Why gpt2 as default?**
- Universal vocabulary covering most tokens
- Fast loading (no authentication required)
- Compatible with most Hugging Face models via fallback tokenization
- Provides acceptable baseline for structured generation

**Performance Implications**:
- Mismatch between tokenizer and target model may reduce bias accuracy
- Exact tokenizer match improves structured generation quality by 5-10%
- gpt2 provides 90%+ accuracy for most models

**Metrics Configuration**:
- `BIAS_ENGINE_METRICS_URL` - Full URL for Prometheus metrics scraping (default: `http://bias-engine:8003/metrics`)
  - Internal container uses `METRICS_PORT=8001`
  - Docker host mapping: `8003:8001` (see docker-compose.yml:146)
  - Prometheus scrapes via container name + host port: `bias-engine:8003`

### Guidance Service Configuration
- `GUIDANCE_MODEL` - Model for structured extraction in guidance-service (default: `sauerkraut-llama3.1:8b`)
- `OLLAMA_API_URL` - Ollama API endpoint for guidance-service container (default: `http://host.docker.internal:11434`)
  - For Docker Desktop (Windows/Mac): Use `http://host.docker.internal:11434`
  - For Docker Compose service networking: Use `http://ollama:11434` (if Ollama runs as a service named 'ollama')
  - For host network mode: Use `http://localhost:11434`

## OpenAI Integration Variables

### Model Configuration
- `OPENAI_MODEL` - OpenAI model to use as alternative provider (default: `gpt-4o-mini`)
- `OPENAI_API_KEY` - OpenAI API key for authentication (required for OpenAI features)
- `OPENAI_BASE_URL` - Custom OpenAI API base URL (optional)

### Service Configuration

## CODEX-Serena Bridge (codex-bridge)

The CODEX-Serena bridge keeps CODEX on STDIO while maintaining an SSE session to Serena. Key environment variables for the bridge are listed below with recommended defaults.

- `SERENA_BASE` — Base URL for Serena (default: `http://127.0.0.1:9121`).
- `SERENA_SSE_URL` — SSE endpoint (default: `${SERENA_BASE}/sse`).
- `SERENA_API_KEY` — Optional API key for Serena (secure secret; default: not set).
- `PROJECT_DIR` — Project directory used for default log file locations (default: repo root).
- `CODEX_BRIDGE_LOG_FILE` — Optional path to bridge log file (default: not set; logs go to stderr).
- `LOG_LEVEL` — Bridge log level (`DEBUG|INFO|WARN|ERROR`, default: `INFO`).
- `SSE_TIMEOUT` — SSE inactivity timeout in seconds (default: `30`).
- `REQUEST_TIMEOUT` — Request forwarding timeout in seconds (default: `60`).
- `MAX_RECONNECT_ATTEMPTS` — Max reconnect attempts before degraded mode (default: `10`).
- `RECONNECT_BACKOFF_BASE` — Reconnect backoff base in seconds (default: `2`).
- `RECONNECT_BACKOFF_MAX` — Reconnect backoff cap in seconds (default: `30`).
- `HEALTH_CHECK_INTERVAL` — Interval in seconds between health checks in connector (default: `15`).

### Examples

Local (bash):

```bash
export SERENA_BASE=http://127.0.0.1:9121
export SERENA_SSE_URL=${SERENA_BASE}/sse
export REQUEST_TIMEOUT=60
export LOG_LEVEL=DEBUG
python codex-bridge.py
```

Docker (docker-compose.env snippet):

```bash
SERENA_BASE=http://serena:9121
SERENA_SSE_URL=${SERENA_BASE}/sse
SERENA_API_KEY=secret-api-key
REQUEST_TIMEOUT=60
SSE_TIMEOUT=30
MAX_RECONNECT_ATTEMPTS=10
RECONNECT_BACKOFF_BASE=2
RECONNECT_BACKOFF_MAX=30
CODEX_BRIDGE_LOG_FILE=/var/log/codex_bridge.log
LOG_LEVEL=INFO
```

Production notes:
- Store `SERENA_API_KEY` in your secrets manager and do not commit it to source control.
- Tune `REQUEST_TIMEOUT` for slow tools (increase to 120–300s) and adjust backoff values for flaky networks.

---

- `ENABLE_OPENAI_FALLBACK` - Enable OpenAI as fallback when Ollama models fail (default: `yes`)
- `OPENAI_MAX_TOKENS` - Maximum tokens for OpenAI requests (default: `4096`)
- `OPENAI_TEMPERATURE` - Temperature setting for OpenAI models (default: `0.7`)

## Ollama Configuration Variables

### Connection Settings
- `OLLAMA_HOST` - Ollama server host (default: `http://localhost:11434`)
- `OLLAMA_TIMEOUT` - Request timeout in milliseconds (default: `300000`)

### Context Window and Token Limits
- `OLLAMA_CONTEXT_WINDOW` - Context window for text models (default: falls back to `TOKEN_LIMIT`)
- `OLLAMA_MAX_RESPONSE_TOKENS` - Max response tokens for text models (default: falls back to `RESPONSE_TOKENS`)
- `OLLAMA_VISION_CONTEXT_WINDOW` - Context window for vision models (default: falls back to `OLLAMA_CONTEXT_WINDOW`). **Recommendation:** if you run `qwen3-vl:8b`, set this to `256000` or provide a per-model override via `OLLAMA_MODEL_LIMITS_JSON` to prevent truncation of long visual prompts (e.g., large invoices or multi-page documents).
- `OLLAMA_VISION_MAX_RESPONSE_TOKENS` - Max response tokens for vision models (default: `2048`)
- `OLLAMA_PLANNER_CONTEXT_WINDOW` - Context window for planner/classifier models (default: falls back to `OLLAMA_VISION_CONTEXT_WINDOW`)

> Tip: Use `OLLAMA_MODEL_LIMITS_JSON` to set exact per-model overrides (JSON map of model -> { contextWindow, maxResponseTokens }) so you can safely run large-context models without changing global defaults.
- `OLLAMA_PLANNER_MAX_RESPONSE_TOKENS` - Max response tokens for planner/classifier models (default: `700`)
- `OLLAMA_EXPERT_CONTEXT_WINDOW` - Context window for expert pipeline models (default: falls back to `OLLAMA_CONTEXT_WINDOW`)
- `OLLAMA_EXPERT_MAX_RESPONSE_TOKENS` - Max response tokens for expert pipeline models (default: falls back to `OLLAMA_MAX_RESPONSE_TOKENS`)
- `OLLAMA_VISION_IMAGE_TOKENS` - Token overhead per image for vision prompts (default: `1024`)
- `OLLAMA_MODEL_LIMITS_JSON` - JSON map of per-model overrides for context/response tokens (default: `{}`)

Example:

```json
{"qwen3-vl:8b": {"vision": {"contextWindow": 256000, "maxResponseTokens": 4096}}}
```

Use this to set precise per-model budgets without changing global defaults.
- `TRANSLATION_CONTEXT_WINDOW` - Context window for local translation (default: falls back to `OLLAMA_CONTEXT_WINDOW`)
- `TRANSLATION_MAX_TOKENS` - Max response tokens for local translation (default: `512`)

### Model Loading
- `OLLAMA_LOAD_MODELS` - Comma-separated list of models to preload on startup (optional)
- `OLLAMA_KEEP_ALIVE` - Keep-alive duration for loaded models (default: `5m`)

## System Configuration Variables

### Hardware and Performance
- `MAX_CONCURRENT_REQUESTS` - Maximum concurrent model requests (default: `3`)  
- `GPU_DEVICE` - GPU device ID for CUDA (default: `0`)
- `ENABLE_GPU` - Enable GPU acceleration (default: `yes`)

### Tag Governance
- `PIPELINE_TAG_REPLACE` - Allow clearing all tags when no existing tags resolve (default: `no`)

### Logging and Monitoring
- `LOG_LEVEL` - Logging level (default: `info`)
- `ENABLE_MODEL_METRICS` - Enable model performance metrics collection (default: `yes`)
- `METRICS_RETENTION_DAYS` - Days to retain metrics data (default: `30`)

## Database Configuration Variables

### Qdrant Vector Database (Primary Vector Storage)
- `QDRANT_HOST` - Qdrant server host (default: `qdrant` for Docker, `localhost` for host)
- `QDRANT_PORT` - Qdrant HTTP API port (default: `6333`)
- `QDRANT_API_KEY` - Optional API key for Qdrant Cloud deployments
- `VECTOR_STORE` - Vector store backend selection (default: `qdrant`, options: `qdrant`, `pgvector` for rollback)

**Qdrant Collections:**
- `document_embeddings` - 384D, Cosine distance (Text RAG)
- `visual_overlays` - 320D, Cosine distance (Visual overlay embeddings)
- `visual_pages` - 320D, Dot product (Visual RAG sidecar)

### PostgreSQL Connection (Metadata Storage)
- `DATABASE_URL` - PostgreSQL connection string (required for metadata storage)
- `DB_SSL` - Enable SSL for database connections (default: `false`)
- `DB_MAX_CONNECTIONS` - Maximum database connections (default: `10`)

### RAG Configuration
- `RAG_CHUNK_SIZE` - Text chunk size for embedding (default: `512`)
- `RAG_OVERLAP` - Chunk overlap size (default: `50`)
- `RAG_TOP_K` - Number of similar documents to retrieve (default: `5`)
- `RAG_SIMILARITY_THRESHOLD` - Minimum similarity score (default: `0.7`)

### PostgreSQL Configuration (Metadata Only)

- `POSTGRES_HOST` - PostgreSQL server host (default: `db` for Docker, `localhost` for host)
- `POSTGRES_PORT` - PostgreSQL server port (default: `5432`)
- `POSTGRES_DB` - Database name (default: `paperless`)
- `POSTGRES_USER` - Database username (required, fallback: `PAPERLESS_DBUSER`)
- `POSTGRES_PASSWORD` - Database password (required, fallback: `PAPERLESS_DBPASS`)
- `PAPERLESS_DBHOST` - Paperless-NGX database host (fallback for `POSTGRES_HOST`)
- `PAPERLESS_DBPORT` - Paperless-NGX database port (fallback for `POSTGRES_PORT`)
- `PAPERLESS_DBNAME` - Paperless-NGX database name (fallback for `POSTGRES_DB`)
- `PAPERLESS_DBUSER` - Paperless-NGX database user (fallback for `POSTGRES_USER`)
- `PAPERLESS_DBPASS` - Paperless-NGX database password (fallback for `POSTGRES_PASSWORD`)

**Requirements:**
- Qdrant 1.7.0+ (Docker image: `qdrant/qdrant:latest`)
- PostgreSQL 16+ (Docker image: `postgres:16` - pgvector no longer required)

**Troubleshooting:**
- Check Qdrant health: `curl http://localhost:6333/health`
- Check collections: `node scripts/check-qdrant-collections.js`
- Check PostgreSQL: `curl http://localhost:3000/health/database`
- See `docs/DATABASE_SETUP.md` and `docs/QDRANT_MIGRATION.md` for detailed guides

## Security and Access Control

### Authentication
- `JWT_SECRET` - JWT signing secret (required)
- `SESSION_TIMEOUT` - Session timeout in minutes (default: `480`)
- `ENABLE_AUTH` - Enable authentication (default: `yes`)

### API Security
- `API_KEY` - API key for external service access (optional)
- `CORS_ORIGIN` - CORS allowed origins (default: `*`)
- `RATE_LIMIT_REQUESTS` - Rate limit requests per minute (default: `100`)

## Feature Flags

### Experimental Features
- `ENABLE_BETA_FEATURES` - Enable beta/experimental features (default: `no`)
- `ENABLE_DEBUG_MODE` - Enable debug logging and features (default: `no`)

### Integration Features
- `ENABLE_SLACK_INTEGRATION` - Enable Slack notifications (default: `no`)
- `ENABLE_TELEGRAM_INTEGRATION` - Enable Telegram bot integration (default: `no`)
- `ENABLE_WEBHOOKS` - Enable webhook notifications (default: `no`)

## Example Configuration Snippets (docker-compose.env)

### Minimal Production Configuration (docker-compose.env)
```bash
# Basic model configuration
PLANNER_MODEL=qwen3-vl:8b
ROUTER_MODEL=qwen3-vl:8b
ORCHESTRATOR_MODEL=nemotron-orchestrator:8b
OLLAMA_MODEL=sauerkraut-llama3.1:8b
OLLAMA_VISION_MODEL=qwen3-vl:8b

# Qdrant (Vector Storage)
QDRANT_HOST=qdrant
QDRANT_PORT=6333
VECTOR_STORE=qdrant

# PostgreSQL (Metadata Storage)
POSTGRES_HOST=db
POSTGRES_USER=paperless
POSTGRES_PASSWORD=your-password

# Security
JWT_SECRET=your-secret-key-here
```

### Full Production Configuration (docker-compose.env)
```bash
# Production tier models
PLANNER_MODEL=qwen3-vl:8b
ROUTER_MODEL=qwen3-vl:8b
ORCHESTRATOR_MODEL=nemotron-orchestrator:8b
MEDICAL_VISION_MODEL=llava-med-v1.6
MEDICAL_ANALYSIS_MODEL=medtext-llama3
FINANCIAL_ANALYSIS_MODEL=fino1-8b
FINANCIAL_VISION_MODEL=llm-pro-finance-8b
GENERAL_MODEL=sauerkraut-llama3.1:8b

# Advanced tier (optional)
ENABLE_ADVANCED_REASONING=yes
DRAGON_MODEL=llm-pro-finance-8b
GPT_OSS_MODEL=gpt-oss

# Infrastructure
EMBEDDING_MODEL=nomic-embed-text-v1.5
ENABLE_VISUAL_RETRIEVAL=yes
VISUAL_RETRIEVAL_MODEL=tomoro-colqwen3-embed-8b

# OpenAI fallback
OPENAI_API_KEY=sk-your-key-here
ENABLE_OPENAI_FALLBACK=yes

# Hardware
MAX_CONCURRENT_REQUESTS=5
GPU_DEVICE=0

# Qdrant Vector Database
QDRANT_HOST=qdrant
QDRANT_PORT=6333
VECTOR_STORE=qdrant

# PostgreSQL (Metadata)
POSTGRES_HOST=db
POSTGRES_USER=paperless
POSTGRES_PASSWORD=your-secure-password

# RAG Configuration
RAG_CHUNK_SIZE=512
RAG_TOP_K=5

# Security
JWT_SECRET=your-secure-secret-here
API_KEY=your-api-key
RATE_LIMIT_REQUESTS=100
```

## Model Alias Support

The system supports model aliases for flexibility. Instead of canonical names, you can use shorter aliases:

```bash
# Using aliases
PLANNER_MODEL=qwen3-vl
ROUTER_MODEL=qwen3-vl
MEDICAL_VISION_MODEL=llava-med
FINANCIAL_ANALYSIS_MODEL=fino1

# Equivalent to canonical names
PLANNER_MODEL=qwen3-vl:8b
ROUTER_MODEL=qwen3-vl:8b
MEDICAL_VISION_MODEL=llava-med-v1.6
FINANCIAL_ANALYSIS_MODEL=fino1-8b
```

See `docs/MODEL_INVENTORY.md` for complete alias mappings.
