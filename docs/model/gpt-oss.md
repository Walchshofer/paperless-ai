<model_profile>
    <id>gpt-oss</id>
    <name>GPT-OSS 20B (OpenAI Open Weights)</name>
    
    <technical_specs>
        <developer>OpenAI</developer>
        <base_architecture>Mixture-of-Experts (MoE)</base_architecture>
        <parameters>20B (Active: ~3.6B)</parameters>
        <context_window>128,000</context_window>
        <file_size>13 GB</file_size>
        <primary_strength>Reasoning (Chain-of-Thought), Agentic Tool Use, Coding</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>128000</context_window>
        <output_limit>-1</output_limit>
        <reasoning>
            <critical>YES</critical>
            <explanation>
                GPT-OSS uses "Reasoning Effort" (Low/Medium/High). Like the "o1/o4" series, it generates hidden reasoning tokens. 
                Do not constrain the output token limit strictly, or it will cut off complex thoughts.
            </explanation>
        </reasoning>
    </token_limits>

    <usage_guide>
        <description>
            This is your general-purpose "Heavy Lifter". Unlike Llama or Mistral, this model is built by OpenAI specifically for complex reasoning and agentic tasks (using tools).
        </description>
        
        <recommended_tasks>
            <task type="reasoning">
                <name>Complex Problem Solving</name>
                <description>Use this for logic puzzles, coding architecture, or multi-step financial planning.</description>
            </task>
            <task type="agent">
                <name>Tool Use</name>
                <description>This model is optimized to call external tools (e.g., Python scripts, Web Search) if Paperless-AI supports tool binding.</description>
            </task>
        </recommended_tasks>
    </usage_guide>

    <prompts>
        <system_prompt>
            You are GPT-OSS, a reasoning model by OpenAI. 
            Reasoning Effort: High.
            Think step-by-step before answering.
        </system_prompt>
    </prompts>
</model_profile>