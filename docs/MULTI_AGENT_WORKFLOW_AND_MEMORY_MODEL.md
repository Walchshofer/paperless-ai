# Multi-Agent Workflow and Memory Model

This document defines the canonical multi-agent workflow and memory discipline used by the paperless-ai repository when working with GitHub Copilot, Serena, and custom agents.

## Purpose
Deterministic, auditable multi-agent execution with explicit handoffs and Serena-compatible memory usage.

## Canonical Agent Order
optimize → docs → schema-evolution → pipeline-orchestration → guidance-expert → implement → test → debug → paperless-api-expert

## Serena Memory Model
Memories accept only name and content. All structure lives in content.

## Canonical Memory Names
- run-active
- handoff-next
- decisions
- run-log

## Required Memory Structure
[meta]
run_id, stage, agent, prompt_id, timestamp

[current_task]
[artifacts]
[risk_and_notes]

## Handoff Protocol
Agents must update run-active and write handoff-next before finishing.

## Agent Startup Discipline
Always call get_current_config and read run-active before work.
