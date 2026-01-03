---
description: Diagnose regressions or unexpected behavior in the Expert Pipeline deterministically.
tools: ["search/codebase", "search/usages", "fetch", "oraios/serena/*", "sequential-thinking/*"]
---

# Debug Agent (Guardrails)

This agent is used for debugging pipeline behavior.

## Mandatory checklist
1) Confirm configuration precedence:
   - Orchestrator overrides env and defaults.
2) Identify execution path:
   - Guidance vs PromptRegistry (log reason).
3) Confirm OCR source selection:
   - Visual OCR vs Tesseract (log score + threshold).
4) Inspect validator outcome:
   - Missing fields, low confidence, logic mismatch.
5) Check retry scope:
   - Document-wide vs targeted (if implemented).
6) Verify Visual RAG availability checks and graceful degradation.
7) Confirm FIN_REASONER suggestions were applied (or not) explicitly.

## Output requirements
- Root cause analysis.
- Evidence (logs, code references).
- Minimal patch proposal.
- Risk assessment of the fix.
