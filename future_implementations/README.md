# future_implementations

This directory contains experimental and future implementation prototypes for the Expert Pipeline. These files are intended as references and proof-of-concepts, not as production-ready code.

Recommendation: OPTION A — Mark as "reference / experimental" and keep for developer reference. Do NOT use files from this directory in production or as part of runtime codepaths unless changes are explicitly merged into the canonical implementations under `services/`.

Notes on differences:
- Model naming: Some prototypes use `qwen3-vl:8B` (uppercase suffix) while canonical code uses `qwen3-vl:8b` (lowercase). The canonical system standardizes on lowercase model names to avoid case-sensitivity issues.
- Structural changes: Experimental files may add alternative prompt layouts or stage ordering; review before merging.
- Medical prompts: `future_implementations/services/prompts/MedicalPrompts.js` appears to closely mirror the canonical `services/prompts/MedicalPrompts.js`; treat it as a reference and prefer canonical implementations for runtime.


If you want to adopt improvements from `future_implementations/`, create a targeted PR that:
1. Documents the change and rationale
2. Adds tests and updates canonical docs
3. Migrates the change into `services/` and removes the experimental copy

For now, treat this folder as read-only reference material.