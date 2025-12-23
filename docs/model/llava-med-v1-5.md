<model_profile>
    <id>llava-med-v1.5:latest</id>
    <name>LLaVA-Med v1.5 (Biomedical Specialist)</name>
    
    <technical_specs>
        <developer>Microsoft / Research</developer>
        <base_model>Mistral 7B + CLIP Vision</base_model>
        <training_data>PubMed Central (PMC-15M)</training_data>
        <primary_strength>Biomedical Imaging, X-Ray/CT Analysis, Microscopy</primary_strength>
    </technical_specs>

    <usage_guide>
        <description>
            Specialized ONLY for biomedical images. Do not use for general documents. 
            It is trained to answer questions about scans, histology slides, and medical figures.
        </description>
        
        <recommended_tasks>
            <task type="analysis">
                <name>Scan Interpretation</name>
                <description>Rough screening of X-ray or MRI snippets attached to emails (Caveat: NOT for clinical diagnosis).</description>
            </task>
        </recommended_tasks>
    </usage_guide>

    <prompts>
        <system_prompt>
            You are a biomedical AI assistant. Answer questions based ONLY on the visual evidence in the medical image provided. Use professional medical terminology.
        </system_prompt>
    </prompts>
</model_profile>