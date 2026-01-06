<objective>
Refactor the History Document View to use a modern split-screen layout, preparing the stage for visual interaction.
This is Phase 3 (Part 1) of the History Route Enhancement Plan.
</objective>

<context>
The current ``history/doc`/:id` view is text-heavy. We need to introduce a split layout: High-res visual document on the left, data/results on the right. This prompts focuses on layout and component integration without the complex drawing logic.
**Plan Reference:** @paperless-ai/prompts/planning/HISTORY-ROUTE-ENHANCEMENT-PLAN.md (Phase 3)
**Compliance:** Adhere to @paperless-ai/docs/FRONTEND_ARCHITECTURE.md (Islands architecture if applicable, or standard EJS/Vanilla JS components).
**Previous Context:** Read summary: @paperless-ai/prompts/summaries/006-expose-visual-search-api-summary.md
</context>

<requirements>
1. **Layout Overhaul**:
   - Modify ``paperless-ai/views/history-document.ejs``.
   - Implement a CSS Grid/Flex layout:
     - **Left Pane (60%)**: Container for `OverlayViewer` (Visual representation).
     - **Right Pane (40%)**: Tabbed interface.

2. **Right Pane Tabs**:
   - Implement navigation tabs: "Text" (existing normalized text), "Metadata" (fields), "Similar" (placeholder for search results).
   - Ensure the "Text" tab displays the existing `<pre>` content correctly.

3. **Component Integration**:
   - Import `OverlayViewer` (from ``public/js/components`/`) to display the document image in the Left Pane.
   - Ensure it loads the image for the current document ID.

4. **Styling**:
   - Use Tailwind CSS for the grid structure.
   - Ensure responsiveness (stack vertically on mobile).
</requirements>

<implementation>
- Reuse existing frontend components where possible (`OverlayViewer`).
- Keep the page lightweight; do not load the "Similar" data yet.
</implementation>

<output>
- ``./paperless-ai/views/history-document.ejs`` (Modified)
- ``./paperless-ai/public/css/history.css`` (Optional/If needed)
</output>

<verification>
- Load a document in the history route.
- Verify the split pane appears.
- Verify the document image loads on the left.
- Verify the text content is accessible in the right tab.
</verification>

<lifecycle>
1. Upon completion, generate summary: ``./paperless-ai/prompts/summaries/007-implement-history-split-layout-summary.md``
2. Move this prompt to ``./paperless-ai/prompts/completed`/`
</lifecycle>
4. paperless-ai/prompts/008-implement-visual-red-pen.md
<objective>
Implement the "Red Pen" interactive search tool in the History Route, allowing users to draw bounding boxes to find similar visual elements.
This is Phase 3 (Part 2) of the History Route Enhancement Plan.
</objective>

<context>
With the layout established (Prompt 007) and the API ready (Prompt 006), we now connect the pieces. Users will draw on the document, and the system will search for visually similar matches.
**Plan Reference:** @paperless-ai/prompts/planning/HISTORY-ROUTE-ENHANCEMENT-PLAN.md (Phase 3)
**Previous Context:** Read summary: @paperless-ai/prompts/summaries/007-implement-history-split-layout-summary.md
</context>

<requirements>
1. **Canvas Interaction**:
   - Enhance the `OverlayViewer` or ``history-document.ejs`` script.
   - Add a "Red Pen" mode toggle.
   - When active, allow drawing a temporary bounding box on the canvas.

2. **Search Execution**:
   - On mouse up (end of drawing), capture the bounding box coordinates.
   - Extract the image crop (client-side using Canvas API or server-side).
   - Call ``POST /api/visual-rag/search/visual`` with the image data.
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
- ``./paperless-ai/public/js/history-document.js`` (Created/Modified)
- ``./paperless-ai/views/history-document.ejs`` (Update to include script)
</output>

<verification>
- Draw a box around a logo.
- Verify the API call is made.
- Verify results appear in the "Similar" tab.
</verification>

<lifecycle>
1. Upon completion, generate summary: ``./paperless-ai/prompts/summaries/008-implement-visual-red-pen-summary.md``
2. Update `@`paperless-ai/docs/RAG_SYSTEMS_REFERENCE.md`` with usage details.
3. Move this prompt to ``./paperless-ai/prompts/completed`/`
</lifecycle>
