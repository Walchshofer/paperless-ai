<objective>
Complete the Manual Route UI by implementing the unified multi-tab editor, granular feedback controls, and the final Save submission.
This is Phase 4 of the Manual Route UI Enhancement Plan.
</objective>

<context>
The Manual UI acts as the final check before data is saved. We need to capture explicit user feedback (Thumbs Up/Down) on specific cards and provide a clean editing experience.
Reference: @MANUAL-ROUTE-UI-ENHANCEMENT-PLAN.md
</context>

<requirements>
1. **Feedback Controls**:
   - Modify @paperless-ai/views/manual.ejs.
   - Add small Thumbs Up / Thumbs Down icons to the headers of:
     - Tags Card
     - Custom Fields Card
     - Summary/Analysis Card
   - Toggle logic: Clicking one should update a hidden state object tracking `feedback_type` for that component.

2. **Multi-Tab Editor**:
   - Reorganize the "Edit" column into tabs:
     - **Tab 1: Metadata** (Title, Date, Correspondent - existing).
     - **Tab 2: Content** (Raw text/OCR - existing).
     - **Tab 3: Fields** (Dynamic list of Custom Fields - allow adding/removing/editing values).

3. **Save & Submit Logic**:
   - Update the "Save" button click handler.
   - Construct the Unified Payload:
     ```json
     {
       "documentId": "...",
       "document_updates": { ... }, // For Paperless-ngx
       "feedback_events": [ ... ],  // From Thumbs Up/Down and diffs
       "visual_annotations": [ ... ] // From Prompt 003
     }
     ```
   - Send POST request to `/manual/updateDocument` (the orchestrator).
   - Handle success (toast notification) and error states.

4. **Visual Polish**:
   - Ensure the new tabs and buttons match the existing Bootstrap/CSS theme.
</requirements>

<output>
- `./paperless-ai/views/manual.ejs` (Modified)
- `./paperless-ai/public/js/manual_form_logic.js` (Created/Modified)
</output>

<verification>
- Verify the payload structure in the browser console before sending.
- Verify that toggling a "Thumbs Down" adds a `rejection` event to the payload.
</verification>
