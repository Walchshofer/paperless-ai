# Multi-Model Routing for Specialized Document Analysis

## Objective

Implement intelligent model routing in Paperless-AI to use specialized Ollama models based on document type:
- **Medical Model**: For doctor letters, lab reports, hospital documents
- **Financial Model**: For invoices, receipts, tax documents
- **General Model**: For everything else

## Current Architecture

The service currently uses a single model defined by `OLLAMA_MODEL` environment variable in `services/ollamaService.js`.

## Required Changes

### 1. Environment Configuration

Add to `docker-compose.env`:

```env
# Multi-Model Configuration
OLLAMA_MODEL_DEFAULT=gpt-oss:latest
OLLAMA_MODEL_MEDICAL=meditron:7b
OLLAMA_MODEL_FINANCIAL=finance-llm:13b

# Enable multi-model routing
ENABLE_MULTI_MODEL_ROUTING=yes

# Document type detection keywords (comma-separated)
MEDICAL_KEYWORDS=arzt,labor,krankenhaus,befund,diagnose,patient,rezept,doctor,hospital,lab,diagnosis
FINANCIAL_KEYWORDS=rechnung,invoice,steuer,finanzamt,bank,konto,zahlung,payment,tax,account
```

### 2. Code Implementation

Modify `services/ollamaService.js`:

#### A. Add Model Selection Logic

```javascript
class OllamaService {
    constructor() {
        this.apiUrl = config.ollama.apiUrl;

        // Multi-model configuration
        this.models = {
            default: process.env.OLLAMA_MODEL_DEFAULT || process.env.OLLAMA_MODEL || 'gpt-oss:latest',
            medical: process.env.OLLAMA_MODEL_MEDICAL || null,
            financial: process.env.OLLAMA_MODEL_FINANCIAL || null
        };

        this.multiModelEnabled = process.env.ENABLE_MULTI_MODEL_ROUTING === 'yes';

        // Keywords for document classification
        this.medicalKeywords = (process.env.MEDICAL_KEYWORDS || '').toLowerCase().split(',').map(k => k.trim());
        this.financialKeywords = (process.env.FINANCIAL_KEYWORDS || '').toLowerCase().split(',').map(k => k.trim());

        console.log('[INFO] Ollama Service initialized with models:', this.models);
        console.log('[INFO] Multi-model routing:', this.multiModelEnabled ? 'ENABLED' : 'DISABLED');

        // ... rest of constructor
    }

    /**
     * Detect document category based on content
     */
    _detectDocumentCategory(content) {
        if (!this.multiModelEnabled) return 'default';

        const contentLower = content.toLowerCase();

        // Count keyword matches
        const medicalMatches = this.medicalKeywords.filter(kw => contentLower.includes(kw)).length;
        const financialMatches = this.financialKeywords.filter(kw => contentLower.includes(kw)).length;

        console.log(`[DEBUG] Document classification - Medical: ${medicalMatches}, Financial: ${financialMatches}`);

        // Require at least 2 keyword matches to classify as specialized
        if (medicalMatches >= 2 && medicalMatches > financialMatches && this.models.medical) {
            return 'medical';
        }

        if (financialMatches >= 2 && financialMatches > medicalMatches && this.models.financial) {
            return 'financial';
        }

        return 'default';
    }

    /**
     * Get appropriate model for document category
     */
    _getModelForCategory(category) {
        const model = this.models[category] || this.models.default;
        console.log(`[INFO] Using ${category} model: ${model}`);
        return model;
    }

    async analyzeDocument(content, existingTags = [], existingCorrespondentList = [], existingDocumentTypesList = [], id, customPrompt = null, options = {}) {
        const startTime = Date.now();
        try {
            console.log(`[DEBUG] Starting document analysis for ID: ${id}`);

            // 1. Detect document category
            const category = this._detectDocumentCategory(content);
            const selectedModel = this._getModelForCategory(category);

            // 2. Use category-specific model temporarily
            const originalModel = this.model;
            this.model = selectedModel;

            // ... rest of analyzeDocument logic ...

            // 3. Calculate Context (adjust for model-specific limits)
            const promptTokenCount = calculateTokens(prompt);
            const expectedResponseTokens = 512;
            const numCtx = this._calculateNumCtx(promptTokenCount, expectedResponseTokens, selectedModel);

            console.log(`[DEBUG] Category: ${category}, Model: ${selectedModel}, Tokens: ${promptTokenCount}, Context: ${numCtx}`);

            // 4. Call API with selected model
            const response = await this._callOllamaAPI(prompt, systemPrompt, numCtx, this.documentAnalysisSchema);

            // 5. Restore original model
            this.model = originalModel;

            // ... rest of processing ...

        } catch (error) {
            console.error(`[ERROR] Analysis failed: ${error.message}`);
            return {
                document: { tags: [], correspondent: null },
                metrics: null,
                error: error.message
            };
        }
    }

    _calculateNumCtx(promptTokenCount, responseTokens, modelName = null) {
        const total = promptTokenCount + responseTokens;
        const maxLimit = parseInt(process.env.TOKEN_LIMIT || '16384', 10);

        // Model-specific context limits
        let modelLimit = maxLimit;
        if (modelName) {
            if (modelName.includes('meditron') || modelName.includes('medalpaca')) {
                modelLimit = 4096;  // Medical models often have smaller context
            } else if (modelName.includes('finance')) {
                modelLimit = 8192;  // Financial models
            }
        }

        const actualLimit = Math.min(maxLimit, modelLimit);
        const factor = modelName && modelName.includes('gpt-oss') ? 0.90 : 0.80;
        const safeLimit = Math.floor(actualLimit * factor);

        return Math.min(total, safeLimit);
    }
}
```

### 3. Category-Specific System Prompts

Add specialized prompts for each category:

```javascript
_generateSystemPrompt(customFieldsStr, category = 'default') {
    let basePrompt = '';

    if (category === 'medical') {
        basePrompt = `
You are a specialized medical document analyzer with expertise in German medical terminology.
Your task is to extract information from medical documents including:
- Doctor's letters (Arztbriefe)
- Laboratory reports (Laborbefunde)
- Hospital discharge summaries (Entlassungsbriefe)
- Prescriptions (Rezepte)
- Diagnostic reports (Befunde)

Pay special attention to:
- Medical terminology and diagnoses
- Medication names and dosages
- Date of treatment/examination
- Healthcare provider names (doctors, hospitals, labs)

IMPORTANT: All tags and titles must be in German.
        `;
    } else if (category === 'financial') {
        basePrompt = `
You are a specialized financial document analyzer with expertise in German financial documents.
Your task is to extract information from financial documents including:
- Invoices (Rechnungen)
- Receipts (Quittungen)
- Bank statements (Kontoauszüge)
- Tax documents (Steuerdokumente)
- Insurance documents (Versicherungsunterlagen)

Pay special attention to:
- Amounts and currency
- Invoice/document numbers
- Payment dates and due dates
- VAT/tax information
- Account numbers

IMPORTANT: All tags and titles must be in German.
        `;
    }

    basePrompt += `
You do not ask back questions.
YOU MUSTNOT: Ask for additional information or clarification.
YOU MUST: Return the result EXCLUSIVELY as a JSON object.

{
    "title": "xxxxx",
    "correspondent": "xxxxxxxx",
    "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
    "document_type": "Invoice/Contract/Befund/...",
    "document_date": "YYYY-MM-DD",
    "language": "de",
    ${customFieldsStr}
}
ALWAYS USE THE INFORMATION TO FILL OUT THE JSON OBJECT.
    `;

    return basePrompt;
}
```

### 4. Testing Strategy

1. **Test with sample documents**:
   - Medical: "Befund vom Labor XYZ. Patient: Max Mustermann. Diagnose: ..."
   - Financial: "Rechnung Nr. 12345. Betrag: 150 EUR. Zahlbar bis: ..."
   - General: "Produktbeschreibung Standtrockner"

2. **Monitor logs for model selection**:
   ```bash
   docker compose logs -f paperless-ai | grep "Using .* model"
   ```

3. **Verify correct model is used**:
   - Medical keywords → medical model
   - Financial keywords → financial model
   - Neither → default model

### 5. Success Criteria

- ✅ Medical documents correctly routed to medical model
- ✅ Financial documents correctly routed to financial model
- ✅ General documents use default model
- ✅ Each model respects its context window limits
- ✅ Specialized prompts improve extraction accuracy
- ✅ Fallback to default model if specialized model fails

### 6. Optional Enhancements

**A. Machine Learning Classification**
- Use a lightweight classifier to detect document type before content analysis
- More accurate than keyword matching

**B. Model Performance Tracking**
- Log which model was used for each document
- Track success rates per model
- A/B test model performance

**C. User-Configurable Routing**
- Allow users to define custom categories and keywords via UI
- Map document types to specific models

**D. Model Caching**
- Keep multiple models loaded in VRAM if GPU has capacity
- Reduce model loading time for mixed document batches

## Implementation Notes

- Start with keyword-based classification (simple, works well)
- Monitor classification accuracy and adjust keywords
- Consider ML classification if keyword approach is insufficient
- Ensure all models are compatible with the refactored `ollamaService.js`
- Test with real documents from your use case

## Resource Requirements

- **24GB VRAM (RTX 3090 Ti)** can handle:
  - 1x 20B model (14GB) + 1x 7B model (4-5GB) simultaneously
  - OR rotate between models (unload/load as needed)
  - Rotating is slower but uses less VRAM

## Example Configuration

```env
# For simultaneous loading (if VRAM permits)
OLLAMA_MODEL_DEFAULT=gpt-oss:latest      # 14GB
OLLAMA_MODEL_MEDICAL=meditron:7b         # 4GB
OLLAMA_MODEL_FINANCIAL=mistral:7b        # 4GB
# Total: ~22GB (fits in 24GB)

# For rotating (more models, less VRAM usage)
OLLAMA_MODEL_DEFAULT=gpt-oss:latest
OLLAMA_MODEL_MEDICAL=medalpaca:13b       # Load on demand
OLLAMA_MODEL_FINANCIAL=finance-llm:13b   # Load on demand
```
