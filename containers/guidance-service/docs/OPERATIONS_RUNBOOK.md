# Operations Runbook — Paperless‑AI Guidance

This runbook provides concise operational procedures for running, monitoring, and recovering the Paperless‑AI Guidance ecosystem.

---

## Service Architecture Overview 🔧

| Service | Port(s) | Purpose |
|---|---:|---|
| Guidance Service | **8002** | Python/Flask engine for structured JSON extraction |
| Paperless‑AI (orchestration) | **3000** | Node.js orchestration bridge |
| Visual RAG (sidecar) | **8001** | ColQwen2 visual indexing |
| Database (Postgres + pgvector) | **5432** | Hybrid storage for vectors and relational data |
| Monitoring (Grafana / Prometheus) | **3001 / 9090** | Dashboards and time-series metrics |

---

## Deployment & Startup 🚀

Run the entire stack from the `paperless-ngx` directory:

```bash
# from paperless-ngx
docker-compose up -d --build
```

> Tip: Use `docker-compose logs -f <service>` while debugging startup issues.


### Health checks ✅

```bash
# Guidance API
curl http://localhost:8002/health

# Ollama (local host container)
curl http://host.docker.internal:11434/api/tags
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (default: `admin`/`admin`)

---

## Monitoring & Incident Response 📊

### High latency (P95 > 45s)

Checklist:
- Check GPU utilization: `nvidia-smi` on the host (ensure Ollama isn't swapping to system RAM).
- Verify model context limits: confirm `TOKEN_LIMIT` in `.env` isn't causing excessive re-processing.
- Verify cache hit rate: open the Grafana **Cache Performance** panel — if hit rate < 5%, consider increasing `CACHE_TTL_HOURS`.

### Extraction failures / validation spikes

Steps:
1. Inspect logs for template errors:

```bash
docker logs guidance-service
```

2. Run template/LLM comparison to identify breaking LLM versions:

```bash
python analysis/model_comparison.py
```

3. If a pattern has changed (e.g., ICD-10 or AT-UID), update validators in `guidance_service/validators/` and redeploy.

---

## Maintenance Tasks ⚙️

### Clearing Guidance Cache

When templates change and you need to force re-extraction:

```bash
rm -rf ../paperless-ai/guidance_cache/*
docker-compose restart guidance-service
```

### Backup & Recovery

- PostgreSQL dump:

```bash
docker exec paperless_db pg_dump -U elfman paperless > backup.sql
```

- Feedback data: back up `paperless-ai/data/feedback` monthly to preserve accuracy baselines.

---

## Emergency Rollback ⏪

If a deployment fails:

1. Stop the stack:

```bash
docker-compose down
```

2. Revert `docker-compose.yml` to the previous known-good commit (example):

```bash
# replace <commit> with the SHA or ref you want to restore
git checkout <commit> -- docker-compose.yml
```

3. Restart:

```bash
docker-compose up -d
```

---

## Contact & Escalation

- On-call: check your team's escalation list (PagerDuty / Slack channel).
- For database issues, contact the DB owner and include the last successful backup timestamp.

---

*Document last updated: 2025-12-27*