<model_profile>
    <id>fino1-8b-q8</id>
    <aliases>fino1-8b</aliases>
    <name>Fino1-8B (The Calculator)</name>
    
    <technical_specs>
        <base_model>Llama 3.1</base_model>
        <quantization>Q8_0 (High Precision)</quantization>
        <file_size>8.5 GB</file_size>
        <primary_strength>Mathematical reasoning, Structured data extraction, Logical consistency</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>8192</context_window>
        <output_limit>2048</output_limit>
        <reasoning>
            <critical>NO</critical>
            <explanation>
                Standard calculation model. The 8192 context window covers most single invoices or reports. 
                Output is capped at 2048 tokens to ensure it returns concise JSON data without looping or getting stuck.
            </explanation>
        </reasoning>
    </token_limits>

    <usage_guide>
        <description>
            Use Fino1 when you need precision with numbers and structured data extraction. 
            It is less "creative" than DragonLLM but more rigorous with arithmetic and OCR correction.
        </description>
        
        <recommended_tasks>
            <task type="verification">
                <name>Invoice Verification</name>
                <description>Extract Net Total, VAT Amount, and Gross Total. Verify if Net + VAT equals the Gross Total.</description>
            </task>
            <task type="extraction">
                <name>Table Extraction</name>
                <description>Read tables in documents, identify OCR errors in numbers, and output corrected JSON.</description>
            </task>
            <task type="calculation">
                <name>Financial Logic</name>
                <description>Calculate percentage differences between values in documents.</description>
            </task>
        </recommended_tasks>
    </usage_guide>

    <prompts>
        <system_prompt>
            You are Fino1, an advanced financial reasoning engine. Your goal is to extract quantitative data from documents with extreme precision. Do not hallucinate numbers. If a value is missing, state 'N/A'. Always verify calculations step-by-step.
        </system_prompt>
        <example_prompt context="Invoice">
            Check the total sum of this invoice. Does the sum of the net amount plus 20% VAT equal the gross total shown?
        </example_prompt>
    </prompts>

    <limitations>
        <note>Primarily optimized for English financial reasoning. For complex German text analysis or medical interpretation, switch to the Dragon model.</note>
    </limitations>
</model_profile>