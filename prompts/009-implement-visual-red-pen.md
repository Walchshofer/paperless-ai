<objective>
Implement the "Red Pen" interactive search tool in the History Route, allowing users to draw bounding boxes to find similar visual elements.
This is Phase 3 (Part 2) of the History Route Enhancement Plan.
</objective>

<context>
With the layout established (Prompt 008) and the API ready (Prompts 005-006), we now connect the pieces. Users will draw on the document, and the system will search for visually similar matches.
**Plan Reference:** `prompts/planning/HISTORY-ROUTE-ENHANCEMENT-PLAN.md` (Phase 3)
**Previous Context:** `prompts/summaries/008-implement-history-split-layout-summary.md`
</context>

<requirements>
1. **Canvas Interaction**:
   - Enhance the `OverlayViewer` or `history-document.ejs` script.
   - Add a "Red Pen" mode toggle.
   - When active, allow drawing a temporary bounding box on the canvas.

2. **Search Execution**:
   - On mouse up (end of drawing), capture the bounding box coordinates.
   - Extract the image crop (client-side using Canvas API or server-side).
   - Call `POST /api/visual-rag/search/visual` with the image data.
   - Show a loading state in the "Similar" tab.

3. **Result Display**:
   - Render the search results in the "Similar" tab on the right pane.
   - Display thumbnail, document title, and similarity score.
   - Clicking a result should open that document in a new tab.

4. **Feedback Integration (Optional but recommended)**:
   - Allow users to "Thumbs Up" valid search results (persisting to `feedback_events` as per Strategy).
</requirements>

<implementation>
- Ensure efficient image handling (client-side cropping preferred to save bandwidth).
- Handle empty results gracefully.
</implementation>

<output>
- `./paperless-ai/public/js/history-document.js` (Created/Modified)
- `./paperless-ai/views/history-document.ejs` (Update to include script)
</output>

<verification>
- Draw a box around a logo.
- Verify the API call is made.
- Verify results appear in the "Similar" tab.
</verification>

<lifecycle>
1. Upon completion, generate summary: `prompts/summaries/009-implement-visual-red-pen-summary.md`
2. Update `docs/RAG_SYSTEMS_REFERENCE.md` with usage details.
3. Move this prompt to `prompts/completed/009-implement-visual-red-pen.md`
</lifecycle>