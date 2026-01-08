<model_profile>
    <id>nomic-embed-text-v1.5</id>
    <name>Nomic Embed Text v1.5 (Text Embeddings)</name>

    <technical_specs>
        <developer>Nomic</developer>
        <type>Embedding (text)</type>
        <embedding_size>varies (model-specific)</embedding_size>
        <precision>float32</precision>
        <primary_strength>High-quality semantic embeddings for RAG indexing and similarity search</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>N/A</context_window>
        <output_limit>N/A</output_limit>
        <note>Embedding model: no conventional generation context window. Inputs should be chunked to an application-defined size before embedding; verify recommended chunk size with vendor docs.</note>
    </token_limits>

    <usage_guide>
        <description>
            Use this model for semantic embeddings for RAG indices and similarity search. Prefer small document chunks (e.g., 512-4096 tokens) and then index vectors.
        </description>
    </usage_guide>
</model_profile>