# Runbook: Vision-First Pipeline

This document provides operational guidance for maintaining, monitoring, and troubleshooting the `paperless-ai` Vision-First Pipeline.

---

## 1. Architecture Overview

The Vision-First Pipeline is a Mixture of Experts (MoE) orchestration model that prioritizes visual analysis over traditional OCR for document understanding.

### Core Components
- **Orchestrator (paperless-ai)**: Node.js/Express service that manages the 9-stage pipeline execution.
- **Visual RAG Sidecar**: Python service running **ColQwen3 (4B-AWQ)** for native multi-vector visual retrieval.
- **Guidance Service**: Python service for deterministic structured data extraction.
- **Text RAG (RAGZ)**: Python service for document-level semantic search.
- **Bias Engine**: gRPC service for logit bias and prompt orchestration.

### Data Stores
- **Qdrant**: Sole **Vector Source of Truth (SOT)**.
    - `visual_pages`: multi-vector page embeddings (Dot Product).
    - `visual_overlays`: region embeddings (Cosine).
    - `document_embeddings`: text-level embeddings (Cosine).
- **PostgreSQL**: Metadata SOT, audit logs, and RLHF feedback persistence.
- **Redis**: Background job broker and visual query cache.

### Dependencies
- **Ollama**: External provider for LLM (Llama 3.1) and VLM (Qwen3-VL) models.
- **Paperless-ngx**: The destination DMS for metadata and document storage.

---

## 2. Common Failure Scenarios

### Scenario 1: Visual RAG Sidecar Unavailable
**Symptoms**:
- Circuit breaker `visual-rag` in **OPEN** state.
- Error logs: `Connection refused to visual-rag:8001`.
- UI shows "GPU Preparing" or degraded mode warning.
- Pipeline falls back to text-only extraction (lower confidence).

**Recovery**:
1. Verify container status: `docker ps | grep visual_rag`
2. Check GPU logs: `docker logs visual_rag`
3. Restart sidecar: `docker restart visual_rag`
4. Wait for model loading (~30-60s).
5. Verify health: `curl http://localhost:8001/health`

### Scenario 2: Qdrant Vector Store Timeout
**Symptoms**:
- Slow search performance (> 5s).
- Error logs: `Qdrant request failed: Request timeout`.
- Circuit breaker `qdrant-adapter` in **HALF-OPEN**.

**Recovery**:
1. Check Qdrant health: `curl http://localhost:6333/health`
2. Check VRAM/RAM usage on the host. Qdrant payload is on-disk, but HNSW index is in RAM.
3. Restart Qdrant: `docker restart paperless_qdrant`
4. If corruption suspected, perform re-indexing: `npm run reindex:visual`

### Scenario 3: Ollama Model Loading / Timeout
**Symptoms**:
- High latency in Stage 1 (Classification) or Stage 5 (Extraction).
- Logs show `Ollama API timeout` or `503 Service Unavailable`.

**Recovery**:
1. Check Ollama server: `curl http://host.docker.internal:11434/api/tags`
2. Ensure models `qwen3-vl:8b` and `sauerkraut-llama3.1:8b` are present.
3. Restart Ollama service on host if unresponsive.

---

## 3. Operational Procedures

### System Startup Sequence
1. Start Infrastructure: `docker-compose up -d db broker qdrant redis`
2. Start AI Stack: `docker-compose up -d visual-rag guidance-service bias-engine text-rag`
3. Start Orchestrator: `docker-compose up -d paperless-ai`

### Re-indexing Documents
If the vector schemas evolve or the SOT is wiped:
1. Clear Qdrant collections.
2. Run the batch re-indexer:
   ```bash
   docker exec -it paperless_ai npm run reindex:visual -- --start=1 --end=1000
   ```

### VRAM Management
The pipeline is optimized for **RTX 3090 Ti (24GB VRAM)**.
- **Baseline Usage**:
    - ColQwen3 (AWQ): ~3.5 GB
    - Ollama (Llama 3.1 8B): ~5.5 GB
    - Ollama (Qwen3-VL 8B): ~6.0 GB
- **Threshold**: Keep total VRAM usage < 20 GB to avoid fragmentation and swapping.

---

## 4. Monitoring & Alerts

### Grafana Dashboards
Access via `/grafana` (Proxied through paperless-ai).

**Key Metrics to Watch**:
- **Pipeline Latency (p95)**: Should be < 8s for standard documents.
- **Sidecar Availability**: Should be > 99%.
- **OCR Conflict Rate**: Disagreements between Visual OCR and Tesseract (Target < 10%).
- **Circuit Breaker States**: Any service in `OPEN` requires immediate investigation.

### Critical Alerts (alerts.yml)
- `GuidanceServiceDown`: Critical - Extraction will fail.
- `HighGuidanceErrorRate`: Critical - Schema validation failing consistently.
- `CircuitBreakerOpenTooLong`: Critical - Visual RAG or Qdrant persistent failure.
- `FieldDetectionF1Low`: Warning - Extraction accuracy dropping.

---

## 5. Performance Tuning

| Parameter | Location | Recommended Value |
|-----------|----------|-------------------|
| `COLQWEN3_MAX_PATCHES` | Sidecar Config | 1280 |
| `ANALYSIS_DPI` | Stage 3 Config | 150 |
| `VISION_DPI` | Stage 8 Config | 300 |
| `MAX_CONCURRENT_QUERIES` | Orchestrator | 5 |
| `HNSW_M` | Qdrant Config | 16 |

---

## 6. Troubleshooting Guide

### "TypeError: PreVisionNormalizer is not a constructor"
- **Cause**: Circular dependency in Node.js modules or failed build context.
- **Fix**: Check `ExpertPipelineExecutor.js` imports. Ensure `PreVisionNormalizer` is imported after core utilities.

### "Visual sidecar returning 503"
- **Cause**: Sidecar is initializing the ColQwen3 model in GPU memory.
- **Fix**: Monitor logs. This is normal for the first 30s after startup. The pipeline will automatically fallback to Text RAG during this window.

### "Low confidence in financial domain"
- **Cause**: Image quality too low for Visual OCR.
- **Fix**: Increase `ANALYSIS_DPI` to 200 in `.env` or check if Stage 3 (Normalization) is being skipped due to missing `has_images` flag.

---

## 7. Daily Monitoring Checklist

- [ ] **Dashboards**: Open `/grafana` and check "Vision-First Pipeline Health".
- [ ] **Error Rates**: Confirm `pipeline_errors_total` has not spiked in the last 24h.
- [ ] **Circuit Breakers**: Verify all breakers (`visual-rag`, `qdrant`, `ollama`) are `CLOSED`.
- [ ] **GPU Usage**: Ensure VRAM usage is within safe limits (~15-18GB).
- [ ] **Logs**: Check for `critical` or `fatal` events in `docker logs paperless_ai --since 24h`.
- [ ] **Queue**: Verify Redis indexing queue is not backed up (`LLEN visual_indexing_queue`).
