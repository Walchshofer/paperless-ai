Training Guide: Expert Model Pipelines

Welcome to the Paperless‑AI Guidance project. This guide explains how our structured extraction pipeline is organized and how to add or maintain expert templates for Austrian medical and household documents.

## The Guidance Framework 🔧

Unlike standard LLM prompts, we use the Guidance library to enforce 100% JSON validity.

- **Templates** — stored in `guidance_service/templates/`.
  - Use Guidance / Handlebars-like directives such as `{{#select}}` and `{{gen}}` to constrain output shape.
  - Templates should aim to produce exactly the JSON schema expected by downstream validators.

- **Validators** — stored in `guidance_service/validators/`.
  - Implemented as Python checks (often regex) to enforce business constraints (e.g., Austrian VAT `ATU` or ICD-10 codes).
  - Keep validators deterministic and fast to avoid slow validation loops.

## Pipeline Workflow ▶️

1. **Classification** — `nemotron-manager` (router) identifies the document type.
2. **Routing** — `services/experts/ExpertRegistry.js` maps a type to a pipeline (Medical / Financial / Legal / General).
3. **Execution** — `services/experts/ExpertPipelineExecutor.js` invokes the Guidance service when a `guidanceTemplate` is defined for a pipeline stage.
4. **Integration** — multimodal inputs (e.g., Visual RAG) and text extraction are merged into a single **Integrated Record**.

## Adding a New Template — Step by Step 🛠️

If you need to support a new document type (example: **Versicherungspolizze**):

1. Create or extend a template in `guidance_service/templates/` (e.g., `general_de.py` or a dedicated file).
2. Define the JSON structure using Guidance syntax and include examples where possible.
3. Add a validator in `guidance_service/validators/` (e.g., `validators/general.py`) to assert field-level correctness.
4. Register the template in `guidance_service/app/__init__.py` so the service exposes it.
5. Update or add a pipeline in `services/experts/pipelines/` and ensure `ExpertRegistry.js` routes to it.
6. Add an integration or unit test that runs the template and validates the output with your validator.

Quick checklist:

- [ ] Template implemented
- [ ] Validator added
- [ ] Template registered in app
- [ ] Pipeline updated
- [ ] Test(s) added and passing

## Feedback Loop & Quality Assurance 🔁

Our closed-loop process keeps accuracy improving over time:

- Users submit corrections via the frontend Feedback Form.
- Corrections are saved by `FeedbackService` in the backend.
- Analysts run `analysis/accuracy_tracking.py` to locate weak fields or recurring issues.
- Templates and validators are refined based on these findings and redeployed.

Tips:
- Periodically sample corrected records and add unit tests that capture fixes.
- Track field-level accuracy to prioritize template improvements.

## Hardware & Model Recommendations 💾

- **Target hardware**: RTX 3090 Ti (24 GB VRAM).
- **Model sizing**: prioritize 8B models (e.g., Sauerkraut, Llama variants) to run multiple experts concurrently within 24 GB.
- **Quantization**: use `Q8_0` or `FP16` for a good balance between speed and extraction precision.
- **Operational tips**: lower batch sizes and prefer single-request execution for high-precision tasks to avoid OOMs.

---

## Troubleshooting & Tips

- Validate templates locally with the Guidance library before committing.
- Use `analysis/model_comparison.py` when a new LLM version seems to break schema outputs.
- If extraction quality degrades after a model update, inspect the latest feedback sample set for changes in phrasing or patterns.

---

*Last updated: 2025-12-27*