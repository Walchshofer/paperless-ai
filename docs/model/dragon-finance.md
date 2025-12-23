<model_profile>
    <id>dragon-finance</id>
    <name>DragonLLM Qwen Open Finance R (The Analyst)</name>
    
    <technical_specs>
        <base_model>Qwen 2.5 / 3 (Reasoning Enhanced)</base_model>
        <quantization>Q8_0 (High Precision)</quantization>
        <file_size>~9.0 GB</file_size>
        <primary_strength>Multilingual (DE/EN/FR), Contextual Analysis, Reasoning Process</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>32768</context_window>
        <output_limit>-1 (Unlimited)</output_limit>
        <reasoning>
            <critical>YES</critical>
            <explanation>
                Reasoning models generate internal "thought chains" that consume significant output tokens before answering. 
                Restricting the output limit will cause the model to fail or cut off mid-sentence. 
                The high context window (32k) is required to process full multi-page patient histories (e.g., Medilab/Elisabethinen reports) without forgetting earlier details.
            </explanation>
        </reasoning>
    </token_limits>

    <usage_guide>
        <description>
            This is the primary driver for Austrian/German documents (Medilab, Elisabethinen). 
            It excels at understanding the meaning, implications, and bureaucratic nuances of the text.
        </description>
        
        <recommended_tasks>
            <task type="analysis">
                <name>Medical-Financial Analysis</name>
                <description>Analyze lab reports (Medilab) to explain findings in simple German and highlight values relevant for insurance.</description>
            </task>
            <task type="summary">
                <name>Summarization</name>
                <description>Create concise summaries of discharge letters or bureaucratic correspondence.</description>
            </task>
            <task type="implication">
                <name>Implication Checking</name>
                <description>Determine if a document indicates a recurring payment obligation or a one-time fee.</description>
            </task>
        </recommended_tasks>

        <special_feature name="Reasoning">
            This model uses a "Thinking Process". When asking complex questions, instruct it to "Think step-by-step" to activate deep analysis.
        </special_feature>
    </usage_guide>

    <prompts>
        <system_prompt>
            You are the DragonLLM Open Finance Assistant. You specialize in analyzing financial and medical-financial documents in German and English. Use your 'Reasoning' capabilities to analyze the text step-by-step before answering. Summarize findings in the language of the document.
        </system_prompt>
        <example_prompt context="Medilab Report">
            Ich habe hier einen Medilab-Befund. Der Wert [Value] ist erhöht. Welche langfristigen finanziellen Auswirkungen hat das auf eine Krankenversicherung oder Berufsunfähigkeitsversicherung in Österreich?
        </example_prompt>
    </prompts>

    <configuration_note>
        <warning>Ensure Paperless-AI is configured to allow a large context window (16k or 32k), as this model can read very long reports.</warning>
    </configuration_note>
</model_profile>