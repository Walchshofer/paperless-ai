# FAQ — Guidance Service (Paperless‑AI)

This FAQ answers common questions about system setup, extraction accuracy, hardware, and data storage.

---

## System & Connectivity ⚙️

**Q: Why do we use `host.docker.internal` for Ollama?**

**A:** Ollama runs natively on the Windows host (to take advantage of the NVIDIA RTX 3090 Ti). Containers use `host.docker.internal` to reach host services without additional network bridging.

**Q: The Guidance service reports "Connection refused" — what should I check?**

**A:**
- Verify `guidance-service` is running and listening on port **8002**.
- Check Docker container logs: `docker logs guidance_service`.
- Ensure the Windows firewall or other host-level network rules aren't blocking Docker container-to-host communication.
- Confirm Ollama is running on the host.

---

## Extraction & Accuracy 🧾

**Q: Why is the JSON still sometimes invalid?**

**A:** Guidance templates typically achieve >99% validity. Failures usually stem from the LLM hitting a `TOKEN_LIMIT`, crashing, or returning malformed content. Verify your `TOKEN_LIMIT` in `docker-compose.env` (recommended >= **16384**).

**Q: How do I change the default model used for Medical documents?**

**A:** Update the `MEDICAL_ANALYSIS_MODEL` variable in your `docker-compose.env` and restart the stack.

**Q: My Austrian VAT (ATU) numbers aren't being recognized — what now?**

**A:** Inspect `guidance_service/validators/financial.py`. The validator expects `ATU` followed by 8 digits. OCR errors (extra spaces, confusions like `0` vs `O`) will fail the regex; consider adding normalization/preprocessing if needed.

---

## Hardware & Performance 🖥️

**Q: I'm seeing CUDA out-of-memory (OOM) errors.**

**A:**
- Set `PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512` in the `visual-rag` service environment to improve allocator behavior.
- Reduce the number of concurrent expert model workers if you are running multiple models simultaneously.
- Prefer 8B quantized models and lower batch sizes on a 24 GB card (RTX 3090 Ti) to avoid OOMs.

**Q: Is the cache persistent across container restarts?**

**A:** Yes — `guidance_cache` is mounted to the project directory and survives container restarts and rebuilds.

---

## Data & Privacy 🔒

**Q: Where is my feedback stored?**

**A:** Feedback records are stored as JSON files under `paperless-ai/data/feedback/`. They are used locally by `analysis/` scripts and are not forwarded to external cloud services by default.

---

*Last updated: 2025-12-27*