<objective>
Enhance the PaperlessService to support custom field updates and implement the orchestrator route for manual document updates.
This is Phase 2 of the Manual Route UI Enhancement Plan.
</objective>

<context>
The "Manual Route" allows users to edit document metadata. We need to upgrade this to:
1. Support writing Custom Fields back to Paperless-ngx.
2. Act as an orchestrator that saves changes to Paperless-ngx AND persists feedback signals to our local `feedback_events` table simultaneously.
Reference: @prompts/planning/MANUAL-ROUTE-UI-ENHANCEMENT-PLAN.md
</context>

<requirements>
1. **PaperlessService Upgrade**:
   - Analyze `@paperless-ai/services/paperlessService.js`.
   - Locate the `updateDocument` method and **uncomment/fix** the `custom_fields` handling. Note: earlier implementations were commented out; restore safe, idempotent handling: attempt to delete existing custom fields via `DELETE /documents/{id}/custom_fields/`, fall back to `PATCH` with `custom_fields: []`, and ensure incoming `custom_fields` are normalized to an array of `{name, value}` objects before sending to Paperless.
   - Ensure it strictly follows the Paperless-ngx API requirements for custom fields (formatting, IDs vs values). Add unit tests covering both deletion-fallback and normalization.

### Error Handling & Transactional Policy
- The orchestrator should default to **best-effort** semantics: Paperless update is primary; feedback persistence may fail without failing the update. Emit structured logs and metrics on failures.
- Support an opt-in `transactional: true` mode: in this mode, feedback persistence must succeed before the Paperless update proceeds; if persistence fails, abort with an error and do not update Paperless (caller must retry or take manual action).

### Telemetry
- Propagate `X-Request-Id` into `PaperlessService.updateDocument` and include `request_id` in all logs related to this flow.
- Emit Prometheus metrics: `integration_errors_total{stage='manual_orchestration'}` on failure and `pipeline_stage_latency_ms` for the orchestrator flow.


2. **Orchestrator Route**:
   - Identify the route handling `/manual/updateDocument` (Search for it in @paperless-ai/server.js or `routes/`).
   - Refactor it to:
     - Step 1: Call `PaperlessService.updateDocument` to save changes to the source of truth.
     - Step 2: Call `FeedbackService.recordGranularFeedback` (implemented in Prompt 001) to save the *diff* as training data.
     - Handle errors gracefully (e.g., if feedback fails, still return success but log error, or transactionally fail both if critical).

3. **Diff Logic**:
   - The route needs to calculate the "Feedback" if not explicitly provided, OR trust the frontend to send explicit feedback events.
   - Per the plan, the frontend sends a unified payload. Ensure the route parses `req.body` correctly to extract `document_updates` for Paperless and `feedback_events` for the AI database.

4. **Testing**:
   - Create a test `paperless-ai/test/manual_orchestration.test.js`.
   - Mock Paperless-ngx API responses.
   - specific test case: Update custom field + Record feedback.
</requirements>

<output>
- `./paperless-ai/services/paperlessService.js` (Modified)
- `./paperless-ai/routes/[relevant_route_file].js` (Modified)
- `./paperless-ai/test/manual_orchestration.test.js` (Created)
</output>

<verification>
- Run `npm test test/manual_orchestration.test.js`.
- Verify `PaperlessService` correctly formats custom field payloads.
</verification>
