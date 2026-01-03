# Handoff Document: Subagent Creation & Bias Engine Integration

<original_task>
1. Create specialized Claude Code subagents by converting GitHub Copilot-style agent definitions to Claude Code format
2. Register all agents in `.claude/agents.toml`
3. Fully integrate `guidance-bias-engine/docker-compose.yml` into the main Docker configuration at `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml`
4. Clean up duplicate/misplaced Docker configuration files
</original_task>

<work_completed>

## 1. Subagent Creation (7 Agents)

Created and registered 7 specialized subagents in `.claude/agents/`:

| Agent | File | Purpose |
|-------|------|---------|
| `schema-evolution` | `agents/schema-evolution.md` | Safe schema changes with backward compatibility rules |
| `pipeline-orchestration-expert` | `agents/pipeline-orchestration-expert.md` | (Pre-existing) Pipeline orchestration, LLM chains, validation retries |
| `test-agent` | `agents/test-agent.md` | Test generation with Mocha/Node.js assert, retries, fallbacks, OCR |
| `debug-agent` | `agents/debug-agent.md` | Deterministic debugging with 7-step checklist + debug skill |
| `docs-agent` | `agents/docs-agent.md` | Documentation-first updates, code/doc sync |
| `paperless-api-expert` | `agents/paperless-api-expert.md` | Paperless-ngx REST API integration (v9) |
| `guidance-expert` | `agents/guidance-expert.md` | Guidance AI framework (gen, select, regex, streaming) |

**Registry file:** `.claude/agents.toml` - All 7 agents registered with tools and descriptions.

### Agent Structure (XML format)
Each agent follows this structure:
```xml
<agent>
  <role>...</role>
  <authority><authoritative_docs_order>...</authoritative_docs_order></authority>
  <expertise><domain>...</domain><specializations>...</specializations></expertise>
  <key_files>...</key_files>
  <concepts>...</concepts>
  <behaviors>...</behaviors>
  <constraints>...</constraints>
  <tools>...</tools>
</agent>
```

## 2. Bias Engine Docker Integration

### Files Modified:

**`C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml`:**
- Added service #8: `bias-engine`
  - Build context: `../paperless-ai/guidance-bias-engine`
  - Dockerfile: `Dockerfile.bias-engine`
  - Ports: 50051 (gRPC), 8003 (metrics mapped from internal 8001)
  - Healthcheck: Python gRPC channel check
  - Volume: `bias_engine_models:/models`
- Added service #10: `prometheus`
  - Image: `prom/prometheus:latest`
  - Port: 9091 (mapped from internal 9090)
  - Config: `../paperless-ai/monitoring/prometheus.yml`
- Added service #11: `grafana`
  - Image: `grafana/grafana:latest`
  - Port: 3001 (mapped from internal 3000)
  - Depends on prometheus
- Updated service #9: `guidance-service`
  - Added `depends_on: bias-engine: condition: service_healthy`
  - Added env var: `BIAS_ENGINE_URL=bias-engine:50051`
- Added volumes: `bias_engine_models`, `prometheus_data`, `grafana_data`

**`C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env`:**
Added section H:
```env
# H. BIAS ENGINE (Constrained Generation)
BIAS_ENGINE_URL=bias-engine:50051
BIAS_ENGINE_ENABLED=yes
TOKENIZER_MODEL=gpt2
```

**`C:\Users\pwalc\MyApps\paperless-ai\monitoring\prometheus.yml`:**
Updated to monitor full stack:
- bias-engine:8001
- guidance-service:8002
- visual-rag:8001
- paperless-ai:3000
- prometheus:9090 (self)

**`C:\Users\pwalc\MyApps\paperless-ai\CLAUDE.md`:**
- Updated with complete 11-service architecture table
- Added key environment variables documentation
- Added monitoring URLs (Prometheus: 9091, Grafana: 3001)

### Files Created:

**`C:\Users\pwalc\MyApps\paperless-ai\test\integration\bias-engine.test.js`:**
- Integration tests for bias-engine connectivity
- Health check tests (gRPC channel)
- Metrics endpoint tests (/metrics on 8003)
- Regex pattern validation tests (email, amount, date patterns)
- Guidance service integration tests

### Files Deleted:

- `C:\Users\pwalc\MyApps\paperless-ai\docker-compose.yml` (incorrectly placed in project root)
- `C:\Users\pwalc\MyApps\paperless-ai\guidance-bias-engine\docker-compose.yml` (consolidated into main stack)
- `C:\Users\pwalc\MyApps\paperless-ai\guidance-bias-engine\monitoring\` directory (using main monitoring folder)

## 3. Guidance Expert Knowledge Access

Demonstrated access to guidance-expert knowledge files:
- `.claude/knowledge/guidance-expert/references/quick-reference.md` - Syntax reference
- `.claude/knowledge/guidance-expert/references/guidance-functions.md` - gen(), select(), tools

Provided constrained generation patterns:
- `gen(name="...", regex="...", max_tokens=..., temperature=0.0)`
- `select(options=[...], name="...")`
- Context managers: `with system/user/assistant():`

</work_completed>

<work_remaining>

## Immediate Tasks

1. **Start the integrated Docker stack:**
   ```bash
   cd C:\Users\pwalc\MyApps\paperless-ngx
   docker compose up -d --build
   ```

2. **Verify bias-engine builds correctly:**
   - The Dockerfile at `guidance-bias-engine/Dockerfile.bias-engine` requires proto compilation
   - `setup_grpc.sh` runs during build to generate gRPC stubs
   - Check for any missing dependencies

3. **Test bias-engine connectivity:**
   ```bash
   # Check all services are healthy
   docker compose ps

   # Test metrics endpoint
   curl http://localhost:8003/metrics

   # Check bias-engine logs
   docker logs bias_engine

   # Verify guidance-service connects to bias-engine
   docker logs guidance-service | grep -i bias
   ```

4. **Run integration tests:**
   ```bash
   cd C:\Users\pwalc\MyApps\paperless-ai
   npm test -- --grep "Bias Engine"
   ```

5. **Verify Grafana access:**
   - URL: http://localhost:3001
   - Login: admin/admin
   - Add Prometheus datasource: http://prometheus:9090

## Future Enhancements

1. **Grafana Dashboards:**
   - Create pre-configured dashboards for bias-engine metrics
   - `bias_requests_total` counter
   - `bias_computation_seconds` histogram
   - Add alerting rules for service health

2. **Bias Engine Tokenizer:**
   - Currently using `gpt2` tokenizer (50257 vocab)
   - For production with Llama models, consider switching to `meta-llama/Meta-Llama-3-8B`
   - Requires HuggingFace token for gated models

3. **Custom Agent Task Tool Integration:**
   - Custom agents in `agents.toml` are documentation-only
   - They don't auto-spawn via Task tool's `subagent_type` parameter
   - To use: Read agent file directly and follow its instructions

</work_remaining>

<attempted_approaches>

## Successful Approaches

1. **Subagent XML Structure:** Used `<agent>` XML format with clearly defined sections for role, authority, expertise, key_files, concepts, behaviors, constraints, and tools.

2. **Docker Integration Strategy:** Added services sequentially to main docker-compose.yml rather than attempting complex merge operations.

3. **Knowledge Access Pattern:** For guidance-expert queries, directly read knowledge files from `.claude/knowledge/guidance-expert/` since custom agents can't be spawned via Task tool.

4. **Healthcheck Design:** Used inline Python gRPC check for bias-engine since standard HTTP healthcheck doesn't apply to gRPC services.

## Issues Encountered

1. **Task tool limitation:** Custom agents defined in `agents.toml` are NOT recognized by the Task tool's `subagent_type` parameter. Only built-in agents work:
   - `general-purpose`, `Explore`, `Plan`, `claude-code-guide`
   - `taches-cc-resources:skill-auditor`, `taches-cc-resources:slash-command-auditor`, etc.

   **Workaround:** Access agent knowledge files directly via Read tool, or use `@agent-name` syntax in chat for user awareness.

2. **Windows path handling:** Used `rm` command (Git Bash) instead of `del` (CMD) for file deletion in Bash tool.

3. **Port conflict avoidance:**
   - bias-engine metrics: internal 8001 → external 8003 (avoids conflict with visual-rag on 8001)
   - prometheus: internal 9090 → external 9091

</attempted_approaches>

<critical_context>

## Key Architecture Decisions

1. **Service Dependencies (Startup Order):**
   ```
   db, broker → webserver, gotenberg, tika
                    ↓
              bias-engine
                    ↓
            guidance-service
                    ↓
              paperless-ai ← visual-rag
                    ↓
              prometheus → grafana
   ```

2. **Port Mappings:**
   | Service | Internal | External | Protocol |
   |---------|----------|----------|----------|
   | bias-engine (gRPC) | 50051 | 50051 | gRPC |
   | bias-engine (metrics) | 8001 | 8003 | HTTP |
   | guidance-service | 8002 | 8002 | HTTP |
   | visual-rag | 8001 | 8001 | HTTP |
   | prometheus | 9090 | 9091 | HTTP |
   | grafana | 3000 | 3001 | HTTP |

3. **Bias Engine Purpose:**
   - Computes logit biases for constrained generation
   - Uses regex FSM (Finite State Machine) to determine valid tokens
   - Returns sparse bias map: `{token_id: 100.0}` for valid tokens
   - Enables Guidance AI framework to enforce output patterns (emails, dates, amounts, etc.)

## Environment Variables

```env
# Bias Engine
BIAS_ENGINE_URL=bias-engine:50051
BIAS_ENGINE_ENABLED=yes
TOKENIZER_MODEL=gpt2

# Guidance Service
GUIDANCE_SERVICE_URL=http://guidance-service:8002
GUIDANCE_MODEL=sauerkraut-llama3.1:8b
BIAS_ENGINE_URL=bias-engine:50051  # Also in guidance-service environment

# Visual RAG
VISUAL_RAG_URL=http://visual-rag:8001

# Monitoring
GF_SECURITY_ADMIN_PASSWORD=admin
```

## File Locations

| Category | Path |
|----------|------|
| Docker configs | `C:\Users\pwalc\MyApps\paperless-ngx\` |
| Bias engine source | `C:\Users\pwalc\MyApps\paperless-ai\guidance-bias-engine\` |
| Monitoring config | `C:\Users\pwalc\MyApps\paperless-ai\monitoring\prometheus.yml` |
| Agent definitions | `C:\Users\pwalc\MyApps\paperless-ai\.claude\agents\` |
| Agent registry | `C:\Users\pwalc\MyApps\paperless-ai\.claude\agents.toml` |
| Integration tests | `C:\Users\pwalc\MyApps\paperless-ai\test\integration\bias-engine.test.js` |

## Guidance Expert Knowledge

Knowledge files at `.claude/knowledge/guidance-expert/`:
- `SKILL.md` - Main skill documentation (READ FIRST)
- `references/quick-reference.md` - Quick syntax reference
- `references/guidance-functions.md` - gen(), select(), tools, grammars
- `references/core-concepts.md` - Model immutability, context managers
- `references/litellm-ollama.md` - LiteLLM configuration
- `references/streaming.md` - Async patterns
- `references/dms-patterns.md` - DMS workflows
- `references/postgresql-pgvector.md` - Vector search
- `scripts/snippets.py` - Code templates

## Bias Engine gRPC Interface

```protobuf
service LogitBiasService {
  rpc ComputeBiases(BiasRequest) returns (BiasResponse);
  rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}

message BiasRequest {
  string regex_pattern = 1;
  string generated_text = 2;
  int32 vocab_size = 3;
}

message BiasResponse {
  map<int32, float> token_biases = 1;
  int32 computation_time_ms = 2;
  bool cache_hit = 3;
}
```

</critical_context>

<current_state>

## Deliverable Status

| Item | Status | Notes |
|------|--------|-------|
| Subagent creation (7 agents) | **Complete** | All registered in agents.toml |
| Docker integration (11 services) | **Complete** | Configured, NOT started |
| Documentation (CLAUDE.md) | **Complete** | Architecture table updated |
| Prometheus config | **Complete** | Full stack monitoring |
| Integration tests | **Complete** | bias-engine.test.js created |
| Cleanup old files | **Complete** | Removed duplicate configs |

## Docker Stack Status

The Docker stack has been **configured but NOT started**. All configuration changes saved to:
- `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.yml` (11 services)
- `C:\Users\pwalc\MyApps\paperless-ngx\docker-compose.env` (bias engine vars added)

## Background Task

There is a background bash task `b67a02a` with significant output (10538+ lines). This may be a previous docker compose operation. Check status:
```bash
# View output
cat "C:\Users\pwalc\AppData\Local\Temp\claude\C--Users-pwalc-MyApps-paperless-ai\tasks\b67a02a.output"

# Or check last 50 lines
tail -50 "C:\Users\pwalc\AppData\Local\Temp\claude\C--Users-pwalc-MyApps-paperless-ai\tasks\b67a02a.output"
```

## Open Questions

1. **Guidance-service gRPC client:** Does guidance-service have gRPC client code to connect to bias-engine? May need to implement if not present.

2. **Healthcheck reliability:** The bias-engine healthcheck uses `python -c "import grpc; ..."`. Verify this works in the slim Python container.

3. **Prometheus scrape interval:** Currently 15s. Adjust for production if needed.

## Next Actions

1. Start Docker stack:
   ```bash
   cd C:\Users\pwalc\MyApps\paperless-ngx
   docker compose up -d --build
   ```

2. Verify all 11 services are healthy:
   ```bash
   docker compose ps
   ```

3. Test bias-engine:
   ```bash
   curl http://localhost:8003/metrics
   ```

4. Access Grafana:
   - URL: http://localhost:3001
   - Login: admin/admin

</current_state>
