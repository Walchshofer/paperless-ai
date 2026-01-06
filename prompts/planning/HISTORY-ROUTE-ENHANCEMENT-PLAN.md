# History Route Visual Enhancement Plan

## 1. Audit & Current State

### 1.1. `/history/doc/:id` Route
*   **Current UI**: Text-only display (`history-document.ejs`). Shows normalized text in a `<pre>` block.
*   **Missing Features**:
    *   No view of the original document image.
    *   No visual overlays (bounding boxes) for extracted fields.
    *   No interactive tools ("Red Pen").
*   **Feedback**: Basic modal exists (`FeedbackForm.js`), but it lacks visual context (cannot point to *where* the error is).

### 1.2. Visual RAG Capabilities
*   **Search**: Currently supports **Text-to-Visual** search only (via `byaldi` model).
*   **Gap**: The `visual-rag-sidecar` API (`main.py`) accepts `query: str`. It does not currently expose an endpoint for **Image-to-Image** or **Region-to-Image** search, which is required for the "Find similar logos/handwriting" feature.

## 2. Enhancement Strategy

### 2.1. Layout Modernization (Split View)
Since the history view opens in a full page, we have ample space for a rich split-screen experience:
*   **Left Pane (Visual)**: High-resolution document render with interactive canvas layer.
    *   Displays bounding boxes for extracted fields (hover to see field name).
    *   "Red Pen" drawing tool active.
*   **Right Pane (Data)**:
    *   **Tabs**:
        *   *Normalized Text*: The existing text view (preserved but better styled).
        *   *Metadata*: Field values, tags, confidence scores.
        *   *Similar*: (New) Results from visual search queries.

### 2.2. Interactive "Red Pen" Search
Enabling users to query the database using visual regions:
1.  **User Action**: User activates "Red Pen", draws a box around a logo or handwriting.
2.  **Context Menu**: Popup appears: "Find Similar" | "Correct Text".
3.  **Backend Execution**:
    *   The region image is cropped (client-side or server-side).
    *   Sent to new endpoint `POST /api/visual-rag/search/image`.
    *   Sidecar embeds the image region and performs cosine similarity search against the `visual_overlays` vector index.
4.  **Result Display**: Similar documents appear in the "Similar" tab on the right, ranked by visual similarity.

## 3. Implementation Roadmap

### Phase 1: Sidecar Upgrade (Python)
*   **Objective**: Enable image-based querying in the backend.
*   **Task**: Update `paperless-ai/services/visual-rag-sidecar/main.py`.
*   **Changes**:
    *   Modify `SearchRequest` to accept optional `query_image` (base64).
    *   Update `search` endpoint to pass image data to `state.model.search()`.

### Phase 2: API & Client (Node.js)
*   **Objective**: Expose the new capability to the frontend.
*   **Task**: Update `VisualSearchClient.js` and `routes/api/visual-rag.js`.
*   **Changes**:
    *   Add `searchImage(base64Image, k)` method to client.
    *   Create `POST /api/visual-rag/search/visual` endpoint.

### Phase 3: History UI Overhaul
*   **Objective**: Implement the split view and Red Pen interaction.
*   **Task**: Rewrite `views/history-document.ejs`.
*   **Components**:
    *   `OverlayViewer` (reuse from Manual route or refactor to shared component).
    *   `CanvasInteraction` (Drawing logic).
    *   `SplitLayout` (CSS/Grid).

## 4. Documentation Updates
*   Update `paperless-ai/docs/RAG_SYSTEMS_REFERENCE.md` to document the new image search capability.
*   Update `paperless-ai/docs/VISUAL_RAG_INTEGRATION.md` with new API contracts.
