<model_profile>
    <id>nemotron-orchestrator:8b</id>
    <name>Nemotron Orchestrator 8B (The Manager)</name>
    
    <technical_specs>
        <base_model>Qwen 3 8B (Fine-tuned by NVIDIA)</base_model>
        <variant>Claude 4.5 Opus Distill (TeichAI)</variant>
        <role>Router / Orchestrator</role>
        <primary_strength>Task Delegation, Tool Selection, Planning</primary_strength>
    </technical_specs>

    <usage_guide>
        <description>
            This model does not "do" the work; it "assigns" the work. 
            It is trained to analyze a user request and output a structured plan, calling specific tools or other models (Experts) to solve the problem.
        </description>
        
        <strategic_role>
            <role_name>System 2 Router</role_name>
            <function>
                It acts as the entry point for your Paperless-AI. 
                Instead of manually selecting "Dragon" or "Fino", you send the prompt to Nemotron.
                Nemotron decides: "This looks like a German medical report -> Delegate to Dragon-Finance."
            </function>
        </strategic_role>
    </usage_guide>

    <prompts>
        <system_prompt>
            You are an Orchestrator Agent. Your job is to analyze the user request and select the correct expert model to handle it.
            Available Experts:
            1. [Dragon-Finance]: For German medical reports, insurance analysis, and text summarization.
            2. [Fino1-Calculator]: For invoice verification, math, and table data extraction.
            3. [Qwen3-VL]: For images, scans, and handwriting.
            
            Output strictly a JSON object deciding the route.
        </system_prompt>
    </prompts>
</model_profile>