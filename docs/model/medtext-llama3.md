<model_profile>
    <id>medtext-llama3:latest</id>
    <name>MedText Llama 3 (Medical Knowledge Base)</name>
    
    <technical_specs>
        <base_model>Llama 3 8B</base_model>
        <primary_strength>Medical definitions, Drug interactions, Clinical guidelines</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>128000</context_window>
        <output_limit>4096</output_limit>
        <note>Based on Meta Llama 3.1 model cards which report a 128K context window for Llama 3.1 family models.</note>
    </token_limits>

    <references>
        <reference url="https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct">Meta Llama 3.1 model card (context length 128k)</reference>
    </references>

    <usage_guide>
        <description>
            A pure text model trained on medical textbooks and guidelines. 
            Use this as a "Dictionary" to explain terms found in your Medilab reports.
        </description>
        
        <recommended_tasks>
            <task type="explanation">
                <name>Term Definitions</name>
                <description>Example: "What does 'HbA1c' mean and what is the normal range?"</description>
            </task>
        </recommended_tasks>
    </usage_guide>

    <limitations>
        <warning>
            This model may not have the "Reasoning" capabilities of DragonLLM. 
            Use Dragon for analysis; use MedText for definitions.
        </warning>
    </limitations>
</model_profile>