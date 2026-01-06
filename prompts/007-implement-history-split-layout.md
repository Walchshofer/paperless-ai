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
2. Move this prompt to ``./paperless-ai/prompts/completed/``
</lifecycle>
