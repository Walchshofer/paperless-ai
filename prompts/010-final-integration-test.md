---
name: final-integration-test
stage: 060-test
agent: test-agent
prompt_id: 010-native-alpha-9-e2e-verification
---

<objective>
Perform full end-to-end (E2E) integration and acceptance verification for the 
Native Protocol Alpha-9 Visual RAG pipeline. Validate the complete cycle: 
UI Red Pen → Node.js Gateway → Python Sidecar → Qdrant 320-dim Retrieval.
</objective>

<context>
This is the final gate for the History Route Enhancement. We must ensure that 
the system respects the RTX 3090 Ti VRAM baseline, correctly mirrors 
PostgreSQL filters to Qdrant, and maintains 320-dim multi-vector integrity.

**Hardware:** RTX 3090 Ti (Ampere SM86).
**SOT Check:** Postgres (Metadata) + Qdrant (Vectors) Hybrid Sync.
</context>

<requirements>
1. **Full User-Flow Validation (E2E)**:
   - Verify: Open History Document → Select Red Pen → Draw Bounding Box.
   - Assert: `POST /api/visual-rag/search/visual` is emitted with valid 
     Base64 and the active `correspondent_id` payload filter.
   - Assert: The "Similar" tab renders results with **MaxSim scores** and 
     thumbnails from the correct Alpha-9 collection (`visual_pages`).

2. **Alpha-9 Handshake & Resilience**:
   - **Model Swap Test:** Start the sidecar with no model loaded. Verify 
     the UI displays "GPU Initializing..." (503) and successfully switches 
     to search results once the model is warm on the RTX 3090 Ti.
   - **Timeout Test:** Block the sidecar port (:8001). Verify the Node.js 
     gateway opens the circuit breaker after 5s and the UI offers the 
     "Text-Only Search" fallback.

3. **Hybrid SOT & Feedback Loop**:
   - Click "Confirm Match" on a search result.
   - **Database Check:** Verify the event is written to the PostgreSQL 
     `feedback_events` table with the correct `document_id` and 
     `vector_id` mapping.

4. **Telemetry & VRAM Audit**:
   - Verify `visual_query_execution_time_ms` is recorded in logs.
   - Monitor `nvidia-smi`: Ensure that concurrent searches do not cause 
     out-of-memory (OOM) errors on the RTX 3090 Ti.

5. **Linter & "Detox" Final Audit**:
   - Verify that all newly created test files follow the 79-character 
     Python limit and strict Preact typing.