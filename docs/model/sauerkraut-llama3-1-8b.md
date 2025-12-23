<model_profile>
    <id>sauerkraut-llama3.1:8b</id>
    <name>SauerkrautLM v3.1 (The German Native)</name>
    
    <technical_specs>
        <developer>VAGO Solutions</developer>
        <base_model>Llama 3.1 8B</base_model>
        <primary_strength>German Cultural Nuance, Polite Correspondence, DACH-region specific knowledge</primary_strength>
    </technical_specs>

    <token_limits>
        <context_window>128000</context_window>
        <output_limit>4096</output_limit>
    </token_limits>

    <usage_guide>
        <description>
            Use this model for **Communication**. It writes the most natural-sounding German emails and letters. It is less "analytical" than Dragon but more "human" in German.
        </description>
        
        <recommended_tasks>
            <task type="writing">
                <name>Email Drafting</name>
                <description>Drafting polite replies to insurance companies or authorities (Finanzamt).</description>
            </task>
            <task type="translation">
                <name>Nuanced Translation</name>
                <description>Translating English technical terms into proper Austrian/German business German.</description>
            </task>
        </recommended_tasks>
    </usage_guide>

    <prompts>
        <system_prompt>
            Du bist ein hilfreicher Assistent. Antworte immer auf Deutsch. 
            Achte auf einen höflichen, professionellen Stil (Sie-Form), passend für den geschäftlichen Schriftverkehr in Österreich/Deutschland.
        </system_prompt>
    </prompts>
</model_profile>