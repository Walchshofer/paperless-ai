# Visual RAG Docker Compose healthcheck & CI snippet

Use this snippet in your `paperless-ngx/docker-compose.yml` (service: `visual-rag`) to add a healthcheck that waits for `/ready` or `/health` to indicate `model_loaded:true`.

Suggested healthcheck (Docker Compose v3+):

```yaml
services:
  visual-rag:
    image: visual-rag:local
    healthcheck:
      test: ['CMD-SHELL', "curl -fsS --max-time 5 http://localhost:8001/ready || (curl -fsS --max-time 5 http://localhost:8001/health | grep -q 'model_loaded.*true')"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
```

CI guidance:
- In CI, bring up `visual-rag` (and any required dependencies), then wait for Docker to report the container as `healthy` before running integration tests.
- For offline CI runs, pre-seed the indices directory with `.hf_hub_download_complete` and a valid index to avoid long first-run downloads.

Notes:
- The sidecar exposes `/ready` which returns 200 when `model_loaded:true` and 503 otherwise; `/health` contains `model_loaded` and `last_error` fields for diagnostics.
