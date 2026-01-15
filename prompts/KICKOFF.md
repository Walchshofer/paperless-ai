# Paperless-AI Implementation Kickoff Prompt

> **Orchestrator Agent:** `@optimize`
> **MCP Required:** `oraios-serena`
> **Hardware Profile:** RTX 3090 Ti (Ampere SM86)

---

## Expert Agent Reference

| Agent | Stage | Responsibility |
|-------|-------|----------------|
| **Optimize** | 000 | MoE orchestrator; coordinates subagents and handoffs. |
| **Docs** | 010 | Documentation authority; enforces "Doc-First" rule. |
| **Schema Evolution** | 020 | Manages **Distance Metric Locks** and Hybrid SOT migrations. |
| **Pipeline Expert** | 030 | Manages the **503 Initializing** handshake and MaxSim flow. |
| **Implement** | 050 | Production code changes; enforces **79-character Python limit**. |
| **Test** | 060 | Unit/Integration/E2E tests (Mocha + PyTest). |

---

## Tier-0 Documentation (MUST READ)

The following documents are authoritative. If implementation conflicts with Tier-0, Tier-0 wins:

0. `docs/AGENT_READ_POLICY.md` - Defines the reading policy for all agents.
1. `docs/EXPERT_PIPELINE_DECISION_TABLE.md` - Pipeline gates and retries.
2. `docs/QDRANT_MIGRATION.md` - Hybrid SOT and collection specs.
3. `docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md` - MaxSim and RTX 3090 Ti constraints.
4. `docs/PROMPT_REGISTRY_GUIDANCE_INTERACTION.md` - PromptRegistry authority.

---

## Quick Start (Full Orchestration)


```

@optimize Execute the attached prompt file following the execution order.

Serena initialization:

1. Call `oraios/serena/get_current_config` - verify project is paperless-ai.
2. Read memories: `run-active`, `handoff-next`.
3. Follow the dependency graph in `prompts/EXECUTION_ORDER.md`.

For each prompt, maintain the "Detox" standard: Python lines <= 79 chars, zero vector columns in Postgres.
