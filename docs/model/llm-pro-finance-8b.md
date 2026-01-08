<model_profile>
    <id>llm-pro-finance-8b</id>
    <original_name>DragonLLM/Qwen-Open-Finance-R-8B</original_name>
    <name>LLM-Pro-Finance 8B (Dragon / Finance Specialist)</name>

    <technical_specs>
        <developer>DragonLLM</developer>
        <base_model>Qwen3-8B (finetuned)</base_model>
        <primary_strength>Financial reasoning, table and invoice extraction, numeric consistency</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>32768</context_window>
        <output_limit>2048 (recommended)</output_limit>
        <note>Derived from the HuggingFace model card `DragonLLM/Qwen-Open-Finance-R-8B`, which is a finetune of Qwen3-8B (Qwen3-8B supports a ~32,768 token context window). Verify vendor model card for deployment-specific limits.</note>
    </token_limits>

    <usage_guide>
        <description>
            Use this model for domain-specific financial analysis and high-precision numeric reasoning. For large documents, consider chunking or using a model with larger context window.
        </description>
    </usage_guide>
</model_profile>