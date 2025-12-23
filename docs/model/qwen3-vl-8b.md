<model_profile>
    <id>qwen3-vl:8b</id>
    <name>Qwen3-VL 8B (Vision & Reasoning)</name>
    
    <technical_specs>
        <developer>Alibaba Cloud (Qwen Team)</developer>
        <type>Multimodal (Vision + Text)</type>
        <context_window>256,000</context_window>
        <primary_strength>OCR (32 languages), Handwriting Recognition, Graph Analysis</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>32000</context_window> <output_limit>-1</output_limit>
    </token_limits>

    <usage_guide>
        <description>
            Use this model for **Image Analysis**. It is significantly better than LLaVA 1.5/1.6 at reading dense text (OCR) and understanding charts in financial reports.
        </description>
        
        <recommended_tasks>
            <task type="ocr">
                <name>Handwritten Notes</name>
                <description>Transcribing handwritten doctor notes from Medilab reports.</description>
            </task>
            <task type="analysis">
                <name>Chart Reading</name>
                <description>Extracting trends from stock charts or lab value graphs (visual plots).</description>
            </task>
        </recommended_tasks>
    </usage_guide>

    <prompts>
        <system_prompt>
            You are Qwen3-VL. specific 'Thinking' model for vision. 
            Analyze the image details meticulously. If you see text, transcribe it exactly.
        </system_prompt>
    </prompts>
</model_profile>