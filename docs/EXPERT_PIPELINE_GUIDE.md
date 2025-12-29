# Expert Model Pipeline Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage Guide](#usage-guide)
6. [Pipeline Reference](#pipeline-reference)
7. [Extending the System](#extending-the-system)
8. [Troubleshooting](#troubleshooting)
9. [Performance Tuning](#performance-tuning)
10. [API Reference](#api-reference)

---

## Overview

The Expert Model Pipeline is a domain-specialized document processing system designed for the paperless-ngx AI assistant. It routes documents to specialized AI models based on content classification, enabling superior extraction accuracy for domain-specific documents like medical records.

### Key Features

- **Intelligent Routing**: Multimodal classifier determines optimal processing pipeline
- **Domain Specialization**: Medical, financial, legal, and general document experts
- **Hybrid Processing**: Combines expert pipeline with legacy fallback
- **Confidence Tracking**: Full transparency into extraction reliability
- **Extensible Design**: Easy addition of new domains and prompts

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| GPU | NVIDIA RTX 3080 (10GB) | NVIDIA RTX 3090 Ti (24GB) |
| RAM | 32GB | 64GB |
| Storage | 50GB SSD | 100GB NVMe |
| CUDA | 11.8+ | 12.1+ |

### Model Requirements

| Model | Size | Purpose | VRAM Usage |
|-------|------|---------|------------|
| qwen3-vl:8b | ~16GB | Planner (visual) + Router (expert routing) | ~10GB |
| nemotron-orchestrator:8b | ~8GB | System Orchestrator (routing + service gating) | ~6GB |
| llava-med-v1.6 | ~14GB | Medical Imaging | ~9GB |
| medtext-llama3 | ~8GB | Medical Text | ~6GB |
| fino1-8b | ~8GB | Financial Reasoning (math-heavy) | ~6GB |
| llm-pro-finance-8b | ~8GB | Financial Extraction (multilingual) | ~6GB |
| sauerkraut-llama3.1:8b | ~8GB | General Processing (German) | ~6GB |

**Note:** For complete model specifications, aliases, tiers, and configuration, see [`docs/MODEL_INVENTORY.md`](MODEL_INVENTORY.md), [`docs/ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md), and [`docs/MODEL_MIGRATION_GUIDE.md`](MODEL_MIGRATION_GUIDE.md).

---

## Architecture

### Pipeline Flow


┌─────────────────────────────────────────────────────────────────────────────┐
│ DOCUMENT PROCESSING FLOW │
│ │
│ ┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ Document │────▶│ Planner │────▶│ Router │────▶│ Orchestrator │────▶│ Expert │────▶│ Result │ │
│ │ Input │ │ qwen3-vl:8b │ │ qwen3-vl:8b │ │ nemotron │ │ Pipeline │ │ Output │ │
│ └──────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────┘ │
│ │ │ │ │ │ │
│ │ ▼ ▼ ▼ ▼ │
│ │ ┌──────────────┐ ┌──────────────┐ ┌──────────┐ │
│ │ │Classification│ │ Extraction │ │ Paperless│ │
│ │ │ Result │ │ Stages │ │ Format │ │
│ │ └──────────────┘ └──────────────┘ └──────────┘ │
│ │ │
│ ▼ │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ AVAILABLE PIPELINES │ │
│ │ │ │
│ │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │ │
│ │ │ Medical │ │ Medical │ │ Financial │ │ General │ │ │
│ │ │ Imaging │ │ Text │ │ Pipeline │ │ Pipeline │ │ │
│ │ │ llava-med │ │ medtext │ │ sauerkraut │ │ sauerkraut │ │ │
│ │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

Notes:
- Planner uses rendered PNGs at configured DPI for visual classification (`PLANNER_MODEL`).
- Router performs primary domain classification (`ROUTER_MODEL`).
- Orchestrator finalizes pipeline selection and service gating (Guidance/Visual RAG) (`ORCHESTRATOR_MODEL`).


### Component Hierarchy


services/
├── index.js # Service registry and exports
├── prompts/
│ ├── PromptRegistry.js # Prompt management system
│ └── MedicalPrompts.js # Medical domain prompts
├── experts/
│ ├── ExpertRegistry.js # Pipeline definitions
│ └── ExpertPipelineExecutor.js # Execution engine
└── integration/
└── DocumentProcessor.js # Main integration layer

> **Note:** Deprecated root-level implementations `services/ExpertRegistry.js` and `services/ExpertPipelineExecutor.js` have been removed to avoid import shadowing. Use the canonical implementations under `services/experts/`. Reference implementations live in `future_implementations/services/experts/` for documentation and comparison purposes.

yaml

---

## Installation

### Step 1: Install Dependencies

```bash
# Navigate to project root
cd paperless-ai

# Install Node.js dependencies
npm install

# Verify installation
npm test

# Run specific test suites
npm test -- --grep "PromptRegistry"    # Test prompt management
npm test -- --grep "Model Resolution"  # Test model alias system
npm test -- --grep "ExpertPipelineExecutor"  # Test pipeline execution

Step 2: Pull Required Models
bash
# Pull router model (multimodal classifier)
ollama pull qwen3-vl:8b

# Pull medical imaging model
ollama pull llava-med-v1.6:latest

# Pull medical text model (if available, or use alternative)
ollama pull medtext-llama3
# Alternative: ollama pull sauerkraut-llama3.1:8b

# Pull general model
ollama pull sauerkraut-llama3.1:8b

# Verify models
ollama list

Step 3: Configure Environment
bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env

Step 4: Verify Installation
bash
# Run health check
curl http://localhost:3000/api/expert/health

# Expected response:
# {
#   "status": "healthy",
#   "components": {
#     "ollama": { "status": "healthy", "modelsLoaded": 4 },
#     "requiredModels": {
#       "router": true,
#       "medicalImaging": true,
#       "medicalText": true,
#       "general": true
#     }
#   }
# }

Configuration
Environment Variables
bash
# ============================================================================
# OLLAMA CONFIGURATION
# ============================================================================

# Ollama server URL
OLLAMA_HOST=http://localhost:11434

# Model names (customize if using different models)
PLANNER_MODEL=qwen3-vl:8b
ROUTER_MODEL=qwen3-vl:8b
ORCHESTRATOR_MODEL=nemotron-orchestrator:8b
MEDICAL_VISION_MODEL=llava-med-v1.6:latest
MEDICAL_ANALYSIS_MODEL=medtext-llama3
MEDICAL_RADIOLOGY_MODEL=llava-med-v1.6
GENERAL_MODEL=sauerkraut-llama3.1:8b
FINANCIAL_VISION_MODEL=llm-pro-finance-8b
FINANCIAL_ANALYSIS_MODEL=fino1-8b

# ============================================================================
# PROCESSING CONFIGURATION
# ============================================================================

# Processing mode: expert_pipeline | legacy_vision | legacy_text | hybrid
PROCESSING_MODE=hybrid

# Feature flags
ENABLE_EXPERT_PIPELINE=true
ENABLE_MEDICAL_PIPELINE=true
ENABLE_LEGACY_FALLBACK=true
ENABLE_METRICS=true
ENABLE_VAT_RAG=true

# Internal VAT RAG (local-only, not for user display)
VAT_RAG_DIR=./data/austrian_vat
VAT_RAG_MAX_RESULTS=3
VAT_RAG_MAX_EXCERPT_CHARS=800

---

## Configuration Reference

| Category | Config Key | Environment Variable | Default | Description |
|----------|------------|----------------------|---------|-------------|
| **Expert Pipeline** | `expertPipelineEnabled` | `EXPERT_PIPELINE_ENABLED` | `'yes'` | Enable/disable expert pipeline |
| **Medical Models** | `expertModels.medical.vision` | `MEDICAL_VISION_MODEL` | `'qwen3-vl:8b'` | Medical imaging analysis model |
|  | `expertModels.medical.analysis` | `MEDICAL_ANALYSIS_MODEL` | `'medtext-llama3'` | Medical text analysis model |
|  | `expertModels.medical.radiology` | `MEDICAL_RADIOLOGY_MODEL` | `'llava-med-v1.6'` | Radiology imaging model |
| **Financial Models** | `expertModels.financial.vision` | `FINANCIAL_VISION_MODEL` | `'llm-pro-finance-8b'` | Financial document vision model |
|  | `expertModels.financial.analysis` | `FINANCIAL_ANALYSIS_MODEL` | `'fino1-8b'` | Financial analysis model |
| **Legal Models** | `expertModels.legal.vision` | `LEGAL_VISION_MODEL` | `''` | Legal document vision model |
|  | `expertModels.legal.analysis` | `LEGAL_ANALYSIS_MODEL` | `''` | Legal analysis model |
|  | `expertModels.legal.orchestrator` | `LEGAL_ORCHESTRATOR_MODEL` | `ORCHESTRATOR_MODEL` | Legal pipeline orchestrator override |
| **Ollama Service** | `ollama.apiUrl` | `OLLAMA_API_URL` | `'http://localhost:11434'` | Ollama API endpoint |
|  | `ollama.model` | `OLLAMA_MODEL` | `'sauerkraut-llama3.1:8b'` | Default text model |
|  | `ollama.visionModel` | `OLLAMA_VISION_MODEL` | `'qwen3-vl:8b'` | Default vision model |
|  | `ollama.orchestratorModel` | `ORCHESTRATOR_MODEL` | `'nemotron-orchestrator:8b'` | System orchestration model |
|  | `ollama.visionKeepAlive` | `VISION_KEEP_ALIVE` | `'5m'` | Vision model keep-alive duration |
|  | `ollama.textKeepAlive` | `TEXT_KEEP_ALIVE` | `'2m'` | Text model keep-alive duration |

**Note:** Model names support aliases for convenience. See `config.modelAliases` for the complete mapping. For complete environment variable documentation, see [`docs/ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md).

---

*Notes*: This reference focuses on keys relevant to the expert pipeline. For full configuration, see `config/config.js` and the individual `routes/setup.js` defaults.

### Model Ecosystem

This is a summary of the three-tier model architecture. For the authoritative model inventory with all aliases, config keys, and usage locations, refer to [`docs/MODEL_INVENTORY.md`](MODEL_INVENTORY.md). For planned advanced tier integrations, see [`docs/MODEL_INTEGRATION_ROADMAP.md`](MODEL_INTEGRATION_ROADMAP.md).

# ============================================================================
# PERFORMANCE TUNING
# ============================================================================

# Timeout settings (milliseconds)
ROUTER_TIMEOUT=30000
EXTRACTION_TIMEOUT=60000
TOTAL_TIMEOUT=180000

# Retry settings
MAX_RETRIES=2
RETRY_DELAY=1000

# Confidence thresholds
ROUTER_CONFIDENCE_THRESHOLD=0.6
EXTRACTION_CONFIDENCE_THRESHOLD=0.7
FALLBACK_TRIGGER_THRESHOLD=0.5

Configuration Object
javascript
const config = {
    models: {
        router: 'qwen3-vl:8b',
        orchestrator: 'nemotron-orchestrator:8b',
        medicalImaging: 'llava-med-v1.6:latest',
        medicalText: 'medtext-llama3',
        general: 'sauerkraut-llama3.1:8b',
        financeReasoning: 'fino1-8b',
        financeGeneral: 'llm-pro-finance-8b',
        vatExpert: 'llm-pro-finance-8b'
    },
    
    thresholds: {
        routerConfidence: 0.6,
        extractionConfidence: 0.7,
        fallbackTrigger: 0.5
    },
    
    timeouts: {
        router: 30000,
        extraction: 60000,
        total: 180000
    },
    
    features: {
        enableExpertPipeline: true,
        enableMedicalPipeline: true,
        enableFallbackToLegacy: true,
        enableMetricsLogging: true,
        enableVatRag: true
    },

    rag: {
        vatDir: './data/austrian_vat',
        maxResults: 3,
        maxExcerptChars: 800
    }
};

Usage Guide
Basic Usage
javascript
const services = require('./services');
const ollamaService = require('./ollama');

// Create service container
const container = services.createServiceContainer(ollamaService, {
    enableMedical: true
});

// Process a document
const document = {
    id: 'doc-123',
    filename: 'lab_results.pdf',
    content: 'Patient: John Doe\nGlucose: 105 mg/dL...',
    image_path: '/path/to/scanned/image.png'
};

const result = await container.process(document);

console.log(result.success);           // true
console.log(result.paperless);         // Formatted for paperless-ngx API
console.log(result.metadata.pipelineId); // 'medical-text'
console.log(result.metadata.confidence); // 0.87

Classification Only
javascript
// Get classification without full processing
const classification = await container.classify(document);

console.log(classification);
// {
//   primary_domain: 'Medical',
//   document_type: 'lab_result',
//   confidence: 0.92,
//   metadata_hints: {
//     detected_entities: ['John Doe', 'Quest Diagnostics'],
//     detected_date: '2024-03-15'
//   }
// }

Pipeline Recommendation
javascript
// Get recommended pipeline without processing
const recommendation = await container.documentProcessor.recommendPipeline(document);

console.log(recommendation);
// {
//   classification: { ... },
//   recommendedPipeline: 'medical-text',
//   pipelineName: 'Medical Text Extraction Pipeline',
//   routing: {
//     matchedConditions: ['primary_domain equals Medical'],
//     pipelinePriority: 100
//   }
// }

Express Integration
javascript
const express = require('express');
const services = require('./services');
const ollamaService = require('./ollama');

const app = express();
app.use(express.json());

// Create processor
const container = services.createServiceContainer(ollamaService);

// Mount expert pipeline router
const expertRouter = services.createExpertPipelineRouter(container.documentProcessor);
app.use('/api/expert', expertRouter);

// Available endpoints:
// POST /api/expert/process    - Process document
// POST /api/expert/classify   - Classify document
// GET  /api/expert/health     - Health check
// GET  /api/expert/stats      - Processing statistics
// GET  /api/expert/pipelines  - List pipelines
// GET  /api/expert/prompts    - List prompts
// POST /api/expert/recommend  - Get recommendation

app.listen(3000);

Webhook Handler
javascript
const services = require('./services');

// Create webhook handler
const webhookHandler = services.createWebhookHandler(container.documentProcessor, {
    autoProcess: true,
    processingMode: 'hybrid',
    
    onSuccess: async (result, webhookData) => {
        // Update paperless-ngx with extracted data
        await paperlessApi.updateDocument(
            webhookData.document_id,
            result.paperless
        );
        
        console.log(`Processed ${webhookData.document_id} with confidence ${result.metadata.confidence}`);
    },
    
    onError: async (error, webhookData) => {
        console.error(`Failed to process ${webhookData.document_id}: ${error.message}`);
        // Optionally queue for retry
    }
});

// Use with Express
app.post('/webhook/paperless', async (req, res) => {
    const result = await webhookHandler(req.body);
    res.json(result);
});

Processing Modes
javascript
// Expert Pipeline Only
const result = await container.process(document, {
    mode: 'expert_pipeline'
});

// Legacy Vision Only (existing flow)
const result = await container.process(document, {
    mode: 'legacy_vision'
});

// Legacy Text Only
const result = await container.process(document, {
    mode: 'legacy_text'
});

// Hybrid (expert + fallback) - Default
const result = await container.process(document, {
    mode: 'hybrid'
});

Pipeline Reference
Available Pipelines
Medical Imaging Pipeline (medical-imaging)
Purpose: Process medical documents with significant visual content (X-rays, MRIs, lab reports with charts)

Model: llava-med-v1.6:latest

Stages:

Classification (router)
Medical image extraction
Result integration
Routing Conditions:

primary_domain equals Medical
has_significant_visual_content equals true
Output Fields:

Patient information
Imaging findings
Diagnoses
Measurements
Medical Text Pipeline (medical-text)
Purpose: Process text-heavy medical documents (clinical notes, prescriptions, discharge summaries)

Model: medtext-llama3

Stages:

Classification (router)
Medical text extraction
Result integration
Routing Conditions:

primary_domain equals Medical
has_significant_visual_content equals false (or not present)
Output Fields:

Patient information (name, DOB, MRN)
Conditions (with ICD-10 codes)
Medications (drug, dosage, frequency)
Lab values (test, value, reference range, flags)
Procedures
Providers
Financial Pipeline (financial)
Purpose: Process financial documents (invoices, statements, tax forms)

Model: fino1-8b, llm-pro-finance-8b

Routing Conditions:

primary_domain equals Financial
Output Fields:

Document type
Amounts
Dates
Parties (payer, payee)
Line items
General Pipeline (general)
Purpose: Fallback for unclassified or general documents

Model: sauerkraut-llama3.1:8b

Routing Conditions:

Default (when no other pipeline matches)
Output Fields:

Summary
Entities (people, organizations, dates)
Key information
Classification Domains
Domain	Document Types
Medical	lab_result, radiology, prescription, clinical_notes, discharge_summary, insurance_eob, immunization
Financial	invoice, statement, tax_form, receipt, contract
Legal	contract, legal_filing, correspondence
Personal	identification, correspondence, certificate
General	correspondence, report, form, unknown
Extending the System
Adding a New Domain
Step 1: Define Domain Prompts
Create services/prompts/FinancialPrompts.js:

javascript
const { DomainType, ModelType, PromptCategory } = require('./PromptRegistry');

const FinancialDocumentTypes = {
    INVOICE: 'invoice',
    STATEMENT: 'statement',
    TAX_FORM: 'tax_form',
    RECEIPT: 'receipt'
};

function registerFinancialPrompts(registry) {
    // Financial extraction prompt
    registry.register({
        id: 'FIN_EXTRACT_V1',
        version: '1.0.0',
        domain: DomainType.FINANCIAL,
        model: ModelType.TEXT,
        category: PromptCategory.EXTRACTION,
        
        systemPrompt: `You are a financial document extraction specialist.
Extract structured data from financial documents with high accuracy.

Output JSON with these fields:
{
    "document_type": "invoice|statement|receipt|tax_form",
    "parties": {
        "from": { "name": "", "address": "", "tax_id": "" },
        "to": { "name": "", "address": "", "account": "" }
    },
    "amounts": {
        "subtotal": 0,
        "tax": 0,
        "total": 0,
        "currency": "USD"
    },
    "dates": {
        "document_date": "",
        "due_date": "",
        "period_start": "",
        "period_end": ""
    },
    "line_items": [
        { "description": "", "quantity": 0, "unit_price": 0, "total": 0 }
    ],
    "reference_numbers": {
        "invoice_number": "",
        "po_number": "",
        "account_number": ""
    }
}`,
        
        userPromptTemplate: `Extract financial data from this document:

Filename: {{filename}}
Content:
{{content}}

Return structured JSON only.`,
        
        options: {
            temperature: 0.1,
            num_predict: 2000
        }
    });
    
    console.log('Financial prompts registered');
}

module.exports = {
    registerFinancialPrompts,
    FinancialDocumentTypes
};

Step 2: Register Pipeline
Add to services/experts/ExpertRegistry.js:

javascript
// In the constructor, add:
this._registerFinancialPipeline();

// Add method:
_registerFinancialPipeline() {
    this.register({
        id: 'financial',
        name: 'Financial Document Pipeline',
        domain: DomainType.FINANCIAL,
        version: '1.0.0',
        priority: 80,
        
        stages: [
            {
                id: 'extract',
                type: 'extraction',
                model: 'llm-pro-finance-8b',
                promptId: 'FIN_EXTRACT_V1',
                timeout: 45000,
                required: true
            }
        ],
        
        routing: {
            conditions: [
                { field: 'primary_domain', equals: 'Financial' }
            ]
        },
        
        outputMapping: {
            primary: 'extract'
        }
    });
}

Step 3: Register Prompts on Initialization
Update services/index.js:

javascript
const { registerFinancialPrompts } = require('./prompts/FinancialPrompts');

function initializeExpertPipeline(options = {}) {
    // ... existing code ...
    
    if (options.enableFinancial !== false) {
        registerFinancialPrompts(promptRegistry);
    }
    
    // ... rest of function ...
}

Adding a New Prompt
javascript
const { promptRegistry, DomainType, ModelType, PromptCategory } = require('./services');

// Register a custom prompt
promptRegistry.register({
    id: 'CUSTOM_EXTRACT_V1',
    version: '1.0.0',
    domain: DomainType.GENERAL,
    model: ModelType.TEXT,
    category: PromptCategory.EXTRACTION,
    
    systemPrompt: 'Your custom system prompt...',
    userPromptTemplate: 'Process: {{content}}',
    
    options: {
        temperature: 0.3,
        num_predict: 1500
    },
    
    metadata: {
        author: 'Your Name',
        description: 'Custom extraction for specific use case'
    }
});

Custom Pipeline Stage
javascript
const { expertRegistry } = require('./services');

// Add a custom pipeline with multiple stages
expertRegistry.register({
    id: 'custom-multi-stage',
    name: 'Custom Multi-Stage Pipeline',
    domain: DomainType.GENERAL,
    version: '1.0.0',
    priority: 60,
    
    stages: [
        {
            id: 'preprocess',
            type: 'extraction',
            model: 'sauerkraut-llama3.1:8b',
            promptId: 'CUSTOM_PREPROCESS_V1',
            timeout: 20000,
            required: true
        },
        {
            id: 'extract',
            type: 'extraction',
            model: 'sauerkraut-llama3.1:8b',
            promptId: 'CUSTOM_EXTRACT_V1',
            timeout: 30000,
            required: true,
            dependsOn: ['preprocess']  // Uses output from preprocess
        },
        {
            id: 'validate',
            type: 'integration',
            model: 'sauerkraut-llama3.1:8b',
            promptId: 'CUSTOM_VALIDATE_V1',
            timeout: 15000,
            required: false  // Optional validation step
        }
    ],
    
    routing: {
        conditions: [
            { field: 'document_type', equals: 'custom_type' }
        ]
    },
    
    outputMapping: {
        primary: 'extract',
        validation: 'validate'
    }
});

Troubleshooting
Common Issues
Issue: "Model not found" Error
subunit
Error: Model 'llava-med-v1.6:latest' not found

Solution:

bash
# Check available models
ollama list

# Pull missing model
ollama pull llava-med-v1.6:latest

# Verify model is loaded
curl http://localhost:11434/api/tags

Issue: Out of VRAM
subunit
Error: CUDA out of memory

Solutions:

Use smaller model variants
Process one document at a time
Reduce num_predict in prompt options
Upgrade GPU or use CPU fallback
bash
# Use smaller models
export PLANNER_MODEL=qwen3:4B
export ROUTER_MODEL=qwen3:4B
export ORCHESTRATOR_MODEL=nemotron-orchestrator:8b
export MEDICAL_ANALYSIS_MODEL=sauerkraut-llama3.1:8b

Issue: Slow Processing
Diagnosis:

javascript
const stats = container.getStats();
console.log(stats.executorStats.averageExecutionTime);

Solutions:

Ensure GPU acceleration is active
Pre-load models: ollama run model_name
Reduce prompt complexity
Use SSD storage for model files
Issue: Low Confidence Scores
Diagnosis:

javascript
const result = await container.process(document);
console.log(result.metadata.confidence);
console.log(result.result.classification);

Solutions:

Improve image quality (300 DPI recommended)
Ensure OCR text is accurate
Check document matches expected type
Adjust confidence thresholds
bash
export ROUTER_CONFIDENCE_THRESHOLD=0.5
export FALLBACK_TRIGGER_THRESHOLD=0.4

Issue: Pipeline Not Matching
Diagnosis:

javascript
const recommendation = await container.documentProcessor.recommendPipeline(document);
console.log(recommendation.routing);

Solutions:

Check routing conditions in pipeline definition
Verify classification output matches conditions
Check pipeline priority ordering
Debug Mode
Enable verbose logging:

bash
export LOG_LEVEL=debug
export DEBUG=expert-pipeline:*

javascript
// In code
const logger = require('./services/logger');
logger.level = 'debug';

// Log pipeline execution details
const result = await container.process(document);
console.log(JSON.stringify(result, null, 2));

Health Check API
bash
# Full health check
curl http://localhost:3000/api/expert/health | jq

# Check specific components
curl http://localhost:3000/api/expert/pipelines
curl http://localhost:3000/api/expert/prompts
curl http://localhost:3000/api/expert/stats

Performance Tuning
Model Loading Optimization
bash
# Pre-load models into memory
ollama run qwen3-vl:8b &
ollama run llava-med-v1.6:latest &
ollama run medtext-llama3 &

# Keep models loaded
export OLLAMA_KEEP_ALIVE=24h

Batch Processing
javascript
// Process multiple documents efficiently
async function batchProcess(documents) {
    const results = [];
    
    // Process in controlled batches
    const batchSize = 3;
    for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(doc => container.process(doc))
        );
        results.push(...batchResults);
    }
    
    return results;
}

Memory Management
javascript
// Configure for memory efficiency
const container = services.createServiceContainer(ollamaService, {
    features: {
        enableExpertPipeline: true,
        enableMedicalPipeline: true,
        enableMetricsLogging: false  // Reduce memory for metrics
    }
});

// Force garbage collection between batches (if using --expose-gc)
if (global.gc) {
    global.gc();
}

Response Caching
javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 });

async function processWithCache(document) {
    const cacheKey = `doc:${document.id}:${document.content.length}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }
    
    const result = await container.process(document);
    cache.set(cacheKey, result);
    
    return result;
}

API Reference
DocumentProcessor
typescript
class DocumentProcessor {
    constructor(ollamaService: OllamaService, options?: ProcessorOptions);
    
    // Process document through pipeline
    process(document: Document, options?: ProcessOptions): Promise<ProcessingResult>;
    
    // Classify document without extraction
    classify(document: Document, options?: ClassifyOptions): Promise<Classification>;
    
    // Get pipeline recommendation
    recommendPipeline(document: Document): Promise<Recommendation>;
    
    // Health check
    healthCheck(): Promise<HealthCheckResult>;
    
    // Get statistics
    getStats(): ProcessingStats;
}

PromptRegistry
typescript
class PromptRegistry {
    // Register a prompt
    register(prompt: PromptDefinition, options?: RegisterOptions): void;
    
    // Get prompt by ID
    get(id: string): PromptDefinition;
    
    // Check if prompt exists
    has(id: string): boolean;
    
    // Find prompts by criteria
    findByDomain(domain: DomainType): PromptDefinition[];
    findByModel(model: ModelType): PromptDefinition[];
    findByCategory(category: PromptCategory): PromptDefinition[];
    
    // Build messages for Ollama
    buildMessages(promptId: string, variables: object, image?: string): Message[];

## Prompt System: Migration & Conventions ✅

This project consolidates prompt management under `PromptRegistry` (the authoritative API). `PromptFactory` is deprecated and kept for legacy compatibility only.

### Migration Mapping

| PromptFactory (legacy) | PromptRegistry (modern) | Notes |
| --- | --- | --- |
| `buildTextPrompt(content, fields, options)` | `promptRegistry.get(promptId)` + `promptRegistry.buildMessages(promptId, variables)` | Use `getOptions()` for model call settings |
| `buildVisionPrompt(...)` | `promptRegistry.getByDomain(DomainType, ...)` + `buildMessages()` | Vision prompts accept `image` in `buildMessages` |
| `buildMedicalAnalysisPrompt(...)` | Register and use medical prompts via `registerMedicalPrompts()` | Use `DomainType.MEDICAL` prompts |

### Conventions

- Model names are case-insensitive in docs but canonicalized to **lowercase** in code (e.g., `qwen3-vl:8b`).
- Template variables use the `{{variable_name}}` syntax and are substituted by `buildMessages()`.
- For multimodal prompts, pass image data as the third argument to `buildMessages()`.

### Example

```javascript
// Build router messages and call model
const messages = promptRegistry.buildMessages('SYS_ROUTER_V1', { filename: 'invoice.pdf' }, imageBuffer);
const options = promptRegistry.getOptions('SYS_ROUTER_V1');
const response = await ollama.callModel(options.model, messages, options);
```
    list(): PromptDefinition[];
}

ModelResolver
typescript
class ModelResolver {
    // Resolve model name with aliases
    resolveModelName(modelName: string): string;
    
    // Get model tier (production|advanced|infrastructure)
    getModelTier(modelName: string): string;
    
    // Check if model is available
    isModelAvailable(modelName: string): boolean;
}

ExpertRegistry
typescript
class ExpertRegistry {
    // Register pipeline
    register(pipeline: PipelineDefinition): void;
    
    // Get pipeline by ID
    get(id: string): PipelineDefinition;
    
    // Route classification to pipeline
    route(classification: Classification): RoutingResult;
    
    // List pipelines
    list(): PipelineDefinition[];
}

Types
typescript
interface Document {
    id: string;
    filename: string;
    content: string;
    image_path?: string;
    image_data?: string;  // Base64
    ocr_text?: string;
    metadata?: object;
}

interface ProcessingResult {
    success: boolean;
    result: ExtractionResult;
    paperless: PaperlessFormat;
    metadata: {
        processingMode: string;
        pipelineId: string;
        confidence: number;
        processingTimeMs: number;
    };
}

interface Classification {
    primary_domain: string;
    document_type: string;
    confidence: number;
    reasoning?: string;
    metadata_hints?: {
        detected_entities: string[];
        detected_date?: string;
        has_significant_visual_content?: boolean;
    };
}

interface PaperlessFormat {
    document_id: string;
    title: string | null;
    content: string | null;
    tags: string[];
    correspondent: string | null;
    document_type: string | null;
    created_date: string | null;
    custom_fields: object;
}

# ============================================================================
# DEVELOPMENT AND TESTING
# ============================================================================

## Reference Implementations

The `future_implementations/` directory contains reference implementations that demonstrate experimental features and alternative approaches. These are **not production code** and should not be imported directly.

### Relationship to Production Code

- **Purpose**: `future_implementations/` serves as a development sandbox for testing new features before integration
- **Import Policy**: Always import from `services/`, never from `future_implementations/`
- **Migration Path**: Features proven in `future_implementations/` should be merged into `services/` following testing requirements
- **Documentation**: See `future_implementations/README.md` for current experimental features

### Contributing Improvements

1. **Develop** new features in `future_implementations/`
2. **Test** thoroughly with `npm test`
3. **Document** changes in relevant guides
4. **Merge** into `services/` only after peer review
5. **Update** this guide and cross-references

### Testing Requirements

- All new features must pass `npm test`
- Integration tests must cover error conditions
- Performance benchmarks required for model changes
- Documentation updates mandatory for API changes

## Changelog
Version 1.0.0 (Initial Release)
PromptRegistry with domain and model type support
ExpertRegistry with condition-based routing
ExpertPipelineExecutor with retry and metrics
DocumentProcessor with hybrid mode
Medical domain prompts and pipelines
Full test coverage
Express integration middleware
Webhook handler
Support
For issues and feature requests, please open a GitHub issue or contact the development team.

Documentation Version: 1.0.0
Last Updated: 2024-03-15
