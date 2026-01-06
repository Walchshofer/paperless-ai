# Manual Route UI Enhancement Plan (v2)

## 1. Audit & Strategy

### 1.1. Audit Findings
*   **Feedback System**: Currently limited to document-level ratings (`FeedbackService.js`). Lacks the granularity to track specific component failures (e.g., "Tags correct, but Summary wrong").
*   **Visual Sidecar**: The `visual-rag` service automates ingestion but lacks a manual entry point. There is no mechanism to feed user corrections (bounding boxes + comments) back into the Vector DB.
*   **Paperless Service**: The `updateDocument` method has commented-out code for custom fields, which must be enabled to support the requirement.

### 1.2. The Solution
*   **Granular Feedback**: We will attach feedback controls to **each intelligence card** (Tags, Custom Fields, Analysis). This data is stored in **PostgreSQL**, enabling the system to learn from specific user corrections (e.g., "User corrected the 'Total' field 5 times for this Vendor").
*   **Visual Annotation ("The Red Pen")**: Users can draw a box on the document image (e.g., around unreadable handwriting or a missed table row) and provide the correct text. This creates a "User Annotation" overlay in the **pgvector** database. This manual entry is treated as ground-truth data, allowing the search engine to find the document based on the user's manual correction, effectively "patching" OCR failures.
*   **Unified Persistence**: A single "Save" action will update Paperless-ngx metadata and transactional feedback simultaneously.

## 2. Backend Enhancements (PostgreSQL + pgvector)

### 2.1. Database Schema (PostgreSQL)
Instead of fragile JSON files, we will utilize the existing PostgreSQL database to store granular feedback and visual overlays. This enables direct SQL querying for model retraining and bias optimization.

#### Table: `visual_overlays` (Existing/Enhanced)
Stores vector embeddings for document regions, including manual user annotations.
*   `id`: UUID (Primary Key)
*   `document_id`: Integer (Foreign Key to Paperless Documents)
*   `embedding_vector`: vector(768) (pgvector column)
*   `text_content`: Text (The content of the region or user comment)
*   `bbox`: JSONB (Format: `[x, y, w, h]`)
*   `metadata`: JSONB (Stores `source: 'manual'`, `author: 'user'`, `confidence: 1.0`)
*   `created_at`: Timestamp

#### Table: `feedback_events` (New)
Captures granular user corrections for reinforcement learning and logit bias adjustment.
*   `id`: UUID (Primary Key)
*   `document_id`: Integer (Foreign Key)
*   `overlay_id`: UUID (Optional FK to `visual_overlays` if feedback relates to a specific region)
*   `target_field`: String (e.g., `'summary'`, `'tag:123'`, `'custom_field:invoice_date'`)
*   `feedback_type`: Enum (`'correction'`, `'confirmation'`, `'rejection'`, `'visual_annotation'`)
*   `original_value`: Text/JSONB (What the AI proposed)
*   `corrected_value`: Text/JSONB (What the user accepted/entered)
*   `user_comment`: Text (Optional explanation)
*   `applied_to_training`: Boolean (Default: `false`)
*   `created_at`: Timestamp

### 2.2. New Endpoint: `/api/visual-rag/feedback`
*   **Purpose**: Single endpoint to handle both visual annotations and metadata corrections.
*   **Payload**:
    ```json
    {
      "documentId": 123,
      "visual_annotation": {
        "bbox": [10, 10, 200, 50],
        "text": "Correct Invoice Total: $500.00",
        "save_as_overlay": true
      },
      "field_feedback": [
        {
          "target": "custom_field:total",
          "original": "$400.00",
          "corrected": "$500.00",
          "type": "correction"
        },
        {
          "target": "tags",
          "original": ["invoice"],
          "corrected": ["invoice", "paid"],
          "type": "correction"
        }
      ]
    }
    ```
*   **Action**:
    1.  **Transaction Start**: Begin Postgres transaction.
    2.  **Process Visual**: If `visual_annotation` exists:
        *   Generate embedding for `text`.
        *   Insert into `visual_overlays` with `source='manual'`.
    3.  **Process Feedback**: Iterate `field_feedback` and insert into `feedback_events`.
    4.  **Transaction Commit**.

### 2.3. Enhanced Route: `/manual/updateDocument`
*   **Logic Update**:
    *   Instead of writing to JSON, this route now acts as an orchestrator.
    *   1. Call Paperless-ngx API to update the live document (Title, Content, Fields).
    *   2. Call `POST /api/visual-rag/feedback` to persist the training signals (the difference between old and new values).

## 3. Frontend Enhancements (`manual.ejs`)

### 3.1. Visual Annotation Tool
*   **UI**: A "Draw" mode in the Visual Preview.
*   **Action**: User draws a bounding box -> Input Modal appears -> User types comment -> "Save".
*   **Result**: Immediate visual feedback (red box stays on screen) + background POST to ingestion API.

### 3.2. Granular Feedback Controls
*   **Cards**: Add small "Thumbs Up/Down" icons to the headers of the **Tags**, **Custom Fields**, and **AI Analysis** cards.
*   **State**: Toggle state is captured and sent with the final "Save".

### 3.3. Unified Edit Form
*   **Structure**:
    *   **Header**: Title, Correspondent, Date, Serial.
    *   **Tabs**:
        1.  **Text**: Raw OCR editor.
        2.  **Summary**: AI Summary editor.
        3.  **Fields**: Dynamic Custom Field list (Add/Remove/Edit).
*   **Actions**: "Save & Submit" (Persist everything), "Reset".

## 4. Implementation Phases

### Phase 1: Backend Core
1.  **Documentation (Doc-First)**:
    *   Create `doc/arch/adr-006-feedback-persistence-strategy.md` (Formalize Postgres decision).
    *   Update `paperless-ai/docs/DATABASE_SETUP.md` (Document `feedback_events` schema).
    *   Update `paperless-ai/docs/SCHEMA_EVOLUTION_GUIDE.md` (Register new schema).
2.  **Database Migration**: Create `feedback_events` table and ensure `visual_overlays` is ready in PostgreSQL.
3.  **Paperless Service**: Uncomment and fix custom field update logic.
4.  **Visual API**: Implement `POST /api/visual-rag/feedback` and update `IngestionManager` logic to handle feedback events.
5.  **Update Route**: Expand `/manual/updateDocument` to handle granular feedback and new fields.

### Phase 2: Frontend Logic
1.  **Annotation Tool**: Implement drawing logic on the overlay viewer.
2.  **Card Components**: Add feedback UI to cards.
3.  **Form Logic**: Implement the multi-tab editor and data collection.

### Phase 3: Integration
1.  Wire up the "Save" button to the new route.
2.  Verify the full loop: Edit -> Save -> Search (validate annotation is found).