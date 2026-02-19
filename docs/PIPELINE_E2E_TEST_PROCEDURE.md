# Expert Pipeline E2E Test Procedure

Manual procedure for verifying the expert pipeline end-to-end in a running Docker stack.

---

## Prerequisites

- Docker stack is running (`docker compose up -d`).
- Ollama is running on the host at `http://localhost:11434`.
- paperless-ai is reachable at `http://localhost:3000`.
- Test user `elfman` exists with the password below.

---

## Step 1: Warm the Models

Cold model loads add 30–120 seconds to pipeline runs and can cause timeout failures during testing. Warm both models before triggering reprocess.

```bash
# Warm qwen3-vl (used for visual triage + signal analysis + direct VLM calls)
curl -s http://localhost:11434/api/generate \
  -d '{"model":"qwen3-vl:8b","prompt":"hi","stream":false,"options":{"num_predict":5}}'

# Warm sauerkraut (used for guidance extraction)
curl -s http://localhost:11434/api/generate \
  -d '{"model":"sauerkraut-llama3.1:8b","prompt":"hi","stream":false,"options":{"num_predict":5}}'
```

Expected response: JSON with `"done":true` for each. If you get a timeout, the model may not be available — check `ollama list`.

---

## Step 2: Authenticate

The API endpoints require an active session cookie. Use the `elfman` user.

```bash
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=elfman&password=P2tr3ck%211976' \
  -o /dev/null -w '%{http_code}'
```

Expected HTTP status: `302` (redirect to `/dashboard`).

If you get `200`, login failed (wrong credentials or auth disabled). If you get `401`, check `ENABLE_AUTH` in `.env`.

---

## Step 3: Trigger Reprocess

Replace `{ID}` with the target document ID.

```bash
curl -s -b /tmp/cookies.txt -X POST \
  http://localhost:3000/api/documents/{ID}/reprocess \
  -H 'Content-Type: application/json'
```

Expected response: `{"status":"queued"}` or similar acknowledgement.

---

## Good Test Documents

| Doc ID | Type | Size | Domain | Expected Pipeline |
|--------|------|------|--------|------------------|
| 41 | PDF | 1906 chars | Medical | `PIPELINE_MEDICAL_V1` |
| 74 | PDF | — | Mixed | Good for rotation/normalization testing |

**Note**: Documents 92–94 are `text/plain` and are NOT supported by the expert pipeline. The expert pipeline requires PDF or image content for visual triage. These documents will fall through to the standard (non-expert) processing path.

---

## Step 4: Watch the Logs

Stream paperless-ai container logs during the run:

```bash
docker logs -f paperless_ai 2>&1
```

### Key Log Events to Verify

All events appear as structured JSON in the logs. Verify these in order:

| Event | Field | Meaning |
|-------|-------|---------|
| `visual_signal_analysis_complete` | — | Visual triage (qwen3-vl signal analysis) succeeded |
| `pipeline_routing` | `selected_pipeline` | Correct domain routing was applied |
| `guidance_extraction_success` | `source: 'generated_stream'` | Streaming extraction path worked |
| `pipeline_execution_complete` | — | Pipeline finished without error |
| `expert_thinking` | — | qwen3-vl produced `<think>` tokens (only with thinking models in streaming mode) |

### Example: Verify Medical Routing for Doc 41

Look for `pipeline_routing` with `selected_pipeline` value containing `MEDICAL`:

```json
{"event":"pipeline_routing","selected_pipeline":"PIPELINE_MEDICAL_V1","document_id":41,...}
```

### Example: Verify Streaming Extraction

Look for `guidance_extraction_success` where `source` is `generated_stream`:

```json
{"event":"guidance_extraction_success","source":"generated_stream","template":"medical_extraction_de",...}
```

### Example: expert_thinking (qwen3-vl only)

```json
{"event":"progress","stage":"expert_thinking","label":"Expert model reasoning","percentage":40,...}
```

This event fires only when qwen3-vl is used in streaming mode AND the model produces think tokens. It does NOT fire for sauerkraut, medtext-llama3, or llava-med.

---

## Troubleshooting

### Pipeline times out on Stage 1 (classification)
- Models not warmed — run Step 1 again.
- Check `VISUAL_TRIAGE_TIMEOUT` in `.env` (current: `90000` ms).
- Check `ROUTER_MAX_RETRIES` (default: `3`).

### `guidance_extraction_success` shows `source: 'generated'` (not `generated_stream`)
- Streaming threshold not met: `GUIDANCE_STREAMING_THRESHOLD=100` means docs with fewer than 100 tokens skip streaming.
- Streaming disabled: check `GUIDANCE_STREAMING_ENABLED` in `.env`.
- Streaming fallback: guidance service returned an error and fell back to the generate path. Check for `guidance_streaming_unsupported` in logs.

### `expert_thinking` never fires
- Expected for non-thinking models (sauerkraut, medtext-llama3, llava-med).
- For qwen3-vl: only fires when streaming is active AND think tokens are produced.
- Check that `GUIDANCE_STREAMING_ENABLED=yes` is set in `.env`.

### Authentication returns 200 (not 302)
- Wrong password or username. Re-check credentials.
- If `ENABLE_AUTH=no`, the login endpoint may behave differently.

### Visual triage circuit breaker is open
- Check logs for `visual_triage_circuit_open` or `visual_triage_failure`.
- The circuit opens after `VISUAL_TRIAGE_FAILURE_THRESHOLD=5` consecutive failures.
- Cooldown is `VISUAL_TRIAGE_COOLDOWN=60000` ms (60 seconds).
- Trigger reprocess again after cooldown, or restart the container to reset the circuit.

---

## Environment Variables Affecting E2E Tests

All set in `paperless-ai/docker-compose.env` (authoritative SOT). The root
`.env` is an auto-generated compatibility layer. Restart the `paperless_ai`
container after changes.

| Variable | Current Value | Effect on E2E |
|----------|--------------|---------------|
| `VISUAL_TRIAGE_ENABLED` | `yes` | Enables domain classification via qwen3-vl |
| `VISUAL_TRIAGE_TIMEOUT` | `90000` | Abort triage call after 90 s |
| `VISUAL_TRIAGE_MAX_PAGES` | `3` | Send at most 3 pages to triage |
| `VISUAL_TRIAGE_MAX_RETRIES` | `1` | Retry triage once on failure |
| `VISUAL_TRIAGE_FAILURE_THRESHOLD` | `5` | Open circuit after 5 failures |
| `VISUAL_TRIAGE_COOLDOWN` | `60000` | Wait 60 s before retrying after circuit opens |
| `GUIDANCE_STREAMING_THRESHOLD` | `100` | Enable streaming for docs with >= 100 tokens |
| `VIS_OCR_TIMEOUT` | `120000` | Allow 120 s for visual OCR |

---

## Related Documentation

- `docs/EXPERT_PIPELINE_DECISION_TABLE.md` — Authoritative pipeline contract.
- `docs/PIPELINE_STAGE_CONTRACTS.md` — Stage I/O contracts.
- `docs/ENVIRONMENT_VARIABLES.md` — Full env var reference.
- `CLAUDE.md` — Guidance streaming architecture and `expert_thinking` event chain.
