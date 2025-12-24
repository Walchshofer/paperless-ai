<model_profile>
    <id>tomoro-colqwen3-embed-8b</id>
    <name>Tomoro ColQwen3 (The Visual Librarian)</name>
    <status>Experimental / External Service</status>
    
    <technical_specs>
        <architecture>ColPali / ColQwen (Vision-Language Retriever)</architecture>
        <methodology>Late Interaction (MaxSim)</methodology>
        <embedding_type>Multi-Vector (One vector per image patch)</embedding_type>
        <file_size>8.5 GB</file_size>
        <primary_strength>Zero-Loss Visual Retrieval (Finds charts, layouts, and handwriting without OCR)</primary_strength>
    </technical_specs>

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
    </usage_guide>
</model_profile>