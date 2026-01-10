# Visual RAG Sidecar Service

A FastAPI service that provides visual document retrieval using ColQwen3 via the Byaldi library. This service indexes PDF pages as images and enables semantic search that understands document layout, tables, charts, and formatting. ColQwen3 is the only supported model.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Docker Compose                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  paperless-  │───▶│  visual-rag  │◀───│    ollama    │  │
│  │     ai       │    │   :8001      │    │   (shared    │  │
│  │   :3000      │    │              │    │    GPU)      │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                               │
│         ▼                   ▼                               │
│  ┌──────────────┐    ┌──────────────┐                      │
│  │  paperless-  │    │  /data/      │                      │
│  │     ngx      │    │  indices/    │                      │
│  │   :8000      │    │              │                      │
│  └──────────────┘    └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Visual Document Retrieval**: Search documents by visual content (tables, charts, layouts)
- **ColQwen3 Model**: Uses state-of-the-art vision-language model for embedding
- **PDF Page Indexing**: Indexes each PDF page as an image
- **Late Interaction Search**: MaxSim scoring for high-quality retrieval
- **GPU Optimized**: Designed to share GPU with Ollama on RTX 3090 Ti

## Requirements

- **GPU**: NVIDIA GPU with 12GB+ VRAM (RTX 3090 Ti recommended)
- **CUDA**: 12.4+ (PyTorch cu124 wheels)
- **flash-attn**: 2.4.0+ built against the same CUDA toolkit
- **Docker**: With NVIDIA Container Toolkit

**Recommended package versions for ColQwen3 / Tomoro (Jan 2026):**
- `byaldi@main` (install from GitHub main branch for ColQwen3 name/compatibility fixes)
- `torch==2.7.1` and `torchvision==0.22.1` (aligned with `colpali-engine` constraints)
- `numpy==1.26.4` (binary compatibility for late-interaction kernels)
- `transformers==4.57.3` (required for Qwen2.5-VL features)

Ensure these versions are installed when building the sidecar image to avoid resolution or runtime incompatibilities.

## API Endpoints

### Health & Status

```bash
# Health check
curl http://localhost:8001/health

# Response includes:
# {
#   "status": "healthy" | "loading",
#   "model_loaded": true | false,
#   "index_loaded": true | false,
#   "model_name": "TomoroAI/tomoro-colqwen3-embed-8b",
#   "indexed_docs_count": 123,
#   "flash_attn_available": true | false,
#   "flash_attn_version": "2.7.4.post1" | "none"
# }

# Indexing status
curl http://localhost:8001/status
```

#### Offline-first behavior
- The sidecar is designed to run fully offline in production. On first run, if a cached model is not found in the mapped Hugging Face cache volume, the sidecar will temporarily allow downloads from the Hugging Face Hub to fetch the model and any required artifacts.
- After the initial successful model load, the sidecar writes a marker file to the indices directory (`.hf_hub_download_complete`) which enforces `HF_HUB_OFFLINE=1` for subsequent restarts, preventing any further network calls to the Hub.
- The `/health` endpoint now returns two extra fields to make runtime checks simpler:
  - `index_resolved_path` — the path the sidecar resolved for its index (useful to validate your mounted volume), and
  - `hf_hub_offline_mode` — boolean indicating whether the sidecar is currently running in HF offline mode.
- If you prefer to remain fully offline from the start, pre-populate the Hugging Face cache volume (`visual_model_cache`) with the model files and create the marker file manually:

```bash
# create the marker file to indicate model already cached
touch ./data/indices/.hf_hub_download_complete
```

### Document Indexing

```bash
# Index a single PDF
curl -X POST http://localhost:8001/index/document \
  -H "Content-Type: application/json" \
  -d '{"pdf_path": "documents/originals/invoice.pdf", "doc_id": 123}'

# Index a directory of PDFs
curl -X POST http://localhost:8001/index/directory \
  -H "Content-Type: application/json" \
  -d '{"directory": "documents/originals", "recursive": true}'
```

### Search

```bash
# Visual search
curl -X POST http://localhost:8001/search \
  -H "Content-Type: application/json" \
  -d '{"query": "invoice total at the bottom", "k": 5}'
```

### Index Management

```bash
# Clear index
curl -X DELETE http://localhost:8001/index
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VISUAL_RAG_MODEL` | `TomoroAI/tomoro-colqwen3-embed-8b` | Fixed model (override not supported). Setting `vidore/colqwen2-v1.0` triggers a startup error. |
| `INDEX_DIR` | `/data/indices` | Directory for storing indices |
| `MEDIA_DIR` | `/media/paperless` | Directory containing PDFs |
| `DEFAULT_INDEX_NAME` | `paperless_visual` | Name of the index |
| `STORE_COLLECTION` | `false` | Store base64 images in index |
| `HOST` | `0.0.0.0` | Service host |
| `PORT` | `8001` | Service port |
| `MAX_SPLIT_SIZE_MB` | `512` | PyTorch CUDA memory split size |

## Docker Compose Integration

The service is configured in `paperless-ngx/docker-compose.yml`:

```yaml
visual-rag:
  build:
    context: ../paperless-ai/services/visual-rag-sidecar
    dockerfile: Dockerfile
  container_name: visual_rag
  restart: unless-stopped
  ports:
    - "8001:8001"
  environment:
    - NVIDIA_VISIBLE_DEVICES=all
    - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
  volumes:
    - visual_model_cache:/root/.cache/huggingface
    - ./data/visual_indices:/data/indices
    - ./media:/media/paperless:ro
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Install PyTorch with CUDA 12.4
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124

# Install flash-attn (must match CUDA toolkit)
pip install "flash-attn>=2.4.0" --no-build-isolation

# Install poppler (for PDF processing)
# Ubuntu: sudo apt-get install poppler-utils
# macOS: brew install poppler

# Run the service
python main.py
```

## Testing

### Integration Tests

The sidecar includes integration tests in `test/integration/visual-rag/`:

**Health Check Test** (`health.test.js`):
- Polls `/health` endpoint with 90s timeout
- Waits for `model_loaded: true`
- Tolerates first-run model downloads in CI
- Run: `npm test -- test/integration/visual-rag/health.test.js`

**Element Detection Test** (`detect_elements.test.js`):
- Validates `/detect_elements` endpoint payload shape
- Tests with minimal 1x1 PNG image
- Verifies `elements`, `layout`, and `confidence` fields
- Run: `npm test -- test/integration/visual-rag/detect_elements.test.js`

### CI/CD Workflow

The Visual RAG E2E workflow (`.github/workflows/visual-rag-e2e.yml`) runs on:
- Manual trigger (`workflow_dispatch`)
- Changes to `services/visual-rag-sidecar/**`
- Changes to `test/integration/visual-rag/**`

**Steps:**
1. Starts Visual RAG sidecar via Docker Compose
2. Waits for `/ready` endpoint (600s timeout)
3. Runs integration tests with Mocha
4. Tears down containers

**Usage:**
```bash
# Run locally
docker compose up -d visual-rag
npm test -- test/integration/visual-rag --reporter spec
docker compose down -v
```

## Dynamic Registry Injection for ColQwen3

This service implements a comprehensive **Dynamic Registry Injection** strategy to enable ColQwen3 support in Byaldi v0.0.7, which doesn't natively support this model architecture.

### Architecture Overview

The implementation follows a four-phase initialization process:

**Phase 1: Dependency Validation**
- Validates presence of critical packages (transformers, torch, accelerate, flash-attn)
- Provides helpful error messages with exact pip install commands if dependencies are missing
- Checks optional dependencies (qwen_vl_utils) and warns if absent

**Phase 2: ColQwen3Shim Class**
- Production-ready shim class wrapping Hugging Face `AutoModel`
- Implements `torch.nn.Module` interface for Byaldi compatibility
- Handles critical configuration:
  - `trust_remote_code=True` (required for TomoroAI custom architecture)
  - `torch_dtype=torch.bfloat16` (memory efficiency)
  - `device_map="cuda"` or "auto" (GPU placement)
  - `attn_implementation="flash_attention_2"` (prevents OOM on 1280 tokens)
- Implements required methods: `forward()`, `device`, `to()`, `eval()`, `save_pretrained()`

**Phase 3: Registry Injection**
- Monkey-patches `RAGMultiModalModel.from_pretrained()` using `functools.wraps`
- Intercepts ColQwen3 model loading requests (checks for "colqwen3" in model name)
- Routes ColQwen3 requests through ColQwen3Shim
- Delegates all other models to original Byaldi implementation
- Preserves method metadata and fallback behavior

**Phase 4: Operational Validation**
- Validates that the injection is active
- Verifies patched method is properly wrapped
- Provides diagnostic logging for troubleshooting

### Startup Sequence

```
Phase 1: Dependency Validation
  ✅ transformers 4.57.3
  ✅ torch 2.6.0
  ⚠️ qwen_vl_utils not available (optional)
  ✅ accelerate 0.20.0
  ✅ flash-attn 2.7.4
  ✅ All critical dependencies validated

Phase 2: Registry Injection
  🔧 Injecting ColQwen3 support into Byaldi registry...
  ✅ ColQwen3 support injected into Byaldi registry

Phase 3: Model Loading
  🚀 Initializing TomoroAI/tomoro-colqwen3-embed-4b-awq...
  ✅ ColQwen3 detected: TomoroAI/tomoro-colqwen3-embed-4b-awq
  🔧 ColQwen3Shim: Initializing...
  ✅ Model loaded successfully
  ✅ Processor loaded successfully
  ✅ RAGMultiModalModel instance created with ColQwen3Shim
  ✅ SUCCESS: Model loaded. Expect VRAM usage ~3.5GB.

Phase 4: Operational Validation
  🔍 Validating ColQwen3 injection...
  ✅ Registry injection appears to be in place
  ✅ All phases completed successfully
  ✅ ColQwen3 Dynamic Registry Injection: ACTIVE
```

### Technical Specifications

**Model Target**: `TomoroAI/tomoro-colqwen3-embed-4b-awq`

**Key Features**:
- Zero modification to Byaldi source code
- Graceful fallback to original Byaldi for non-ColQwen3 models
- Comprehensive error handling and logging
- Production-ready with proper device placement and dtype handling

**VRAM Requirements**:
- ColQwen3 (AWQ quantized): ~3.5-4GB
- With flash-attn: Reduced memory footprint for large contexts
- RTX 3090 Ti (24GB) recommended for production workloads

### Dependency Validation

If critical dependencies are missing, Phase 1 will fail with helpful error messages:

```
Missing critical dependencies: transformers, accelerate

Install with:
pip install transformers>=4.46.0
pip install accelerate
```

### Troubleshooting Registry Injection

**Model Loading Failures**
- Check that `trust_remote_code=True` is working (requires transformers>=4.46.0)
- Verify GPU availability and CUDA compatibility
- Check VRAM availability (~4GB minimum for AWQ quantized model)

**Flash Attention Warnings**
If flash-attn fails to load, the model will fall back to standard attention:
```
⚠️ Model loaded without flash_attention_2 (may OOM on large inputs)
```
This is non-fatal but may cause OOM on documents with >1000 visual tokens.

**Registry Injection Validation Failures**
If Phase 4 validation fails:
```
⚠️ from_pretrained doesn't appear to be wrapped
```
Check that Byaldi is properly installed and importable.

## Model Information

**ColQwen3 (TomoroAI/tomoro-colqwen3-embed-8b)**
- Architecture: ColPali / ColQwen (Vision-Language Retriever)
- Methodology: Late Interaction (MaxSim)
- Size: 8B parameters
- Embedding dimension: **320** (single-vector per image patch)
- Context window: **32k tokens**
- Storage efficiency: **~13× storage efficiency vs ColQwen2 (v2)** for dense indexing
- VRAM: 12GB+ recommended (4GB with AWQ quantization)
- Strength: Zero-loss visual retrieval (finds charts, layouts, and handwriting without OCR)

**Compatibility break**
- `vidore/colqwen2-v1.0` is rejected at startup with a breaking-change error.
- Re-index all ColQwen2 indices on ColQwen3.
- Startup logs emit a breaking-change warning banner on boot.

## Diagnostic Scripts

The sidecar includes diagnostic scripts in `scripts/` for troubleshooting:

### verify_flash_attn_vram.sh

Measures GPU memory delta during PDF processing to verify Flash Attention is active:

```bash
./scripts/verify_flash_attn_vram.sh http://localhost:8001/process_pdf https://example.com/large.pdf 0.5
```

- Samples `nvidia-smi` output at configurable interval (default: 0.5s)
- Triggers a service request and measures peak VRAM usage
- Saves samples to `/tmp/verify_flash_attn_samples_*.log`
- Useful for confirming flash-attn reduces memory usage vs standard attention

### inspect_shard_keys.py

Inspects model checkpoint shards and validates key translation for the native detox path:

```bash
python scripts/inspect_shard_keys.py
```

- Loads model config with `projection_dim=320` override
- Loads first checkpoint shard (safetensors or .pt)
- Translates shard keys using seaming rules (`vlm.model.*` → base, `embedding_proj_layer` → `custom_text_proj`)
- Reports common keys, missing keys, and examples of mismatches
- Useful for debugging state dict loading issues

### test_config_override.py

Validates that `projection_dim=320` config override works correctly:

```bash
python scripts/test_config_override.py
```

- Loads `ColQwen2_5` model with overridden config
- Rebuilds `custom_text_proj` layer if `model.dim` doesn't match
- Reports layer shape and state dict keys
- Useful for confirming dimension configuration before full model load

## Troubleshooting: flash-attn / CUDA build

The sidecar build requires `flash-attn>=2.4.0` on CUDA 12.4. If you encounter build-time or runtime errors related to `flash-attn` (e.g. build failures, missing CUDA symbols, or illegal instruction / segfault while loading the extension), try the following:

1. Verify your CUDA toolkit and driver versions match the PyTorch wheel. Use `nvidia-smi` and `python -c "import torch;print(torch.version.cuda)"`.
2. Install a PyTorch wheel that matches CUDA (e.g. `pip install torch --index-url https://download.pytorch.org/whl/cu124`).
3. Reinstall `flash-attn` against the same environment (prefer a binary wheel), for example `pip install flash-attn --no-build-isolation` or use a prebuilt wheel for your CUDA version.
4. If build fails due to compiler flags, ensure you have a recent `gcc`/`clang` and CUDA toolchain available in the build image.
5. Use the `verify_flash_attn_vram.sh` script to confirm flash-attn is active and reducing memory usage.
6. As a fallback, disable accelerated kernels and run on plain PyTorch CPU/CUDA kernels while debugging.

If you continue to hit issues, capture logs and open an issue with the sidecar maintainers including PyTorch and CUDA versions, and the reproduction steps.

## Troubleshooting

### Out of Memory (OOM)
If you get CUDA OOM errors when running alongside Ollama:
1. Increase `MAX_SPLIT_SIZE_MB` environment variable
2. Reduce Ollama's context window
3. Use model quantization (future feature)

### Slow Model Loading
First load downloads 8.5GB model. Subsequent loads use cached model in `/root/.cache/huggingface` volume.

### PDF Processing Errors
Ensure poppler-utils is installed. Check that PDF files are valid and not corrupted.

## References

- [Byaldi GitHub](https://github.com/AnswerDotAI/byaldi)
- [ColPali GitHub](https://github.com/illuin-tech/colpali)
- [ColPali Paper](https://arxiv.org/abs/2407.01449)
