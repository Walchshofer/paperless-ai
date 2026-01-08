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
        <context_window>256000</context_window>
        <output_limit>-1</output_limit>
        <source>Vendor model cards and release notes (Qwen3 family) report native 256K context windows for Qwen3-VL series; extrapolation methods extend to larger windows. See: https://github.com/QwenLM/Qwen3 and https://ollama.com/library/qwen3</source>
    </token_limits>

    <references>
        <reference url="https://github.com/QwenLM/Qwen3">Qwen3 GitHub (QwenLM)</reference>
        <reference url="https://ollama.com/library/qwen3">Ollama model listing: qwen3 (library)</reference>
    </references>

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