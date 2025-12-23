<model_profile>
    <id>medtext-llama3:latest</id>
    <name>MedText Llama 3 (Medical Knowledge Base)</name>
    
    <technical_specs>
        <base_model>Llama 3 8B</base_model>
        <primary_strength>Medical definitions, Drug interactions, Clinical guidelines</primary_strength>
    </technical_specs>

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