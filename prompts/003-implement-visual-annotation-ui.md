<objective>
Implement the "Red Pen" visual annotation tool in the Manual Route frontend.
This is Phase 3 of the Manual Route UI Enhancement Plan.
</objective>

<context>
Users need to draw bounding boxes on the document image to correct AI mistakes (e.g., missed tables, bad handwriting).
This happens in the "Visual Preview" column of the Manual UI.
Reference: @MANUAL-ROUTE-UI-ENHANCEMENT-PLAN.md
</context>

<requirements>
1. **Canvas Layer**:
   - Modify @paperless-ai/views/manual.ejs.
   - Add a canvas or SVG overlay on top of the document image in the Visual Preview area.
   - Ensure it scales correctly with the image (responsive).

2. **Drawing Interaction**:
   - Implement "Draw Mode" toggle.
   - Allow user to click-and-drag to draw a red bounding box.
   - On mouse up, open a small modal/popover asking for the "Correct Text/Comment" for this region.

3. **State Management**:
   - Store the created annotations (bbox + text) in a client-side array/state.
   - Display the drawn boxes persistently on the image.
   - Allow deleting an annotation.

4. **Integration Prep**:
   - Expose the annotation data so it can be gathered by the "Save" button (to be implemented in the next phase).
</requirements>

<implementation>
- Use vanilla JS or existing frontend libraries present in the project (check `package.json` or `views/` scripts). Do not introduce heavy framework dependencies.
- Keep the UI clean and unobtrusive.
- Use the existing "Visual Analysis" styling as a reference.
</implementation>

<output>
- `./paperless-ai/views/manual.ejs` (Modified)
- `./paperless-ai/public/js/manual-annotation.js` (Created - optional, if you prefer separating logic)
</output>

<verification>
- Verify that drawing a box works and coordinates are captured relative to the image natural size (not just screen size).
- Verify the input modal appears and saves the text to the local state.
</verification>
