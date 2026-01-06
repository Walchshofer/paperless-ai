<objective>
Upgrade the Python Visual RAG Sidecar to support image-based queries, enabling "Find Similar" functionality for the History Route.
This is Phase 1 of the History Route Enhancement Plan.
</objective>

<context>
The current sidecar (``main.py``) only supports text-to-visual search. To allow users to find similar documents based on visual regions (logos, handwriting), we need an endpoint that accepts an image embedding or raw image crop.
**Plan Reference:** @paperless-ai/prompts/planning/HISTORY-ROUTE-ENHANCEMENT-PLAN.md (Phase 1)
**Previous Context:** Read the summary of the Manual Route completion: @paperless-ai/prompts/summaries/004-implement-manual-feedback-ui-summary.md
</context>

<requirements>
1. **Update Search Request Schema**:
   - Modify `SearchRequest` class in ``paperless-ai/services/visual-rag-sidecar/main.py`` (or equivalent).
   - Add an optional field `query_image` (string, base64 encoded) to the request model.

2. **Implement Image Search Logic**:
   - In the ``/search`` endpoint, detect if `query_image` is present.
   - If present, decode the base64 image and pass it to the model's search function instead of the text query.
   - Ensure the underlying ``state.model.search`()` can handle PIL Images or raw bytes.

3. **Documentation**:
   - Update docstrings in ``main.py``.

4. **Model Constraint**:
   - **CRITICAL**: Ensure the model used is strictly `TomoroAI/tomoro-colqwen3-embed-8b`. Raise a startup error if `VISUAL_RAG_MODEL` is set to `vidore/colqwen2-v1.0` or any other unsupported model, as per `docs/VISUAL_RAG_INTEGRATION.md`.
</requirements>

<implementation>
- Use the `PIL` (Pillow) library for image handling.
- Ensure strict type checking with Pydantic models.
- Maintain existing logging standards.
- Integrate circuit breaker signals and health propagation: the sidecar must expose health endpoints and emit metrics compatible with `docs/VISUAL_RAG_INTEGRATION.md` (`sidecar_availability`, `circuit_breaker_state`). Clients should honor the circuit breaker state when proxying visual search requests.
</implementation>

<output>
- ``./paperless-ai/services/visual-rag-sidecar/main.py`` (Modified)
</output>

<verification>
- Create a test script or use `curl` to send a POST request with a base64 image to the sidecar.
- Verify it returns search results (list of document IDs/scores).
</verification>

<lifecycle>
1. Upon completion, generate a concise machine-readable summary of changes in: ``./paperless-ai/prompts/summaries/005-upgrade-visual-sidecar-summary.md``
2. Update `@`paperless-ai/docs/FEEDBACK_PERSISTENCE_STRATEGY.md`` if any data flow assumptions changed (unlikely for this step).
3. Move this prompt to ``./paperless-ai/prompts/completed`/`
</lifecycle>