<model_profile>
    <id>tomoro-colqwen3-embed-8b</id>
    <name>Tomoro ColQwen3 (The Visual Librarian)</name>
    <status>Experimental / External Service</status>
    
    <technical_specs>
        <architecture>ColPali / ColQwen (Vision-Language Retriever)</architecture>
        <methodology>Late Interaction (MaxSim)</methodology>
        <embedding_type>Single 320-d vector per image patch (dense)</embedding_type>
        <embedding_size>320</embedding_size>
        <context_window>32768</context_window>
        <token_budget>Up to 1280 visual tokens per page (5120 for video)</token_budget>
        <output>Multi-vector (seq_len × 320), L2-normalized</output>
        <precision>bfloat16, FlashAttention 2</precision>
        <storage_efficiency>~13× storage efficiency vs ColQwen2</storage_efficiency>
        <file_size>8.5 GB</file_size>
        <primary_strength>Zero-Loss Visual Retrieval (Finds charts, layouts, and handwriting without OCR)</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>32768</context_window>
    </token_limits>

    <notes>
        <note>When migrating from ColQwen2, existing indexes are not byte-compatible; re-indexing is required. See `migrations/04_change_embeddings_to_320.js` and `scripts/migrate_visual_rag_colqwen3.js` for migration guidance.</note>
    </notes>

    <integration_requirements>
        <runtime>Python 3.10+ (PyTorch + Byaldi/ColPali Engine)</runtime>
        <hardware>Dedicated GPU (12GB+ VRAM recommended)</hardware>
        <storage>High-speed SSD (Visual indices are large)</storage>
        <limitations>Cannot run in Ollama. Requires a sidecar Docker container.</limitations>
    </integration_requirements>

    <usage_guide>
        <description>
            This model indexes PDF pages as *images*. It preserves the spatial layout of invoices, tables, and charts.
            When you search "Total amount at the bottom", it finds the pixels at the bottom, even if OCR failed.
        </description>

        <strategic_role>
            <role_name>Deep Visual Search</role_name>
            <function>
                Serves as the "Level 2" retrieval layer.
                If the standard PostgreSQL text search fails to find a document, this visual index is queried.
            </function>
        </strategic_role>

        <capabilities>
            <what_it_can_do>
                <item>Find visually similar document pages or regions</item>
                <item>Match text by visual appearance ("total at bottom")</item>
                <item>Locate handwriting, stamps, logos, signatures</item>
                <item>Understand spatial relationships in layouts</item>
                <item>Retrieve pages using image queries (visual similarity)</item>
                <item>Generate 320-d embeddings for image patches</item>
            </what_it_can_do>

            <what_it_cannot_do>
                <item>Extract text from images (NOT an OCR model)</item>
                <item>Detect specific elements (tables, figures) with bounding boxes</item>
                <item>Perform structured layout analysis</item>
                <item>Generate semantic labels for document regions</item>
                <item>Provide element-level classification</item>
                <item>Replace layout analysis models like LayoutLMv3 or Detectron2</item>
            </what_it_cannot_do>
        </capabilities>

        <architecture_note>
            This is a Late Interaction retrieval model using MaxSim scoring.
            It produces MULTIPLE vectors per page (one per visual patch), enabling fine-grained matching.
            This is fundamentally different from object detection or layout analysis.
        </architecture_note>
    </usage_guide>

    <implementation_notes>
        <pipeline_integration>
            <stage>Stage 8: Visual Query Execution</stage>
            <purpose>Execute targeted visual queries for field validation</purpose>
            <endpoint>/search (Visual RAG Sidecar)</endpoint>
            <not_used_for>
                Stage 4 Track 3 (Visual Element Detection) - requires LayoutLMv3 instead
            </not_used_for>
        </pipeline_integration>

        <common_confusion>
            ColQwen3 is often confused with layout analysis models.
            - Visual Retrieval (ColQwen3): "Find pages that look like this"
            - Layout Analysis (LayoutLMv3): "Find all tables and figures with bounding boxes"

            See docs/VISUAL_RAG_ARCHITECTURE_AND_COLQWEN3.md for clarification.
        </common_confusion>
    </implementation_notes>
</model_profile>
