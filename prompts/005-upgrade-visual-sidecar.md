---
name: upgrade-visual-sidecar
stage: 050-implement
agent: implement-agent
prompt_id: 005-native-alpha-9-upgrade
---

<objective>
Upgrade the Python Visual RAG Sidecar to support Native Protocol Alpha-9. 
Enable image-to-image "Find Similar" functionality for the History Route 
utilizing ColQwen3-4B-AWQ and Unified Qdrant (320-dim) storage.
</objective>

<context>
The sidecar (``main.py``) must be upgraded from a text-only prototype to a 
production-ready multi-vector retrieval service. We are transitioning from 
legacy pgvector to a Hybrid SOT: PostgreSQL for metadata and Qdrant for 
late-interaction MaxSim retrieval.

**Hardware Baseline:** RTX 3090 Ti (24GB VRAM) 
**VRAM Baseline:** ~3.5GB for Sidecar initialization.
**Dimensions:** 320-dimensional multi-vectors (ColQwen3 native).

**Policy:** Read `docs/AGENT_READ_POLICY.md` to determine authoritative documentation.
</context>

<requirements>
1. **Model Enforcement (Critical)**:
   - Ensure the model is strictly `TomoroAI/tomoro-colqwen3-4b-awq`.
   - Implement a startup check: Raise `RuntimeError` if dimensions or 
     architecture do not match ColQwen3 requirements.
   - **Offline Mode:** Set `local_files_only=True` in the processor and 
     model loaders. No external hub connectivity permitted.

2. **Schema & API Upgrade**:
   - Add `query_image` (Base64 string) to the `SearchRequest` Pydantic model.
   - Add `collection_name` to allow switching between `visual_overlays` 
     and `visual_pages`.
   - Ensure `SearchResponse` returns the native MaxSim score (late interaction).

3. **Unified Qdrant Integration**:
   - Utilize the singleton `rag_service/qdrant_adapter.py` for all lookups.
   - Implement metadata mirroring: If a `doc_id` or `tag_id` filter is 
     provided, apply it as a Qdrant `Payload` filter.

4. **The Python Detox (Standards)**:
   - **Flake8 Compliance:** All lines must be ≤ 79 characters.
   - **Pylance Resolution:** Use `typing.cast` and `Any` proxies for 
     `qdrant_client.models` to ensure zero "Unknown Type" diagnostics.
   - **Lifespan:** Migrate from `@app.on_event` to `asynccontextmanager` 
     lifespan for model loading into VRAM.

5. **Visual RAG Guardrails**:
   - Implement a 5-second timeout for retrieval calls.
   - Emit `503 Initializing` while the model is loading into VRAM to trigger 
     orchestrator fallback (Text-Only RAG).
</requirements>

<implementation>
- **Pillow (PIL):** Handle Base64 decoding and image resizing.
- **Torch Optimization:** Ensure `weights_only=True` in any `torch.load` 
  calls to prevent arbitrary code execution.
- **MaxSim Scoring:** The `/search` endpoint must return scores generated 
  by `processor.score_multi_vector`.
</implementation>



<output>
- ``services/visual-rag-sidecar/main.py`` (Modified)
- ``rag_service/qdrant_adapter.py`` (Reference/Sync)
</output>

<lifecycle>
1. Generate machine-readable summary in: ``prompts/summaries/005-upgrade-visual-sidecar-summary.md``
2. Update `docs/QDRANT_MIGRATION.md` if payload index assumptions change.
3. Move to ``prompts/completed/``
</lifecycle>