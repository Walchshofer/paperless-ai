<research>
  <summary>
    The External API Integration feature in paperless-ai enables enrichment of AI document analysis prompts with data fetched from configurable external HTTP endpoints. The feature follows a clean architecture: configuration is loaded from environment variables through config/config.js, the externalApiService.js handles HTTP requests with optional data transformation via dynamic function execution, and the integration occurs in routes/setup.js during document processing. All four AI services (Ollama, OpenAI, Custom, Azure) support external data through a consistent pattern that appends validated/truncated data to the system prompt with a fixed 500-token limit. The transform function uses `new Function()` which has security implications but provides powerful data reshaping capabilities. Error handling is defensive throughout - failures at any stage result in graceful degradation (null data) rather than processing failures.
  </summary>

  <findings>
    <finding category="configuration">
      <title>External API Configuration Parameters</title>
      <detail>
        The external API feature is controlled by 7 configuration parameters loaded from environment variables:

        1. EXTERNAL_API_ENABLED (string: 'yes'/'no', default: 'no') - Master toggle for the feature
        2. EXTERNAL_API_URL (string, default: '') - The HTTP endpoint to call
        3. EXTERNAL_API_METHOD (string, default: 'GET') - HTTP method (GET/POST/PUT supported)
        4. EXTERNAL_API_HEADERS (string JSON, default: '{}') - HTTP headers as JSON string
        5. EXTERNAL_API_BODY (string JSON, default: '{}') - Request body for POST/PUT as JSON string
        6. EXTERNAL_API_TIMEOUT (number, default: 5000) - Request timeout in milliseconds
        7. EXTERNAL_API_TRANSFORM (string, default: '') - JavaScript code for data transformation

        These are parsed in config/config.js into the `externalApiConfig` object which is exported as part of the main config module.
      </detail>
      <source>config/config.js:36-44</source>
      <relevance>HIGH - Understanding configuration is essential for prompt strategy that uses external data</relevance>
    </finding>

    <finding category="configuration">
      <title>Configuration Loading Pattern</title>
      <detail>
        Configuration uses parseEnvBoolean() helper for the enabled flag, which accepts 'true', '1', or 'yes' as truthy values. The config object structure is:

        ```javascript
        const externalApiConfig = {
          enabled: parseEnvBoolean(process.env.EXTERNAL_API_ENABLED, 'no'),
          url: process.env.EXTERNAL_API_URL || '',
          method: process.env.EXTERNAL_API_METHOD || 'GET',
          headers: process.env.EXTERNAL_API_HEADERS || '{}',
          body: process.env.EXTERNAL_API_BODY || '{}',
          timeout: parseInt(process.env.EXTERNAL_API_TIMEOUT || '5000', 10),
          transformationTemplate: process.env.EXTERNAL_API_TRANSFORM || ''
        };
        ```

        Note: The config uses `transformationTemplate` but the service reads `transform` from the config - this is a potential naming inconsistency (the service destructures with `transform` but the config stores `transformationTemplate`).
      </detail>
      <source>config/config.js:36-44</source>
      <relevance>MEDIUM - Naming inconsistency could cause issues; config structure informs how to set up external APIs</relevance>
    </finding>

    <finding category="data-flow">
      <title>Complete Data Flow: Config to Service to Prompt</title>
      <detail>
        The external API data flow follows these stages:

        1. **Configuration Load** (config/config.js): Environment variables parsed into externalApiConfig object at startup

        2. **Trigger Point** (routes/setup.js:1583-1593): During document processing, if `config.externalApiConfig.enabled === 'yes'`, the externalApiService.fetchData() is called

        3. **Service Fetch** (externalApiService.js:12-95):
           - Validates enabled status and URL presence
           - Parses JSON headers/body if strings
           - Constructs axios request options
           - Executes HTTP request with timeout
           - Applies transform function if provided
           - Returns data or null on error

        4. **Options Passing** (routes/setup.js:1589): Data stored as `options.externalApiData`

        5. **AI Service Integration** (all services): Each AI service's analyzeDocument() receives options, validates/truncates external data, appends to system prompt
      </detail>
      <source>routes/setup.js:1583-1593, services/externalApiService.js:12-95</source>
      <relevance>HIGH - Understanding the complete flow is critical for designing prompts that leverage external data</relevance>
    </finding>

    <finding category="data-flow">
      <title>Integration Point in Document Processing</title>
      <detail>
        The external API data is fetched in routes/setup.js during the main document processing workflow:

        ```javascript
        // Get external API data if enabled
        if (config.externalApiConfig.enabled === 'yes') {
          try {
            const externalApiService = require('../services/externalApiService');
            const externalData = await externalApiService.fetchData();
            if (externalData) {
              options.externalApiData = externalData;
              console.log('[DEBUG] Retrieved external API data for prompt enrichment');
            }
          } catch (error) {
            console.error('[ERROR] Failed to fetch external API data:', error.message);
          }
        }
        ```

        The data is fetched once per document processing cycle and passed to whichever AI service is configured.
      </detail>
      <source>routes/setup.js:1583-1593</source>
      <relevance>HIGH - Shows where external data enters the processing pipeline</relevance>
    </finding>

    <finding category="transform-function">
      <title>Transform Function Execution via new Function()</title>
      <detail>
        The transform functionality uses JavaScript's `new Function()` constructor to create a dynamic function:

        ```javascript
        if (transform && typeof transform === 'string') {
          try {
            // Create a safe transform function
            const transformFn = new Function('data', transform);
            data = transformFn(data);
            console.log('[DEBUG] Successfully transformed external API data');
          } catch (error) {
            console.error('[ERROR] Failed to execute transform function:', error.message);
          }
        }
        ```

        The transform receives the raw API response as `data` parameter and should return the transformed result. Example transform code:
        - `return data.results[0]` - Extract first result
        - `return { context: data.summary, metadata: data.meta }` - Reshape data
        - `return data.filter(item => item.relevant).map(item => item.text).join('\n')` - Filter and format

        SECURITY NOTE: new Function() is similar to eval() and executes arbitrary code. The comment says "safe" but this is NOT sandboxed - it runs with full Node.js privileges. This is a security concern if untrusted users can configure transforms.
      </detail>
      <source>services/externalApiService.js:76-85</source>
      <relevance>HIGH - Transform capability is powerful for reshaping data but has security implications</relevance>
    </finding>

    <finding category="transform-function">
      <title>Transform Function Input/Output Contract</title>
      <detail>
        The transform function has a simple contract:

        - INPUT: `data` - The raw response.data from axios (could be object, array, or primitive depending on API)
        - OUTPUT: Should return the transformed data (any type - will be stringified later if object)

        The function body is the entire EXTERNAL_API_TRANSFORM value. For example:
        - Simple: `return data.message`
        - Complex: `const filtered = data.items.filter(i => i.active); return filtered.map(i => i.name).join(', ');`

        If transform throws an error, the original data is preserved (not null) - the error is logged but processing continues with untransformed data.
      </detail>
      <source>services/externalApiService.js:76-85</source>
      <relevance>MEDIUM - Understanding the contract helps design effective transforms</relevance>
    </finding>

    <finding category="prompt-enrichment">
      <title>Universal Prompt Enrichment Pattern Across All AI Services</title>
      <detail>
        All four AI services use an IDENTICAL pattern for incorporating external API data into prompts:

        ```javascript
        // Include validated external API data if available
        if (validatedExternalApiData) {
          systemPrompt += `\n\nAdditional context from external API:\n${validatedExternalApiData}`;
        }
        ```

        This pattern:
        1. Appends to the END of the system prompt (after all other prompt construction)
        2. Uses a consistent header: "Additional context from external API:"
        3. Inserts the data as-is (already validated/truncated)

        This is found in:
        - ollamaService.js:445-447
        - openaiService.js:137-139
        - customService.js:128-130
        - azureService.js:128-130
      </detail>
      <source>services/ollamaService.js:445-447, services/openaiService.js:137-139</source>
      <relevance>HIGH - This is THE key pattern for how external data enriches prompts</relevance>
    </finding>

    <finding category="prompt-enrichment">
      <title>External Data Validation and Token Limiting</title>
      <detail>
        All AI services implement a `_validateAndTruncateExternalApiData()` method with consistent behavior:

        ```javascript
        async _validateAndTruncateExternalApiData(apiData, maxTokens = 500) {
          if (!apiData) return null;

          const dataString = typeof apiData === 'object'
            ? JSON.stringify(apiData, null, 2)
            : String(apiData);

          const dataTokens = await calculateTokens(dataString, model);

          if (dataTokens > maxTokens) {
            console.warn(`[WARNING] External API data (${dataTokens} tokens) exceeds limit (${maxTokens}), truncating`);
            return await truncateToTokenLimit(dataString, maxTokens, model);
          }

          return dataString;
        }
        ```

        Key characteristics:
        - DEFAULT LIMIT: 500 tokens for external data
        - Objects are JSON.stringify'd with pretty printing (2-space indent)
        - Primitives are String() converted
        - Truncation uses the service's standard truncation utility
        - The 500 token limit is HARDCODED - not configurable
      </detail>
      <source>services/ollamaService.js:306-322, services/openaiService.js:247-266</source>
      <relevance>HIGH - Token limit constrains what external data can be included</relevance>
    </finding>

    <finding category="prompt-enrichment">
      <title>Prompt Enrichment Position in System Prompt</title>
      <detail>
        External API data is appended AFTER:
        1. Pre-existing tags/correspondents/document types (if useExistingData='yes')
        2. SYSTEM_PROMPT environment variable content
        3. mustHavePrompt JSON schema template
        4. RestrictionPromptService placeholder processing

        But BEFORE:
        - USE_PROMPT_TAGS override (which replaces the entire system prompt)
        - Custom prompt override from webhooks

        The ordering means external data is part of the "base" system prompt that can be completely overridden by USE_PROMPT_TAGS or customPrompt options.
      </detail>
      <source>services/openaiService.js:115-151</source>
      <relevance>MEDIUM - Prompt position affects how AI interprets the context</relevance>
    </finding>

    <finding category="error-handling">
      <title>Error Handling at Configuration Parse Stage</title>
      <detail>
        JSON parsing of headers and body has defensive error handling:

        ```javascript
        let parsedHeaders = headers;
        if (typeof headers === 'string') {
          try {
            parsedHeaders = JSON.parse(headers);
          } catch (error) {
            console.error('[ERROR] Failed to parse external API headers:', error.message);
            parsedHeaders = {};
          }
        }
        ```

        Invalid JSON falls back to empty object {} rather than failing. Same pattern for body.
      </detail>
      <source>services/externalApiService.js:37-56</source>
      <relevance>MEDIUM - Shows graceful degradation on config errors</relevance>
    </finding>

    <finding category="error-handling">
      <title>Error Handling at Fetch Stage</title>
      <detail>
        The fetchData() method has comprehensive error handling:

        ```javascript
        } catch (error) {
          console.error('[ERROR] Failed to fetch data from external API:', error.message);
          if (error.response) {
            console.error('[ERROR] API Response:', error.response.status, error.response.data);
          }
          return null;
        }
        ```

        Failures return null, not errors. This means document processing continues without external data enrichment. HTTP errors include status code and response body in logs.
      </detail>
      <source>services/externalApiService.js:88-94</source>
      <relevance>MEDIUM - Fetch failures don't break document processing</relevance>
    </finding>

    <finding category="error-handling">
      <title>Error Handling at Integration Stage</title>
      <detail>
        The routes/setup.js integration point also wraps in try/catch:

        ```javascript
        try {
          const externalApiService = require('../services/externalApiService');
          const externalData = await externalApiService.fetchData();
          if (externalData) {
            options.externalApiData = externalData;
          }
        } catch (error) {
          console.error('[ERROR] Failed to fetch external API data:', error.message);
        }
        ```

        Double protection - even if service throws, processing continues.
      </detail>
      <source>routes/setup.js:1585-1593</source>
      <relevance>MEDIUM - Multiple error handling layers ensure robustness</relevance>
    </finding>

    <finding category="error-handling">
      <title>Error Handling at AI Service Stage</title>
      <detail>
        Each AI service validates external data before use:

        ```javascript
        if (externalApiData) {
          try {
            validatedExternalApiData = await this._validateAndTruncateExternalApiData(externalApiData);
            console.log('[DEBUG] External API data validated and included');
          } catch (error) {
            console.warn('[WARNING] External API data validation failed:', error.message);
            validatedExternalApiData = null;
          }
        }
        ```

        Validation failures result in null (no external data) rather than analysis failure.
      </detail>
      <source>services/openaiService.js:75-83</source>
      <relevance>MEDIUM - Four-layer error handling provides maximum resilience</relevance>
    </finding>

    <finding category="use-cases">
      <title>Potential Use Cases for External API Enrichment</title>
      <detail>
        The external API feature can enrich document analysis with:

        1. **CRM/ERP Integration**: Fetch customer/vendor data based on known identifiers
           - Example: GET https://crm.example.com/api/contacts?email=${detected_email}

        2. **Document Classification Services**: Pre-classify documents before AI analysis
           - Example: POST to a classification microservice, use result to guide tagging

        3. **Knowledge Base Lookup**: Fetch relevant context from internal wikis/databases
           - Example: GET https://kb.example.com/api/search?q=invoice+processing

        4. **Business Rules Engine**: Fetch dynamic classification rules
           - Example: GET https://rules.example.com/api/document-rules

        5. **External AI Pre-processing**: Chain AI calls (e.g., OCR enhancement, entity extraction)
           - Example: POST document to entity extraction API, use entities in main prompt

        6. **Real-time Data Enrichment**: Stock prices, exchange rates for financial documents
           - Example: GET https://api.exchangerate.host/latest?base=EUR

        The 500-token limit constrains the amount of external context, so responses should be concise or transformed appropriately.
      </detail>
      <source>Analysis based on architecture</source>
      <relevance>HIGH - Informs prompt 002 strategy for leveraging this feature</relevance>
    </finding>

    <finding category="use-cases">
      <title>Transform Function Use Cases</title>
      <detail>
        The transform function enables reshaping external API responses:

        1. **Extract nested data**: `return data.response.results[0].text`

        2. **Filter arrays**: `return data.items.filter(i => i.score > 0.8)`

        3. **Combine fields**: `return data.firstName + ' ' + data.lastName`

        4. **Format for prompt**:
           ```javascript
           return 'Customer: ' + data.name + '\nAccount: ' + data.accountId + '\nStatus: ' + data.status
           ```

        5. **Summarize arrays**:
           ```javascript
           return data.results.map(r => '- ' + r.title).join('\n')
           ```

        6. **Conditional extraction**:
           ```javascript
           return data.type === 'invoice' ? data.invoiceDetails : data.generalInfo
           ```

        The transform runs BEFORE the 500-token validation, so it's useful for reducing data size.
      </detail>
      <source>Analysis based on services/externalApiService.js:76-85</source>
      <relevance>HIGH - Transform capability enables flexible data shaping for prompts</relevance>
    </finding>

    <finding category="configuration">
      <title>Potential Configuration Bug: transformationTemplate vs transform</title>
      <detail>
        There's a naming mismatch between config and service:

        In config/config.js:43:
        ```javascript
        transformationTemplate: process.env.EXTERNAL_API_TRANSFORM || ''
        ```

        In externalApiService.js:26:
        ```javascript
        const { url, method, headers, body, timeout, transform } = config.externalApiConfig;
        ```

        The service destructures `transform` but config stores `transformationTemplate`. This means transforms may not work as expected - the `transform` variable would be undefined.

        This appears to be a BUG that would prevent transform functions from executing.
      </detail>
      <source>config/config.js:43, services/externalApiService.js:26</source>
      <relevance>HIGH - This bug means transforms may not work; needs verification</relevance>
    </finding>
  </findings>

  <recommendations>
    <recommendation priority="1">
      <title>Verify Transform Function Bug Before Relying on Transforms</title>
      <detail>
        The config uses `transformationTemplate` but service expects `transform`. Before designing prompts that rely on transforms, verify this works or fix the naming mismatch. Test with a simple transform like `return data` to confirm execution.
      </detail>
    </recommendation>

    <recommendation priority="2">
      <title>Design External APIs for 500-Token Output</title>
      <detail>
        The hardcoded 500-token limit means external APIs should return concise data or use transforms to reduce size. For prompt 002 strategy:
        - Design API responses to be prompt-ready (not raw database dumps)
        - Use transforms to extract only relevant fields
        - Consider returning pre-formatted text rather than JSON structures
      </detail>
    </recommendation>

    <recommendation priority="3">
      <title>Leverage the "Additional context from external API:" Header</title>
      <detail>
        External data is always prefixed with "Additional context from external API:" in the system prompt. Design your SYSTEM_PROMPT to reference this context explicitly. For example:

        "When analyzing documents, consider the Additional context from external API section for customer-specific information that should influence tagging and classification."
      </detail>
    </recommendation>

    <recommendation priority="4">
      <title>Consider Transform for Prompt Formatting</title>
      <detail>
        Rather than returning raw JSON from external APIs, use transforms to format data as natural language:

        Instead of: `{"customer":"Acme","status":"VIP"}`
        Transform to: `This document is from VIP customer Acme.`

        Natural language integrates better with AI prompts than structured data.
      </detail>
    </recommendation>

    <recommendation priority="5">
      <title>Account for External API Latency</title>
      <detail>
        External API calls add latency to document processing. The default 5000ms timeout means processing could be delayed. For prompt 002 strategy:
        - Consider caching external data where appropriate
        - Use fast APIs or local services when possible
        - Monitor timeout impacts on processing throughput
      </detail>
    </recommendation>

    <recommendation priority="6">
      <title>Security Review for Transform Functions</title>
      <detail>
        The `new Function()` approach executes arbitrary code. If users can configure transforms through the UI, this is a security risk. For prompt 002 strategy:
        - If transforms are admin-only, document the security implications
        - Consider predefined transform templates instead of arbitrary code
        - Never expose transform configuration to untrusted users
      </detail>
    </recommendation>
  </recommendations>

  <code_examples>
    <example name="Basic External API Configuration">
      <description>Environment variables for a simple GET API</description>
      <code>
EXTERNAL_API_ENABLED=yes
EXTERNAL_API_URL=https://api.example.com/context
EXTERNAL_API_METHOD=GET
EXTERNAL_API_HEADERS={"Authorization": "Bearer token123"}
EXTERNAL_API_TIMEOUT=3000
      </code>
    </example>

    <example name="POST API with Body">
      <description>Configuration for a POST endpoint</description>
      <code>
EXTERNAL_API_ENABLED=yes
EXTERNAL_API_URL=https://api.example.com/enrich
EXTERNAL_API_METHOD=POST
EXTERNAL_API_HEADERS={"Content-Type": "application/json", "Authorization": "Bearer token"}
EXTERNAL_API_BODY={"source": "paperless", "requestType": "documentContext"}
EXTERNAL_API_TIMEOUT=5000
      </code>
    </example>

    <example name="Transform Function - Extract Field">
      <description>Extract a specific field from API response</description>
      <code>
EXTERNAL_API_TRANSFORM=return data.context.summary
      </code>
    </example>

    <example name="Transform Function - Format for Prompt">
      <description>Format API data as prompt-friendly text</description>
      <code>
EXTERNAL_API_TRANSFORM=return 'Customer: ' + data.customer.name + ' (ID: ' + data.customer.id + ')\nAccount Status: ' + data.customer.status + '\nRecent Orders: ' + data.recentOrders.length
      </code>
    </example>

    <example name="Transform Function - Filter and Join">
      <description>Filter array and join results</description>
      <code>
EXTERNAL_API_TRANSFORM=return data.suggestions.filter(s => s.confidence > 0.7).map(s => s.tag).join(', ')
      </code>
    </example>

    <example name="Prompt Enrichment Pattern (from services)">
      <description>How external data is added to system prompt</description>
      <code>
// Include validated external API data if available
if (validatedExternalApiData) {
  systemPrompt += `\n\nAdditional context from external API:\n${validatedExternalApiData}`;
}
      </code>
    </example>

    <example name="Validation and Truncation Pattern">
      <description>How external data is validated in AI services</description>
      <code>
async _validateAndTruncateExternalApiData(apiData, maxTokens = 500) {
  if (!apiData) return null;

  const dataString = typeof apiData === 'object'
    ? JSON.stringify(apiData, null, 2)
    : String(apiData);

  const dataTokens = await calculateTokens(dataString, model);

  if (dataTokens > maxTokens) {
    return await truncateToTokenLimit(dataString, maxTokens, model);
  }

  return dataString;
}
      </code>
    </example>
  </code_examples>

  <metadata>
    <confidence>HIGH</confidence>
    <completeness>COMPLETE - All 4 AI services analyzed, full data flow traced</completeness>
    <files_analyzed>
      <file>config/config.js - Configuration loading and defaults</file>
      <file>services/externalApiService.js - Core fetch and transform logic</file>
      <file>routes/setup.js - Integration point in document processing</file>
      <file>services/ollamaService.js - Ollama prompt enrichment</file>
      <file>services/openaiService.js - OpenAI prompt enrichment</file>
      <file>services/customService.js - Custom OpenAI prompt enrichment</file>
      <file>services/azureService.js - Azure OpenAI prompt enrichment</file>
    </files_analyzed>
    <dependencies>
      <dependency>axios - HTTP client for external requests</dependency>
      <dependency>serviceUtils - Token calculation and truncation utilities</dependency>
    </dependencies>
    <known_issues>
      <issue severity="HIGH">Transform may not work due to config property naming mismatch (transformationTemplate vs transform)</issue>
      <issue severity="MEDIUM">500-token limit is hardcoded, not configurable</issue>
      <issue severity="LOW">new Function() has security implications</issue>
    </known_issues>
    <version_analyzed>3.0.9</version_analyzed>
    <date>2025-12-19</date>
  </metadata>
</research>
