# VERIFY_MODEL_LIMITS

This checklist is used to ensure model context windows in `docs/model/` are authoritative and kept up to date.

## Purpose
- Record authoritative sources for context windows for all models referenced in the codebase.
- Provide a checklist to verify outstanding items and vendor model cards.
- Provide guidance on setting `OLLAMA_MODEL_LIMITS_JSON` overrides if vendor limits are missing.

## Models & Status
- `qwen3-vl:8b` — **256000** (source: Qwen model docs / Ollama listing). ✅
- `sauerkraut-llama3.1:8b` — **128000** (source: Meta Llama 3.1 documentation). ✅
- `medtext-llama3` — **128000** (inherited from Llama 3.1 family). ✅
- `llava-med-v1.6` — **8192** (Mistral 7B default). ✅
- `tomoro-colqwen3-embed-8b` — **32000** (documented in colqwen3 doc). ✅
- `nomic-embed-text-v1.5` — **N/A** (embedding model; chunk inputs as recommended). ✅
- `llm-pro-finance-8b` (alias `DragonLLM/Qwen-Open-Finance-R-8B`) — **32768** (derived from Qwen3-8B base) — verify vendor card if available. ✅

## Outstanding Actions
- [ ] Confirm that `DragonLLM/Qwen-Open-Finance-R-8B` model card does not list a different limit; update docs if necessary.
- [ ] Add references for any models missing an explicit `<references>` block in `docs/model/*.md`.

## How to set per-model overrides
If you run into truncation in production, set `OLLAMA_MODEL_LIMITS_JSON` in `docker-compose.env` or `data/runtime.env` with entries like:

```json
{"qwen3-vl:8b": {"vision": {"contextWindow": 256000, "maxResponseTokens": 4096}}}
```

---

If you verify a vendor page, add the URL and date to the model's `<references>` section in `docs/model/<model>.md` and check this file off.
