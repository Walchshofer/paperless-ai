<session_initialization>
Before beginning research, verify today's date:
!`date +%Y-%m-%d`

Use this date when searching for "current" or "latest" information.
</session_initialization>

<research_objective>
Research the External API Integration feature in paperless-ai to understand how it works architecturally and how it can be leveraged in prompt strategies.

Purpose: Inform prompt 002 strategy by understanding how external data flows into AI prompts
Scope: Complete data flow, configuration options, transformation capabilities, prompt enrichment patterns
Output: `.prompts/001-external-api-integration-research/external-api-integration-research.md`
</research_objective>

<research_scope>
<include>
**Configuration Layer:**
- All configuration parameters (EXTERNAL_API_ENABLED, URL, METHOD, HEADERS, BODY, TIMEOUT, TRANSFORM)
- How configuration is loaded and validated in `config/config.js`
- Environment variable to config object mapping

**Service Layer:**
- `externalApiService.js` architecture and data flow
- Request construction (axios options)
- Transform function execution via `new Function()`
- Error handling and fallback behavior

**Integration Layer:**
- How external data is fetched in `routes/setup.js` during document processing
- How `options.externalApiData` is passed to AI services
- How each AI service (ollama, openai, custom, azure) incorporates external data

**Prompt Enrichment:**
- Exact location where external data is appended to system prompts
- Token considerations for external data
- Validation and truncation of external API data

**Use Cases:**
- What kinds of external APIs could enrich document analysis?
- How transform functions can reshape data for prompts?
- How this affects prompt engineering strategy?
</include>

<exclude>
- UI/frontend implementation details (settings.ejs forms)
- Non-external-API features of the application
- Implementation of other AI providers beyond their external data handling
</exclude>

<sources>
**Primary codebase files to analyze:**
- @config/config.js - Configuration loading
- @services/externalApiService.js - Core service implementation
- @routes/setup.js - Integration point (lines ~1583-1593)
- @services/ollamaService.js - Prompt enrichment (lines ~445-446)
- @services/openaiService.js - Prompt enrichment patterns
- @services/customService.js - Prompt enrichment patterns
- @services/azureService.js - Prompt enrichment patterns

**No external web search needed - this is purely codebase research.**
</sources>
</research_scope>

<verification_checklist>
□ Document ALL configuration parameters with their defaults and types
□ Trace the complete data flow from config → fetch → transform → prompt
□ Identify ALL AI services that support external API data
□ Document the exact prompt enrichment pattern used
□ Verify error handling at each stage (config parse, fetch, transform)
□ Identify token/size limitations for external data
□ Document the transform function security model (new Function())
</verification_checklist>

<research_quality_assurance>
Before completing research, perform these checks:

<completeness_check>
- [ ] All configuration parameters documented with defaults
- [ ] Complete data flow traced with code references
- [ ] All AI service integration points identified
- [ ] Prompt enrichment pattern documented with exact code
</completeness_check>

<source_verification>
- [ ] All findings backed by specific file:line references
- [ ] Code snippets included for critical behaviors
- [ ] No assumptions without code evidence
</source_verification>

<blind_spots_review>
Ask yourself: "What might I have missed?"
- [ ] Are there edge cases in the transform function execution?
- [ ] Are there validation steps I didn't notice?
- [ ] How does this interact with token limits?
</blind_spots_review>
</research_quality_assurance>

<output_structure>
Save to: `.prompts/001-external-api-integration-research/external-api-integration-research.md`

Structure findings using this XML format:

```xml
<research>
  <summary>
    {2-3 paragraph executive summary of key findings about how External API Integration works}
  </summary>

  <findings>
    <finding category="configuration">
      <title>{Finding title}</title>
      <detail>{Detailed explanation with code references}</detail>
      <source>{file:line references}</source>
      <relevance>{Why this matters for prompt strategy}</relevance>
    </finding>

    <finding category="data-flow">
      ...
    </finding>

    <finding category="prompt-enrichment">
      ...
    </finding>

    <!-- Additional findings by category -->
  </findings>

  <recommendations>
    <recommendation priority="high">
      <action>{How to leverage external API for prompt 002}</action>
      <rationale>{Why}</rationale>
    </recommendation>
    <!-- Additional recommendations -->
  </recommendations>

  <code_examples>
    <!-- Key code patterns discovered -->
    <example name="transform-function-pattern">
      ```javascript
      // Example of how transform functions work
      ```
    </example>

    <example name="prompt-enrichment-pattern">
      ```javascript
      // How external data is appended to prompts
      ```
    </example>
  </code_examples>

  <metadata>
    <confidence level="{high|medium|low}">
      {Why this confidence level}
    </confidence>
    <dependencies>
      {What's needed to act on this research}
    </dependencies>
    <open_questions>
      {What couldn't be determined}
    </open_questions>
    <assumptions>
      {What was assumed}
    </assumptions>

    <quality_report>
      <sources_consulted>
        {List of files analyzed with line ranges}
      </sources_consulted>
      <claims_verified>
        {Key findings verified with code references}
      </claims_verified>
      <claims_assumed>
        {Findings based on inference}
      </claims_assumed>
    </quality_report>
  </metadata>
</research>
```
</output_structure>

<summary_requirements>
Also create `.prompts/001-external-api-integration-research/SUMMARY.md` with:

```markdown
# External API Integration Research Summary

**{Substantive one-liner describing how the feature works}**

## Version
v1

## Key Findings
- {Most important architectural insight}
- {Key prompt enrichment pattern}
- {Strategic implication for prompt 002}

## Decisions Needed
{Any decisions required before prompt 002 can proceed}

## Blockers
None or {specific blockers}

## Next Step
Create prompt 002 with external API integration strategy

---
*Confidence: High*
*Full output: external-api-integration-research.md*
```
</summary_requirements>

<incremental_output>
**CRITICAL: Write findings incrementally to prevent token limit failures**

1. Create the output file with initial XML structure
2. Write each finding as you analyze each file
3. Append code examples as you discover key patterns
4. Update metadata at the end

This ensures all work is saved even if execution hits token limits.
</incremental_output>

<success_criteria>
- All configuration parameters documented with defaults
- Complete data flow traced from env → config → service → prompt
- All 4 AI services' external data handling documented
- Exact prompt enrichment code pattern captured
- Transform function capability and limitations understood
- Clear recommendations for prompt 002 strategy
- SUMMARY.md created with substantive one-liner
</success_criteria>
