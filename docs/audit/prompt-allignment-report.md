# Prompt & Codebase Alignment Audit Report

**Date:** 2026-01-06
**Auditor:** Gemini CLI Agent

## Executive Summary
This audit evaluated the alignment of the project's prompts (001-016) and key codebase areas (Playground) against the authoritative documentation (`FEEDBACK_PERSISTENCE_STRATEGY.md`, `FRONTEND_ARCHITECTURE.md`) and the strict "Local Only / Ollama" constraint.

**Status:** ⚠️ **Partial Compliance**

*   **Prompts (001-016):** Generally aligned with documentation.
    *   **Issue:** Prompt 005 specifies a Python Sidecar for Visual RAG. While "local", it deviates from the "Ollama as provider" preference, though likely necessary for the specialized ColQwen model.
*   **Codebase (Playground):** ❌ **Non-Compliant**.
    *   **Local Constraint:** `setup.js` contains active code paths for OpenAI, Azure, and Custom providers.
    *   **Frontend Architecture:** `playground.ejs` uses legacy Vanilla JS/jQuery, ignoring the "Islands" architecture mandate.

## Detailed Findings

### 1. Local-Only / Ollama Constraint
*   **Constraint:** "System must be fully local using ollama, ollama_vision as a provider. DO NOT use any propriety models."
*   **Finding (Codebase):** The `/manual/playground` route in `routes/setup.js` explicitly imports and uses `openaiService` and `azureService`.
*   **Finding (Prompt 005):** Prescribes a Python sidecar (`main.py`) loading `TomoroAI/tomoro-colqwen3-embed-8b`.
    *   *Analysis:* This runs locally (PyTorch), satisfying privacy. However, it does not use Ollama. Given ColQwen's specialized nature (Visual Retrieval), this is likely an architectural necessity, but it must be strictly firewalled to prevent external calls.

### 2. Documentation Alignment
*   **Constraint:** Adherence to `FEEDBACK_PERSISTENCE_STRATEGY.md` and `FRONTEND_ARCHITECTURE.md`.
*   **Finding (Playground):**
    *   `views/playground.ejs` and `public/js/playground.js` are monolithic EJS/JS files.
    *   **Violation:** `FRONTEND_ARCHITECTURE.md` mandates a "Multi-Page Application with Preact Islands" and "Zod View Model Contracts". The Playground is a legacy artifact that has not been modernized.
    *   **Violation:** `FEEDBACK_PERSISTENCE_STRATEGY.md` requires feedback to be stored in `feedback_events`. The current playground uses an ad-hoc `/manual/playground` endpoint that returns analysis but does not appear to persist structured feedback events for training.

### 3. Prompt Audit (001-016)
*   **001-004:** ✅ Aligned. Correctly reference `feedback_events`, Islands, and Zod contracts.
*   **005 (Visual Sidecar):** ⚠️ "Local" but not "Ollama".
    *   *Action:* Update prompt to explicitly forbid any external API fallbacks in the Python script.
*   **006-016:** ✅ Aligned.

## Remediation Plan

To address these gaps, the following actions are required:

1.  **Create Prompt 017-refactor-playground.md:**
    *   **Objective:** Modernize the Playground to strict Islands architecture and remove all proprietary model code.
    *   **Tasks:**
        *   Remove `openaiService`, `azureService` imports/usage from `setup.js`.
        *   Refactor `playground.ejs` to use `PlaygroundIsland.tsx`.
        *   Ensure it uses the `feedback_events` schema for saving test results (if applicable) or explicitly opts out of persistence.
        *   Enforce `Ollama` (or the local Sidecar) as the *only* allowed providers.

2.  **Update Prompt 005:**
    *   Add explicit "offline-only" constraints to the Python sidecar requirements.

3.  **Update Prompt 006:**
    *   Ensure the API gateway (`visual-rag.js`) does not attempt to route to external services if the local sidecar fails.

## Duplicate Files
No duplicate files were detected in the `prompts` directory during this scan.
