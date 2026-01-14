/**
 * PromptRegistry.js
 *
 * Authoritative Prompt Management for the Expert Model Pipeline (PRIMARY SOURCE OF TRUTH)
 * -------------------------------------------------------------------------------
 * This module is the canonical prompt registry used by the Expert Pipeline.
 * All new code should use PromptRegistry from `services/prompts/PromptRegistry.js`.
 * PromptFactory is deprecated and preserved only for legacy backward compatibility
 * with the Ollama-based extraction flow (see also `services/PromptFactory.js`).
 *
 * Architecture Reference: Expert Model Pipeline Design
 * Hardware Target: NVIDIA RTX 3090 Ti (24GB VRAM)
 *
 * Model Configuration (use lowercase identifiers consistently):
 * - Router/Planner: qwen3-vl:8b (multimodal)
 * - Medical Radiology: llava-med-v1.6 (multimodal)
 * - Medical General: medtext-llama3 (text-only)
 * - Finance Reasoning: llm-pro-finance-8b (text-only)
 * - Finance Calculator: fino1-8b (text-only)
 * - Finance General: llm-pro-finance-8b (text-only)
 * - Fallback: sauerkraut-llama3.1:8b (text-only)
 *
 * Conventions & Usage:
 * - Enums: Use DomainType, ModelType, PromptCategory for prompt registration and
 *   querying.
 * - Template variables: use double-brace syntax `{{variable_name}}` for string
 *   substitution. Images are passed separately (see `buildMessages(promptId, variables, images)`).
 * - Model names should be referenced via `MODEL_NAMES` constants (not hardcoded strings).
 */

const logger = require('../logger');
const config = require('../../config/config');

// ============================================================================
// DOMAIN TYPES AND MODEL CONFIGURATION
// ============================================================================

const DomainType = Object.freeze({
    MEDICAL: 'Medical',
    FINANCIAL: 'Financial',
    LEGAL: 'Legal',
    GENERAL: 'General',
    SYSTEM: 'System'
});

const ModelType = Object.freeze({
    MULTIMODAL: 'multimodal',
    TEXT_ONLY: 'text_only',
    TEXT: 'text_only'
});

const PromptCategory = Object.freeze({
    ROUTING: 'routing',
    EXTRACTION: 'extraction',
    REASONING: 'reasoning',
    INTEGRATION: 'integration',
    VALIDATION: 'validation',
    RECOVERY: 'recovery',
    GENERAL: 'general'
});

/**
 * Model registry with capabilities and resource requirements.
 * Configured for RTX 3090 Ti (24GB VRAM) constraints.
 */
const MODEL_NAMES = Object.freeze({
    // Primary router/classifier model (multimodal)
    router: config.ollama?.routerModel || config.ollama?.visionModel || 'qwen3-vl:8b',

    // Medical models - prefer MEDICAL_* env vars, then config.expertModels entries, then ollama defaults
    medicalImaging: process.env.MEDICAL_VISION_MODEL || config.expertModels?.medical?.vision || config.ollama?.visionModel || 'llava-med-v1.6',
    medicalText: process.env.MEDICAL_ANALYSIS_MODEL || config.expertModels?.medical?.analysis || config.ollama?.model || 'medtext-llama3',
    medicalRadiology: process.env.MEDICAL_RADIOLOGY_MODEL || config.expertModels?.medical?.radiology || config.ollama?.visionModel || 'llava-med-v1.6',

    // Financial models - prefer FINANCIAL_* env vars, then config.expertModels entries, then finance defaults, then ollama defaults
    financeReasoning: process.env.FINANCIAL_REASONING_MODEL || process.env.FINANCIAL_ANALYSIS_MODEL || config.expertModels?.financial?.analysis || config.ollama?.model || 'llm-pro-finance-8b',
    financeGeneral: process.env.FINANCIAL_VISION_MODEL || config.expertModels?.financial?.vision || config.ollama?.visionModel || 'llm-pro-finance-8b',
    // VAT expert should use the Dragon finance reasoning model by default (fallback)
    vatExpert: process.env.VAT_EXPERT_MODEL ||
               process.env.FINANCIAL_VAT_EXPERT ||
               config.expertModels?.financial?.vatExpert ||
               process.env.FINANCIAL_VISION_MODEL ||
               config.expertModels?.financial?.vision ||
               config.ollama?.visionModel ||
               'llm-pro-finance-8b',

    // Legal expert mapping -> Dragon finance reasoning model
    legalExpert: process.env.LEGAL_EXPERT_MODEL ||
                 process.env.LEGAL_ANALYSIS_MODEL ||
                 config.expertModels?.legal?.analysis ||
                 'gpt-oss',

    // Advanced tier - Reasoning models (no default; configurable)
    dragon: process.env.DRAGON_MODEL || null,
    gptOss: process.env.GPT_OSS_MODEL || null,

    // Infrastructure tier - Orchestration and embeddings (no default)
    orchestrator: process.env.ORCHESTRATOR_MODEL ||
        config.ollama?.orchestratorModel ||
        config.expertModels?.legal?.orchestrator ||
        null,
    embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text-v1.5',
    visualRetrieval: process.env.VISUAL_RETRIEVAL_MODEL || null,

    // General fallback
    general: process.env.GENERAL_MODEL || config.ollama?.model || 'sauerkraut-llama3.1:8b'
});

const ModelRegistry = Object.freeze({
    // Primary visual router - handles document classification
    [MODEL_NAMES.router]: {
        type: ModelType.MULTIMODAL,
        vramRequirement: '8GB',
        capabilities: ['document_classification', 'visual_extraction', 'layout_analysis'],
        domains: [DomainType.SYSTEM, DomainType.GENERAL]
    },
    // System orchestrator - handles routing decisions across pipelines
    [MODEL_NAMES.orchestrator]: {
        type: ModelType.TEXT_ONLY,
        vramRequirement: '8GB',
        capabilities: ['pipeline_routing', 'service_orchestration'],
        domains: [DomainType.SYSTEM]
    },
    // Medical radiology specialist - X-rays, CT, MRI interpretation
    [MODEL_NAMES.medicalImaging]: {
        type: ModelType.MULTIMODAL,
        vramRequirement: '8GB',
        capabilities: ['radiology_analysis', 'medical_imaging', 'finding_extraction'],
        domains: [DomainType.MEDICAL]
    },
    // Medical text specialist - clinical notes, reports, prescriptions
    [MODEL_NAMES.medicalText]: {
        type: ModelType.TEXT_ONLY,
        vramRequirement: '8GB',
        capabilities: ['clinical_text', 'medical_coding', 'entity_extraction'],
        domains: [DomainType.MEDICAL]
    },
    // General fallback model
    [MODEL_NAMES.general]: {
        type: ModelType.TEXT_ONLY,
        vramRequirement: '4GB',
        capabilities: ['general_text', 'summarization', 'extraction'],
        domains: [DomainType.GENERAL, DomainType.FINANCIAL, DomainType.LEGAL]   
    },
    // Financial reasoning specialist - math-heavy QA
    [MODEL_NAMES.financeReasoning]: {
        type: ModelType.TEXT_ONLY,
        vramRequirement: '8GB',
        capabilities: ['financial_reasoning', 'math_qa', 'table_reasoning'],
        domains: [DomainType.FINANCIAL]
    },
    // Multilingual financial assistant - general finance NLP
    [MODEL_NAMES.financeGeneral]: {
        type: ModelType.TEXT_ONLY,
        vramRequirement: '8GB',
        capabilities: ['financial_extraction', 'multilingual_finance', 'regulatory_analysis'],
        domains: [DomainType.FINANCIAL]
    }
});

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

/**
 * SYS_ROUTER_V1: Visual Document Classification Router
 * 
 * Purpose: First-stage document classification to route to appropriate expert pipeline.
 * Model: qwen3-vl:8b (multimodal)
 * 
 * Classification Strategy:
 * 1. Visual Layout Analysis (letterhead, forms, imaging)
 * 2. Content Pattern Recognition (medical terms, financial figures)
 * 3. Document Type Identification
 * 4. Confidence Scoring
 */
const SYS_ROUTER_V1 = {
    id: 'SYS_ROUTER_V1',
    version: '1.0.0',
    domain: DomainType.SYSTEM,
    model: MODEL_NAMES.router,
    modelType: ModelType.MULTIMODAL,
    
    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert document classifier. Your role is to analyze document images and determine their domain, type, and appropriate processing pipeline.

CLASSIFICATION DOMAINS:
- Medical: Clinical documents, prescriptions, lab results, imaging studies, insurance claims
- Financial: Invoices, receipts, bank statements, tax documents, contracts with monetary terms
- Legal: Contracts, agreements, court documents, legal correspondence, regulatory filings
- General: Personal correspondence, general business documents, unclassified materials

ANALYSIS APPROACH:
1. Examine visual layout (letterhead, logos, form structure, tables)
2. Identify domain-specific patterns (medical terminology, financial figures, legal citations)
3. Assess document quality (resolution, clarity, completeness)
4. Determine confidence level based on evidence strength

OUTPUT REQUIREMENTS:
- Provide classification with confidence score (0.0-1.0)
- Flag any uncertainty or ambiguity
- Suggest fallback classification if primary is uncertain
- Note any visual quality issues affecting classification

You must respond ONLY with valid JSON. No explanatory text outside JSON.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Analyze this document image and classify it.

DOCUMENT CONTEXT:
- Source: {{source_system}}
- Filename: {{filename}}
- Resolution: {{resolution}}
- File size: {{file_size}}

TASK: Classify this document and provide routing recommendation.

Respond with this exact JSON structure:
{
  "classification": {
    "primary_domain": "Medical|Financial|Legal|General",
    "document_type": "<specific type within domain>",
    "confidence": <0.0-1.0>,
    "evidence": ["<visual/textual evidence supporting classification>"]
  },
  "routing": {
    "recommended_pipeline": "<pipeline identifier>",
    "requires_visual_analysis": <true|false>,
    "requires_expert_model": <true|false>,
    "suggested_models": ["<ordered list of models to use>"]
  },
  "quality_assessment": {
    "visual_clarity": "high|medium|low",
    "text_legibility": "high|medium|low",
    "completeness": "complete|partial|fragment",
    "issues": ["<any quality issues detected>"],
    "needs_rotation": <true if document appears rotated 90/180/270 degrees>,
    "rotation_degrees": <0|90|180|270 - detected rotation to correct>,
    "needs_cropping": <true if small document on large background/scan bed visible>,
    "needs_normalization": <true if any geometry correction needed before processing>
  },
  "metadata_hints": {
    "detected_date": "<date if visible, null otherwise>",
    "detected_entities": ["<organization names, person names if visible>"],
    "language": "<detected language>"
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.2,  // Low temp for consistent classification
        maxTokens: 1024,
        topK: 40,
        topP: 0.9
    }
};

/**
 * SYS_ORCHESTRATOR_V1: System-level orchestration and routing controller
 *
 * Purpose: Decide pipeline selection, visual vs. text processing, and
 * downstream service usage (Guidance, Visual RAG sidecar).
 * Model: nemotron-orchestrator:8b (text-only)
 */
const SYS_ORCHESTRATOR_V1 = {
    id: 'SYS_ORCHESTRATOR_V1',
    version: '1.0.0',
    domain: DomainType.SYSTEM,
    category: PromptCategory.ROUTING,
    model: MODEL_NAMES.orchestrator || MODEL_NAMES.general || MODEL_NAMES.router,
    modelType: ModelType.TEXT_ONLY,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are the pipeline Orchestrator. Your task is to route documents to the best
pipeline and decide whether to use visual analysis, the Guidance service, and
the Visual RAG sidecar. Use ONLY the provided inputs. Do not invent pipelines.

OUTPUT REQUIREMENTS:
- Return ONLY valid JSON
- Choose one pipeline id from the provided list
- Provide booleans for each decision field
- Provide a confidence score 0.0-1.0 and short reasons
- Include tool_plan with pre_vision and post_analysis arrays (can be empty)
- Use ONLY tools listed in TOOLS_JSON
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Decide orchestration for this document.

CLASSIFICATION_JSON:
{{classification_json}}

ROUTING_JSON:
{{routing_json}}

QUALITY_JSON:
{{quality_json}}

DOC_STATS:
{{doc_stats}}

PIPELINES:
{{pipelines}}

TOOLS_JSON:
{{tools_json}}

NORMALIZATION_GUIDANCE:
- If pre-vision normalization is needed, use tool "paperless.normalize_images_ai" in pre_vision.
- If "paperless.normalize_images_ai" is used, it MUST be the final pre_vision tool.
- Trigger normalization when QUALITY_JSON indicates: visual_clarity is "low", needs_rotation is true, or needs_cropping is true.
- Action format (actions array):
  {"type":"rotate","degrees":90}
  {"type":"crop","box":{"x":0.05,"y":0.05,"width":0.9,"height":0.9,"unit":"ratio"}}
  {"type":"scale","max_width":2048,"max_height":2048}
  {"type":"dpi","target":300}
- Use page_range {"start":1,"end":3} or pages [1,3] when needed.

Return this exact JSON structure:
{
  "selected_pipeline": "<pipeline id>",
  "requires_visual_analysis": true|false,
  "use_visual_ocr": true|false,
  "use_guidance": true|false,
  "use_visual_rag_ingestion": true|false,
  "use_visual_rag_retrieval": true|false,
  "tool_plan": {
    "pre_vision": [
      {
        "tool": "<tool name from TOOLS_JSON>",
        "input": { "<tool parameters>": "<values>" },
        "reason": "<short reason>"
      }
    ],
    "post_analysis": [
      {
        "tool": "<tool name from TOOLS_JSON>",
        "input": { "<tool parameters>": "<values>" },
        "reason": "<short reason>"
      }
    ]
  },
  "confidence": <0.0-1.0>,
  "reasons": ["<short reason>"]
}
<|eot_id|>`,

    config: {
        temperature: 0.1,
        maxTokens: 512,
        topK: 40,
        topP: 0.9
    }
};

/**
 * VIS_OCR_V1: Visual OCR Text Extraction
 *
 * Purpose: High-precision text extraction from document images using vision model.
 * Model: qwen3-vl:8b (multimodal) - same as router for VRAM efficiency
 *
 * Features:
 * - Preserves reading order (top-to-bottom, left-to-right)
 * - Maintains line breaks and paragraph structure
 * - Handles tables with column/row separators
 * - Best-effort handwriting transcription with [unclear] markers
 *
 * Usage: Called after router classification, before domain-specific extraction.
 * Output: Plain text (no JSON) for direct use by downstream stages.
 */
const VIS_OCR_V1 = {
    id: 'VIS_OCR_V1',
    version: '1.0.0',
    domain: DomainType.SYSTEM,
    category: PromptCategory.EXTRACTION,
    model: MODEL_NAMES.router,  // qwen3-vl:8b - reuse router model
    modelType: ModelType.MULTIMODAL,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a high-precision OCR engine. Your sole task is to extract ALL text visible in the document image.

EXTRACTION RULES:
1. Preserve reading order: top to bottom, left to right
2. Maintain line breaks and paragraph structure exactly as shown
3. For tables: use | as column separator, - as row separator
4. Preserve special characters, numbers, and symbols exactly as they appear
5. For handwritten text: transcribe best-effort, use [unclear] for illegible parts
6. Preserve original indentation where visible

OUTPUT FORMAT:
- Output ONLY the extracted text
- NO JSON, NO markdown, NO explanatory text
- Do NOT add content that is not visible in the image
- Do NOT summarize or interpret - just extract what you see
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Extract all text from this document image.

Page {{page_number}} of {{total_pages}}

Output the complete text content, preserving structure:
<|eot_id|>`,

    config: {
        temperature: 0.1,   // Very low for consistent, deterministic extraction
        maxTokens: 4096,    // Allow full page content
        topK: 40,
        topP: 0.9
    }
};

/**
 * MED_RADIOLOGY_V1: Medical Imaging Analysis Expert
 * 
 * Purpose: Analyze medical imaging (X-rays, CT, MRI, ultrasound)
 * Model: llava-med-v1.6:latest (multimodal, medical-trained)
 * 
 * Capabilities:
 * - Anatomical structure identification
 * - Abnormality detection and description
 * - Comparison with normal findings
 * - Structured radiology report generation
 */
const MED_RADIOLOGY_V1 = {
    id: 'MED_RADIOLOGY_V1',
    version: '1.0.0',
    domain: DomainType.MEDICAL,
    model: MODEL_NAMES.medicalImaging,
    modelType: ModelType.MULTIMODAL,
    
    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert Radiologist AI Assistant trained to analyze medical imaging studies. Your role is to provide detailed, structured analysis of radiological images following established medical imaging standards.

EXPERTISE AREAS:
- Plain radiography (X-rays): Chest, skeletal, abdominal
- Cross-sectional imaging: CT, MRI interpretation
- Ultrasound: Abdominal, cardiac, vascular
- Nuclear medicine: Basic pattern recognition

ANALYSIS FRAMEWORK:
1. Technical Assessment: Image quality, positioning, artifacts
2. Systematic Review: Anatomical structures in standard order
3. Finding Description: Location, size, density/intensity, margins, enhancement
4. Differential Diagnosis: Most likely to least likely
5. Recommendations: Follow-up imaging, clinical correlation

CRITICAL GUIDELINES:
- Use standardized radiology terminology (ACR, RSNA lexicons)
- Describe findings objectively without definitive diagnosis
- Flag critical/urgent findings prominently
- Note limitations affecting interpretation
- NEVER provide treatment recommendations - defer to treating physician

UNCERTAINTY HANDLING:
- Clearly state confidence levels for each finding
- Distinguish between "definitely present," "possibly present," and "cannot exclude"
- Recommend additional views or modalities when findings are equivocal

You must respond ONLY with valid JSON following the specified schema.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Analyze this medical image and provide a structured radiology interpretation.

STUDY INFORMATION:
- Modality: {{modality}}
- Body Region: {{body_region}}
- Clinical Indication: {{clinical_indication}}
- Comparison Studies: {{comparison_available}}
- Patient Context: {{patient_context}}

ANALYSIS REQUIREMENTS:
1. Assess image quality and technical factors
2. Systematically review all visible structures
3. Document all findings (normal and abnormal)
4. Provide differential diagnosis for abnormalities
5. Make recommendations for follow-up if indicated

Respond with this exact JSON structure:
{
  "study_info": {
    "modality_confirmed": "<detected modality>",
    "body_region_confirmed": "<detected region>",
    "laterality": "left|right|bilateral|not_applicable",
    "technique_notes": "<any technique observations>"
  },
  "technical_quality": {
    "overall_quality": "diagnostic|limited|non_diagnostic",
    "positioning": "adequate|suboptimal",
    "exposure": "adequate|over|under",
    "artifacts": ["<list any artifacts>"],
    "limitations": ["<factors limiting interpretation>"]
  },
  "findings": [
    {
      "finding_id": "<sequential number>",
      "structure": "<anatomical structure>",
      "observation": "<detailed description>",
      "location": "<specific location>",
      "size_mm": "<measurement if applicable>",
      "severity": "normal|mild|moderate|severe",
      "confidence": <0.0-1.0>,
      "is_abnormal": <true|false>,
      "is_critical": <true|false>
    }
  ],
  "impression": {
    "primary_diagnosis": "<most likely diagnosis>",
    "differential_diagnoses": [
      {"diagnosis": "<alternative>", "likelihood": "high|medium|low"}
    ],
    "critical_findings": ["<any urgent findings requiring immediate attention>"],
    "incidental_findings": ["<unrelated but notable findings>"]
  },
  "recommendations": {
    "clinical_correlation": "<suggested clinical correlation>",
    "follow_up_imaging": "<recommended follow-up if any>",
    "additional_views": ["<suggested additional views>"],
    "urgency": "routine|urgent|emergent"
  },
  "confidence_summary": {
    "overall_confidence": <0.0-1.0>,
    "limiting_factors": ["<what reduced confidence>"],
    "requires_human_review": <true|false>
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.3,  // Slightly higher for nuanced medical reasoning
        maxTokens: 4096,
        topK: 50,
        topP: 0.9
    }
};

/**
 * MED_DOCTOR_V1: General Medical Document Analysis Expert
 * 
 * Purpose: Analyze clinical text documents (notes, reports, prescriptions)
 * Model: medtext-llama3:latest (text-only, medical-trained)
 * 
 * Capabilities:
 * - Clinical entity extraction (conditions, medications, procedures)
 * - Medical coding suggestions (ICD-10, CPT)
 * - Temporal reasoning for clinical timelines
 * - HIPAA-compliant summarization
 */
const MED_DOCTOR_V1 = {
    id: 'MED_DOCTOR_V1',
    version: '1.0.0',
    domain: DomainType.MEDICAL,
    model: MODEL_NAMES.medicalText,
    modelType: ModelType.TEXT_ONLY,
    
    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert Medical Document Analyst AI trained to extract structured information from clinical documents. Your role is to parse medical text and produce standardized, coded outputs suitable for EHR integration.

DOCUMENT TYPES YOU HANDLE:
- Clinical Notes: Progress notes, H&P, discharge summaries
- Prescriptions: Medication orders, refill requests
- Lab Reports: Chemistry, hematology, microbiology results
- Procedure Reports: Operative notes, endoscopy, biopsy reports
- Referral Letters: Specialist consultations, transfer summaries
- Insurance Documents: Prior authorizations, claims, EOBs

EXTRACTION CAPABILITIES:
1. Named Entity Recognition: Patients, providers, facilities, medications, conditions
2. Medical Coding: ICD-10-CM, CPT, HCPCS, NDC, RxNorm, SNOMED-CT suggestions
3. Temporal Extraction: Dates, durations, frequencies, sequences
4. Relationship Mapping: Condition-medication, provider-procedure associations
5. Dosage Parsing: Drug, strength, form, route, frequency, duration

CRITICAL GUIDELINES:
- Maintain patient privacy - extract but flag PHI elements
- Use standardized terminologies when coding
- Flag ambiguous or conflicting information
- Note missing critical elements (allergies, current medications)
- Never fabricate information not present in source document

OUTPUT QUALITY:
- Prefer specific codes over generic
- Include confidence scores for uncertain extractions
- Preserve original text snippets as evidence
- Flag items requiring human verification
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Analyze the following medical document text and extract structured information.

DOCUMENT CONTEXT:
- Document Type: {{document_type}}
- Source System: {{source_system}}
- Document Date: {{document_date}}
- Processing Mode: {{processing_mode}}

DOCUMENT TEXT:
---
{{text_chunk}}
---

EXTRACTION REQUIREMENTS:
1. Extract all clinical entities (conditions, medications, procedures, providers)
2. Suggest appropriate medical codes where possible
3. Identify temporal information and construct timeline
4. Flag any PHI elements present
5. Note any quality issues or missing information

Respond with this exact JSON structure:
{
  "document_analysis": {
    "detected_type": "<confirmed document type>",
    "language": "<detected language>",
    "quality_score": <0.0-1.0>,
    "completeness": "complete|partial|fragment"
  },
  "entities": {
    "conditions": [
      {
        "text": "<original text>",
        "normalized": "<standardized term>",
        "icd10_codes": ["<suggested codes>"],
        "snomed_code": "<SNOMED-CT if available>",
        "status": "active|resolved|historical",
        "confidence": <0.0-1.0>
      }
    ],
    "medications": [
      {
        "text": "<original text>",
        "drug_name": "<normalized drug name>",
        "rxnorm_code": "<RxNorm code if available>",
        "ndc_code": "<NDC if available>",
        "dosage": {
          "strength": "<strength>",
          "unit": "<unit>",
          "form": "<form>",
          "route": "<route>",
          "frequency": "<frequency>",
          "duration": "<duration if specified>"
        },
        "status": "active|discontinued|as_needed",
        "confidence": <0.0-1.0>
      }
    ],
    "procedures": [
      {
        "text": "<original text>",
        "normalized": "<standardized term>",
        "cpt_codes": ["<suggested CPT codes>"],
        "date_performed": "<date if available>",
        "provider": "<performing provider if noted>",
        "confidence": <0.0-1.0>
      }
    ],
    "providers": [
      {
        "name": "<provider name>",
        "role": "<role/specialty>",
        "npi": "<NPI if available>",
        "facility": "<associated facility>"
      }
    ],
    "labs": [
      {
        "test_name": "<test name>",
        "loinc_code": "<LOINC if available>",
        "value": "<result value>",
        "unit": "<unit>",
        "reference_range": "<range if provided>",
        "flag": "normal|high|low|critical",
        "date": "<collection date>"
      }
    ]
  },
  "temporal_info": {
    "document_date": "<extracted document date>",
    "encounter_date": "<patient encounter date>",
    "timeline_events": [
      {
        "event": "<description>",
        "date": "<date or relative time>",
        "sequence_order": <integer>
      }
    ]
  },
  "phi_detected": {
    "has_phi": <true|false>,
    "phi_types": ["<types of PHI found: name, dob, ssn, mrn, etc>"],
    "phi_locations": ["<approximate locations in text>"]
  },
  "quality_flags": {
    "missing_critical": ["<list of expected but missing elements>"],
    "ambiguous_items": ["<items needing clarification>"],
    "conflicting_info": ["<any contradictory information>"],
    "requires_human_review": <true|false>,
    "review_reasons": ["<why human review needed>"]
  },
  "summary": {
    "brief_summary": "<1-2 sentence document summary>",
    "key_findings": ["<most important extracted items>"],
    "action_items": ["<any follow-up actions mentioned>"]
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.2,  // Low temp for accurate extraction
        maxTokens: 4096,
        topK: 40,
        topP: 0.9
    }
};

/**
 * MED_INTEGRATOR_V1: Medical Data Integration and Reasoning
 * 
 * Purpose: Combine outputs from multiple medical analysis stages
 * Model: medtext-llama3:latest (text-only)
 * 
 * Capabilities:
 * - Cross-reference imaging findings with clinical notes
 * - Resolve conflicts between extraction sources
 * - Generate unified patient summary
 * - Flag discrepancies for human review
 */
const MED_INTEGRATOR_V1 = {
    id: 'MED_INTEGRATOR_V1',
    version: '1.0.0',
    domain: DomainType.MEDICAL,
    model: 'medtext-llama3:latest',
    modelType: ModelType.TEXT_ONLY,
    
    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an expert Medical Information Integrator AI. Your role is to combine and reconcile outputs from multiple analysis stages (visual imaging analysis, text extraction, prior records) into a unified, coherent summary.

INTEGRATION RESPONSIBILITIES:
1. Cross-Reference: Match findings across different data sources
2. Conflict Resolution: Identify and flag discrepancies between sources
3. Completeness Check: Ensure all critical information is captured
4. Confidence Aggregation: Compute overall confidence from individual scores
5. Summary Generation: Create unified narrative from structured data

CONFLICT HANDLING RULES:
- When sources disagree, preserve both with attribution
- Prefer more specific information over generic
- Prefer recent information for current status
- Flag significant discrepancies for human review

OUTPUT REQUIREMENTS:
- Unified structured record suitable for EHR import
- Clear provenance tracking (which source provided what)
- Aggregated confidence scores
- Human review queue for uncertain items
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Integrate the following analysis outputs into a unified medical record.

STAGE 1 - IMAGING ANALYSIS (from llava-med-v1.6):
{{imaging_analysis}}

STAGE 2 - TEXT EXTRACTION (from medtext-llama3):
{{text_extraction}}

PRIOR CONTEXT (if available):
{{prior_context}}

INTEGRATION REQUIREMENTS:
1. Cross-reference findings between imaging and text
2. Identify any conflicts or discrepancies
3. Create unified entity list with provenance
4. Generate confidence-weighted summary
5. Build human review queue for uncertain items

Respond with this exact JSON structure:
{
  "integration_status": {
    "sources_processed": ["<list of sources integrated>"],
    "integration_quality": "high|medium|low",
    "conflicts_detected": <count>,
    "items_requiring_review": <count>
  },
  "unified_record": {
    "patient_summary": "<integrated narrative summary>",
    "conditions": [
      {
        "condition": "<condition name>",
        "sources": ["<which analyses found this>"],
        "icd10": "<code>",
        "status": "active|resolved|historical",
        "confidence": <aggregated 0.0-1.0>,
        "evidence": ["<supporting evidence from each source>"]
      }
    ],
    "medications": [
      {
        "medication": "<medication name>",
        "sources": ["<which analyses found this>"],
        "dosage": "<unified dosage>",
        "status": "active|discontinued",
        "confidence": <aggregated 0.0-1.0>
      }
    ],
    "imaging_findings": [
      {
        "finding": "<finding description>",
        "clinical_correlation": "<how it relates to clinical notes>",
        "significance": "critical|significant|incidental",
        "confidence": <0.0-1.0>
      }
    ]
  },
  "conflicts": [
    {
      "conflict_id": "<id>",
      "description": "<what conflicts>",
      "source_a": {"source": "<name>", "value": "<value>"},
      "source_b": {"source": "<name>", "value": "<value>"},
      "resolution": "prefer_a|prefer_b|flag_for_review",
      "resolution_reason": "<why this resolution>"
    }
  ],
  "review_queue": [
    {
      "item": "<what needs review>",
      "reason": "<why it needs review>",
      "priority": "high|medium|low",
      "suggested_action": "<what reviewer should verify>"
    }
  ],
  "confidence_summary": {
    "overall_confidence": <0.0-1.0>,
    "high_confidence_items": <count>,
    "low_confidence_items": <count>,
    "flagged_for_review": <count>
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.25,
        maxTokens: 4096,
        topK: 40,
        topP: 0.9
    }
};

/**
 * GEN_FALLBACK_V1: General Purpose Document Analysis
 * 
 * Purpose: Handle documents that don't match specialized pipelines
 * Model: sauerkraut-llama3.1:8b (text-only)
 * 
 * Capabilities:
 * - Generic entity extraction
 * - Document summarization
 * - Key-value pair extraction
 * - Language detection and translation hints
 */
const GEN_FALLBACK_V1 = {
    id: 'GEN_FALLBACK_V1',
    version: '1.0.0',
    domain: DomainType.GENERAL,
    model: MODEL_NAMES.general,
    modelType: ModelType.TEXT_ONLY,
    
    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a General Document Analysis AI. Your role is to extract structured information from documents that don't fit specialized medical, financial, or legal categories.

CAPABILITIES:
1. Entity Extraction: People, organizations, locations, dates, amounts
2. Key-Value Pairs: Structured form data, metadata fields
3. Summarization: Concise document summaries
4. Classification: Document type and purpose identification
5. Action Items: Any tasks or follow-ups mentioned

OUTPUT APPROACH:
- Extract all identifiable structured information
- Preserve original text for key extractions
- Flag uncertain extractions with confidence scores
- Suggest appropriate tags/categories for filing
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Analyze this document and extract all relevant structured information.

DOCUMENT CONTEXT:
- Filename: {{filename}}
- Source: {{source_system}}
- OCR Quality: {{ocr_quality}}

DOCUMENT TEXT:
---
{{text_chunk}}
---

Respond with this exact JSON structure:
{
  "document_info": {
    "detected_type": "<document type>",
    "detected_language": "<language>",
    "date": "<document date if found>",
    "subject": "<document subject/topic>"
  },
  "entities": {
    "people": [{"name": "<name>", "role": "<role if known>", "confidence": <0.0-1.0>}],
    "organizations": [{"name": "<name>", "type": "<type>", "confidence": <0.0-1.0>}],
    "locations": [{"name": "<name>", "type": "address|city|country|other", "confidence": <0.0-1.0>}],
    "dates": [{"text": "<original>", "normalized": "<ISO format>", "context": "<what this date refers to>"}],
    "amounts": [{"text": "<original>", "value": <number>, "currency": "<currency>", "context": "<what this amount is for>"}]
  },
  "key_value_pairs": [
    {"key": "<field name>", "value": "<value>", "confidence": <0.0-1.0>}
  ],
  "summary": {
    "brief": "<1-2 sentence summary>",
    "key_points": ["<main points>"],
    "action_items": ["<any actions or follow-ups mentioned>"]
  },
  "suggested_tags": ["<relevant tags for filing>"],
  "confidence": {
    "overall": <0.0-1.0>,
    "extraction_quality": "high|medium|low"
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.3,
        maxTokens: 2048,
        topK: 40,
        topP: 0.9
    }
};

/**
 * VISUAL_QUERY_GENERATOR_V1: Visual Query Generation (Stage 5.5 fallback)
 *
 * Purpose: Generate targeted visual queries for missing/low-confidence fields
 * Model: general fallback (text-only)
 * Output: JSON with queries[] for visual search
 */
const VISUAL_QUERY_GENERATOR_V1 = {
    id: 'VISUAL_QUERY_GENERATOR_V1',
    version: '1.0.0',
    domain: DomainType.SYSTEM,
    model: MODEL_NAMES.general,
    modelType: ModelType.TEXT_ONLY,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You generate targeted visual queries for field validation.
Output MUST be valid JSON only and match the required schema.
Rules:
- Minimum 3 queries.
- Queries must target missing or low-confidence fields.
- field_target must exist in the provided schema or extraction output.
- expected_element_type must be one of: field_extraction, validation, exploration.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Generate visual queries using the inputs below.

EXTRACTION_RESULT (JSON):
{{extraction_result}}

OCR_TEXT (string):
{{ocr_text}}

FIELD_SCHEMA / TAXONOMY (JSON):
{{field_schema}}

VISUAL_ELEMENTS (JSON):
{{visual_elements}}

Return this exact JSON structure:
{
  "queries": [
    {
      "question": "<natural language question>",
      "field_target": "<field name>",
      "expected_element_type": "field_extraction|validation|exploration",
      "priority": <0.0-1.0>,
      "confidence": <0.0-1.0>,
      "rarity_factor": <0.0-1.0>
    }
  ]
}
<|eot_id|>`,

    config: { temperature: 0.0, maxTokens: 768, topK: 40 }
};

/**
 * VIS_SIGNAL_ANALYZER_V1: First-Pass Visual Signal Analysis
 *
 * Purpose: Fast, single-pass analysis of document geometry and type.
 * Model: qwen3-vl:8b (multimodal)
 *
 * Capabilities:
 * - Document Type Classification
 * - Rotation Detection
 * - Crop Detection
 * - Text Overlay Localization
 */
const VIS_SIGNAL_ANALYZER_V1 = {
    id: 'VIS_SIGNAL_ANALYZER_V1',
    version: '1.0.0',
    domain: DomainType.SYSTEM,
    category: PromptCategory.ROUTING,
    model: MODEL_NAMES.router,
    modelType: ModelType.MULTIMODAL,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a Visual Document Signal Analyzer. Your job is to analyze a document image and output critical normalization signals and classification.

TASKS:
1. Identify Document Type (Invoice, Receipt, Contract, Medical Report, etc.)
2. Detect Rotation (0, 90, 180, 270 degrees clockwise to fix)
3. Detect Cropping Needs (if the document is surrounded by a large background)
4. Identify Text Overlays (optional, if significant text is overlaid on images)

OUTPUT RULES:
- Return ONLY valid JSON.
- Confidence scores must be 0.0-1.0.
- Rotation is the amount needed to FIX the image.
- Crop box is [xmin, ymin, xmax, ymax] in 0-1000 normalized coordinates.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Analyze this document image for normalization signals.

CONTEXT:
- Filename: {{filename}}
- Source: {{source_system}}

Respond with this exact JSON structure:
{
  "document_type": "<specific type>",
  "primary_domain": "Medical|Financial|Legal|General",
  "rotation": {
    "needed": <true|false>,
    "degrees": <0|90|180|270>,
    "confidence": <0.0-1.0>
  },
  "crop": {
    "needed": <true|false>,
    "box": [<xmin>, <ymin>, <xmax>, <ymax>] or null,
    "confidence": <0.0-1.0>
  },
  "overlays": [
    {"label": "<label>", "box": [<xmin>, <ymin>, <xmax>, <ymax>]}
  ],
  "confidence": <0.0-1.0>
}
<|eot_id|>`,

    config: {
        temperature: 0.1,
        maxTokens: 512,
        topK: 40,
        topP: 0.9
    },
};

/**
 * FIN_EXTRACT_V1: Financial Document Extraction
 *
 * Purpose: Extract structured data from financial documents
 * Model: llm-pro-finance-8b (text-only, multilingual)
 */
const FIN_EXTRACT_V1 = {
    id: 'FIN_EXTRACT_V1',
    version: '1.0.0',
    domain: DomainType.FINANCIAL,
    model: MODEL_NAMES.financeGeneral,
    modelType: ModelType.TEXT_ONLY,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a multilingual financial document extraction assistant.
Focus on accurate structured extraction from invoices, statements, tax forms, and receipts.
Handle English, German, and French financial terminology.

OUTPUT RULES:
- Return valid JSON only.
- Extract amounts, dates, parties, and tax/VAT details when present.
- Do not invent values; use null when missing.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Extract structured financial data from this document.

DOCUMENT CONTEXT:
- Filename: {{filename}}
- Source: {{source_system}}
- OCR Quality: {{ocr_quality}}
- Document Type Hint: {{document_type}}

DOCUMENT TEXT:
---
{{text_chunk}}
---

Respond with this exact JSON structure:
{
  "document_type": "<invoice|receipt|statement|tax_form|other>",
  "language": "<detected language>",
  "parties": {
    "issuer": {"name": "<name>", "tax_id": "<id or null>", "address": "<address or null>"},
    "recipient": {"name": "<name>", "tax_id": "<id or null>", "address": "<address or null>"}
  },
  "dates": {
    "document_date": "<YYYY-MM-DD or null>",
    "due_date": "<YYYY-MM-DD or null>",
    "period_start": "<YYYY-MM-DD or null>",
    "period_end": "<YYYY-MM-DD or null>"
  },
  "amounts": {
    "subtotal": <number or null>,
    "tax": <number or null>,
    "total": <number or null>,
    "currency": "<ISO currency code or null>",
    "tax_rate_percent": <number or null>
  },
  "line_items": [
    {"description": "<text>", "quantity": <number or null>, "unit_price": <number or null>, "total": <number or null>}
  ],
  "payment_terms": "<text or null>",
  "reference_numbers": {
    "invoice_number": "<value or null>",
    "customer_number": "<value or null>",
    "iban": "<value or null>"
  },
  "confidence": {
    "overall": <0.0-1.0>,
    "extraction_quality": "high|medium|low"
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.2,
        maxTokens: 2048,
        topK: 40,
        topP: 0.9
    }
};

/**
 * FIN_REASONER_V1: Financial Reasoning & Consistency Checks
 *
 * Purpose: Perform math-heavy reasoning and validate totals
 * Model: fino1-8b (text-only)
 */
const FIN_REASONER_V1 = {
    id: 'FIN_REASONER_V1',
    version: '1.0.0',
    domain: DomainType.FINANCIAL,
    model: MODEL_NAMES.financeReasoning,
    modelType: ModelType.TEXT_ONLY,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a financial reasoning engine specialized in math-heavy QA and consistency checks.
Use stepwise reasoning internally, but output JSON only.

OUTPUT RULES:
- Return valid JSON only.
- Verify arithmetic (subtotal + tax = total, etc.).
- Highlight inconsistencies and provide corrected calculations if possible.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Review the extracted financial data and the source text for numerical consistency.

EXTRACTED DATA (JSON):
{{extracted_data}}

DOCUMENT TEXT:
---
{{text_chunk}}
---

Respond with this exact JSON structure:
{
  "calculations": [
    {"name": "<calculation>", "formula": "<formula>", "value": <number or null>}
  ],
  "consistency_checks": [
    {"check": "<what was checked>", "status": "pass|fail|unknown", "details": "<notes>"}
  ],
  "issues": [
    {"type": "mismatch|missing|ambiguous", "description": "<issue>", "severity": "low|medium|high"}
  ],
  "suggested_corrections": {
    "subtotal": <number or null>,
    "tax": <number or null>,
    "total": <number or null>,
    "tax_rate_percent": <number or null>
  },
  "confidence": {
    "overall": <0.0-1.0>,
    "reasoning_quality": "high|medium|low"
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.1,
        maxTokens: 1536,
        topK: 40,
        topP: 0.9
    }
};

/**
 * LEGAL_ORCHESTRATOR_V1: Legal Document Orchestration & Complexity Classification
 *
 * Purpose: Classify legal document complexity and recommend routing to specialized pipelines
 * Model: nemotron-orchestrator:8b (orchestrator)
 */
const LEGAL_ORCHESTRATOR_V1 = {
    id: 'LEGAL_ORCHESTRATOR_V1',
    version: '1.0.0',
    domain: DomainType.LEGAL,
    model: MODEL_NAMES.orchestrator || MODEL_NAMES.router,
    modelType: ModelType.TEXT_ONLY,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an Orchestrator for legal documents. Classify the document's complexity (low|medium|high), identify whether specialized legal extraction is required, and recommend the pipeline or stages to run.
Provide only valid JSON as the output.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Classify the following document's legal complexity and recommend routing.

DOCUMENT:
---
{{text_chunk}}
---

Respond with this exact JSON structure:
{
  "complexity": "low|medium|high",
  "recommended_pipeline": "<pipeline id>",
  "recommendations": ["<short reasons>"],
  "confidence": <0.0-1.0>
}
<|eot_id|>`,

    config: { temperature: 0.0, maxTokens: 256 }
};


/**
 * LEGAL_EXTRACTOR_V1: Legal Extraction and Risk Analysis
 *
 * Purpose: Extract legal clauses, identify risks, and cite sections from internal legal knowledge base
 * Model: llm-pro-finance-8b (reasoning)
 * Variables: accepts {{legal_context}}
 * System Prompt: Senior Legal Analyst with <think> tags
 */
const LEGAL_EXTRACTOR_V1 = {
    id: 'LEGAL_EXTRACTOR_V1',
    version: '1.0.0',
    domain: DomainType.LEGAL,
    model: MODEL_NAMES.legalExpert,
    modelType: ModelType.TEXT_ONLY,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are a Senior Legal Analyst. Use <think> tags to reason about risks. Cite specific sections from the Internal Legal Knowledge Base provided in context. Provide clear, concise legal extractions and risk assessments. Return ONLY valid JSON.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Apply the internal legal context to extract clauses and assess risks for the document below.

INTERNAL LEGAL CONTEXT (DO NOT DISCLOSE):
{{legal_context}}

DOCUMENT TEXT:
---
{{text_chunk}}
---

Respond with JSON including at minimum: extracted_clauses, risks, citations, and confidence.
<|eot_id|>`,

    config: { temperature: 0.1, maxTokens: 2048, topK: 40 }
};


/**
 * FIN_VAT_EXPERT_V1: VAT Compliance & Interpretation
 *
 * Purpose: Apply internal VAT knowledge to document interpretation
 * Model: llm-pro-finance-8b (text-only)
 *
 * IMPORTANT: Internal VAT context is for reasoning only and must not be disclosed.
 */
const FIN_VAT_EXPERT_V1 = {
    id: 'FIN_VAT_EXPERT_V1',
    version: '1.0.0',
    domain: DomainType.FINANCIAL,
    model: MODEL_NAMES.vatExpert,
    modelType: ModelType.TEXT_ONLY,

    systemPrompt: `<|begin_of_text|><|start_header_id|>system<|end_header_id|>
You are an Austrian VAT compliance expert.
Use the provided internal VAT context for reasoning only.
Do NOT quote, summarize, or reveal the internal context or filenames.
Do NOT mention that internal documents were used.
Focus on applying VAT rules to the document at hand.

OUTPUT RULES:
- Return valid JSON only.
- Provide VAT-related findings and flags relevant to the document.
<|eot_id|>`,

    userTemplate: `<|start_header_id|>user<|end_header_id|>
Assess VAT implications for this document using the internal VAT context.

INTERNAL VAT CONTEXT (DO NOT DISCLOSE):
{{vat_context}}

DOCUMENT TEXT:
---
{{text_chunk}}
---

Respond with this exact JSON structure:
{
  "vat_applicability": "yes|no|unclear",
  "vat_rate_percent": <number or null>,
  "reverse_charge": "yes|no|unclear",
  "intra_eu_supply": "yes|no|unclear",
  "evidence": ["<short, document-based evidence>"],
  "flags": [
    {"flag": "<issue>", "severity": "low|medium|high", "recommended_action": "<action>"}
  ],
  "confidence": {
    "overall": <0.0-1.0>,
    "assessment_quality": "high|medium|low"
  }
}
<|eot_id|>`,

    config: {
        temperature: 0.2,
        maxTokens: 1536,
        topK: 40,
        topP: 0.9
    }
};

// ============================================================================
// PROMPT REGISTRY CLASS
// ============================================================================

class PromptRegistry {
    constructor() {
        this.prompts = new Map();
        this.modelRegistry = ModelRegistry;
        this._registerBuiltinPrompts();
    }

    _registerBuiltinPrompts() {
        this.register(SYS_ROUTER_V1);
        this.register(SYS_ORCHESTRATOR_V1);
        this.register(VIS_SIGNAL_ANALYZER_V1);
        this.register(VIS_OCR_V1);
        this.register(MED_RADIOLOGY_V1);
        this.register(MED_DOCTOR_V1);
        this.register(MED_INTEGRATOR_V1);
        this.register(FIN_EXTRACT_V1);
        this.register(FIN_REASONER_V1);
        this.register(FIN_VAT_EXPERT_V1);
        this.register(LEGAL_ORCHESTRATOR_V1);
        this.register(LEGAL_EXTRACTOR_V1);
        this.register(GEN_FALLBACK_V1);
        this.register(VISUAL_QUERY_GENERATOR_V1);

        logger.info(`PromptRegistry initialized with ${this.prompts.size} prompts`);
    }
    
    /**
     * Register a new prompt template
     */
    register(prompt, opts = {}) {
        const userTemplate = prompt && (prompt.userTemplate || prompt.userPromptTemplate);
        if (!prompt || !prompt.id || !prompt.systemPrompt || !userTemplate) {
            throw new Error('Missing required field');
        }

        // If prompt already exists, handle according to overwrite flag and content equality
        if (this.prompts.has(prompt.id)) {
            const existing = this.prompts.get(prompt.id);

            // Normalization helper for user templates
            const _normalize = (t) => (t || '').replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();

            // Build canonical representations (exclude registeredAt)
            const canonicalize = (obj) => {
                // Deep clone via JSON to avoid mutating originals
                const copy = JSON.parse(JSON.stringify(obj));
                if (copy.userTemplate) copy.userTemplate = _normalize(copy.userTemplate);
                if (copy.userPromptTemplate) copy.userPromptTemplate = _normalize(copy.userPromptTemplate);
                delete copy.registeredAt;

                // Recursively sort keys to make stringify deterministic
                const sortKeys = (v) => {
                    if (Array.isArray(v)) return v.map(sortKeys);
                    if (v && typeof v === 'object') {
                        return Object.keys(v).sort().reduce((acc, k) => {
                            acc[k] = sortKeys(v[k]);
                            return acc;
                        }, {});
                    }
                    return v;
                };

                return JSON.stringify(sortKeys(copy));
            };

            const existingCanonical = canonicalize(existing);

            // Ensure new prompt uses normalized userTemplate for comparison
            const newPromptForCompare = Object.assign({}, prompt, { userTemplate: _normalize(userTemplate) });
            const newCanonical = canonicalize(newPromptForCompare);

            if (existingCanonical === newCanonical) {
                // Identical (ignoring registeredAt) -> idempotent: skip re-registration
                logger.debug(`Prompt ${prompt.id} already registered with identical properties; skipping`);
                return;
            }

            if (!opts.overwrite) {
                throw new Error(`Prompt with id ${prompt.id} already registered`);
            }
            // else allow overwrite to proceed
        }

        // Store normalized userTemplate for consistency
        const normalizedTemplate = (userTemplate || '').replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();

        this.prompts.set(prompt.id, {
            ...prompt,
            userTemplate: normalizedTemplate,
            registeredAt: Date.now()
        });

        logger.debug(`Registered prompt: ${prompt.id} (${prompt.domain})`);
    }
    
    /**
     * Get a prompt by ID
     */
    get(promptId) {
        const prompt = this.prompts.get(promptId);
        if (!prompt) {
            throw new Error(`Prompt not found: ${promptId}`);
        }
        return prompt;
    }
    
    /**
     * Get all prompts for a specific domain
     */
    getByDomain(domain) {
        const results = [];
        for (const prompt of this.prompts.values()) {
            if (prompt.domain === domain) {
                results.push(prompt);
            }
        }
        return results;
    }

    findByDomain(domain) {
        return this.getByDomain(domain);
    }

    /**
     * Get prompts compatible with a specific model
     */
    getByModel(modelId) {
        const results = [];
        for (const prompt of this.prompts.values()) {
            if (prompt.model === modelId) {
                results.push(prompt);
            }
        }
        return results;
    }

    findByModel(modelId) {
        return this.getByModel(modelId);
    }

    /**
     * Get prompts by category
     */
    findByCategory(category) {
        const results = [];
        for (const prompt of this.prompts.values()) {
            if (prompt.category === category) {
                results.push(prompt);
            }
        }
        return results;
    }

    /**
     * Check if a prompt exists
     */
    has(promptId) {
        return this.prompts.has(promptId);
    }

    /**
     * Build a complete message array for Ollama API
     *
     * Example:
     *   // Retrieve prompt and build messages for a multimodal router
     *   const messages = promptRegistry.buildMessages('SYS_ROUTER_V1', {
     *       source_system: 'paperless-ngx',
     *       filename: 'invoice-123.pdf'
     *   }, imageBuffer);
     *
     *   // Then call the model with options
     *   const options = promptRegistry.getOptions('SYS_ROUTER_V1');
     */
    buildMessages(promptId, variables = {}, imageData = null) {
        const prompt = this.get(promptId);
        const messages = [];
        
        // System message with variable substitution
        let systemContent = prompt.systemPrompt || '';
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            systemContent = systemContent.replace(new RegExp(placeholder, 'g'), String(value));
        }
        // Handle any unsubstituted variables in system prompt
        systemContent = systemContent.replace(/\{\{[^}]+\}\}/g, 'N/A');

        messages.push({
            role: 'system',
            content: systemContent
        });

        // User message with variable substitution
        let userContent = prompt.userTemplate || prompt.userPromptTemplate || '';
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            userContent = userContent.replace(new RegExp(placeholder, 'g'), String(value));
        }
        
        // Handle any unsubstituted variables
        userContent = userContent.replace(/\{\{[^}]+\}\}/g, 'N/A');
        
        const userMessage = {
            role: 'user',
            content: userContent
        };
        
        // Add image for multimodal prompts (accept either modelType or model alias)
        const isMultimodal = (prompt.modelType === ModelType.MULTIMODAL) || (prompt.model === ModelType.MULTIMODAL);
        if (isMultimodal && imageData) {
            userMessage.images = Array.isArray(imageData) ? imageData : [imageData];
        }
        
        messages.push(userMessage);
        
        return messages;
    }
    
    /**
     * Get Ollama options for a prompt
     */
    getOptions(promptId) {
        const prompt = this.get(promptId);
        return {
            temperature: prompt.config.temperature,
            top_k: prompt.config.topK,
            top_p: prompt.config.topP,
            num_predict: prompt.config.maxTokens
        };
    }
    
    /**
     * Get model info for a prompt
     */
    getModelInfo(promptId) {
        const prompt = this.get(promptId);
        return {
            model: prompt.model,
            type: prompt.modelType,
            capabilities: this.modelRegistry[prompt.model]?.capabilities || []
        };
    }
    
    /**
     * List all registered prompts
     */
    list() {
        return Array.from(this.prompts.values()).map(p => ({
            id: p.id,
            domain: p.domain,
            model: p.model,
            version: p.version
        }));
    }
}

// Singleton instance
const promptRegistry = new PromptRegistry();

module.exports = {
    promptRegistry,
    PromptRegistry,
    DomainType,
    ModelType,
    PromptCategory,
    ModelRegistry,
    MODEL_NAMES,
    // Export individual prompts for direct access
    SYS_ROUTER_V1,
    SYS_ORCHESTRATOR_V1,
    VIS_SIGNAL_ANALYZER_V1,
    VIS_OCR_V1,
    MED_RADIOLOGY_V1,
    MED_DOCTOR_V1,
    MED_INTEGRATOR_V1,
    FIN_EXTRACT_V1,
    FIN_REASONER_V1,
    FIN_VAT_EXPERT_V1,
    LEGAL_ORCHESTRATOR_V1,
    LEGAL_EXTRACTOR_V1,
    GEN_FALLBACK_V1,
    VISUAL_QUERY_GENERATOR_V1
};
