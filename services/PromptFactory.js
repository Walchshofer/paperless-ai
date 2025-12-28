const config = require('../config/config');
const RestrictionPromptService = require('./restrictionPromptService');
const { appendFilenameFormat } = require('./serviceUtils');
const { templateManager } = require('./prompts/TemplateManager');

/**
 * DEPRECATED: PromptFactory
 * ---------------------------------
 * DEPRECATED: Legacy prompt construction helpers kept for backward compatibility
 * with the Ollama-based extraction flows. New code MUST use the canonical
 * `PromptRegistry` (services/prompts/PromptRegistry.js).
 *
 * Migration hints:
 * - buildTextPrompt(content, fields, options)  -> PromptRegistry.getPrompt(promptId) + buildMessages()
 * - buildVisionPrompt(...)                   -> PromptRegistry.getByDomain(DomainType, ...) + buildMessages()
 * - buildMedicalAnalysisPrompt(...)          -> Use medical prompts registered via registerMedicalPrompts()
 *
 * This file should not be exported from `services/index.js` and will be removed
 * in a future major update once the Ollama integration is migrated.
 */
class PromptFactory {
    constructor(fieldProfiler) {
        this.fieldProfiler = fieldProfiler;
    }

    _getTemplate(intent, lang, fallbackLang) {
        if (!templateManager || typeof templateManager.getTemplate !== 'function') {
            return null;
        }
        return templateManager.getTemplate(intent, lang, fallbackLang);
    }

    _renderTemplate(template, variables = {}) {
        if (!template || typeof template !== 'string') return template;
        let output = template;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            output = output.replace(new RegExp(placeholder, 'g'), String(value ?? ''));
        }
        return output;
    }

    buildBaseTemplate(mode) {
        if (mode === 'text') {
            const template = this._getTemplate('financial_extraction', 'en');
            if (template?.systemInstruction) {
                return template.systemInstruction;
            }
            return `
            You are a document analyzer. Your task is to analyze documents and extract relevant information. You do not ask back questions.
            YOU MUSTNOT: Ask for additional information or clarification, or ask questions about the document, or ask for additional context.
            YOU MUSTNOT: Return a response without the desired JSON format.
            YOU MUST: Return the result EXCLUSIVELY as a JSON object. The Tags, Title and Document_Type MUST be in the language that is used in the document.:
            IMPORTANT: The custom_fields are optional and can be left out if not needed, only try to fill out the values if you find a matching information in the document.
            custom_fields keys are fixed IDs; do not invent or rename keys. Use null when unknown. If the field is about money only add the number without currency and always use a . for decimal places.
            {
                "title": "xxxxx",
                "correspondent": "xxxxxxxx",
                "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
                "document_type": "Invoice/Contract/...",
                "document_date": "YYYY-MM-DD",
                "language": "en/de/es/...",
                %CUSTOMFIELDS%
            }
            ALWAYS USE THE INFORMATION TO FILL OUT THE JSON OBJECT. DO NOT ASK BACK QUESTIONS.
        `;
        }

        if (mode === 'playground') {
            return `
            You are a document analyzer. Your task is to analyze documents and extract relevant information. You do not ask back questions.
            YOU MUSTNOT: Ask for additional information or clarification, or ask questions about the document, or ask for additional context.
            YOU MUSTNOT: Return a response without the desired JSON format.
            YOU MUST: Analyze the document content and extract the following information into this structured JSON format and only this format!:         {
            "title": "xxxxx",
            "correspondent": "xxxxxxxx",
            "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
            "document_type": "Invoice/Contract/...",
            "document_date": "YYYY-MM-DD",
            "language": "en/de/es/..."
            }
            ALWAYS USE THE INFORMATION TO FILL OUT THE JSON OBJECT. DO NOT ASK BACK QUESTIONS.
        `;
        }

        if (mode === 'medical') {
            return `You are a medical document extractor. Return only valid JSON.`;
        }

        return '';
    }

    buildPlannerPrompt(strict = false) {
        const baseTemplate = this._getTemplate('router_classifier', 'de', 'en');
        const basePrompt = baseTemplate?.systemInstruction || 'AT/DE doc classifier. Choose ONE: financial, medical, legal, technical, personal, general. Hints: financial=Rechnung/Quittung/Honorarnote/Bank, medical=Befund/Rezept/Arztbrief, legal=Vertrag/Vereinbarung/GZ, technical=Anleitung/Datenblatt, personal=Brief/Mitteilung/Schreiben. If medical, set modality: lab|radiology|prescription|unknown. Modality hints: lab=Laborwerte/Blutbild/Befund tables, radiology=X-ray/CT/MRT/Roentgen, prescription=Rezept/Verordnung. Return ONLY JSON: {"category":"financial|medical|legal|technical|personal|general","doc_type_hint":"invoice|lab_report|contract|...","modality":"lab|radiology|prescription|unknown","confidence":0-1,"keywords":["..."],"needs_visual":true|false}. Rules: doc_type_hint specific; confidence>=0.8 clear, 0.5-0.8 maybe, <0.5 unsure; keywords 2-5 DE/EN; needs_visual true if tables/forms/stamps/complex layout.';
        if (strict) {
            const strictTemplate = this._getTemplate('router_classifier_strict', 'de', 'en');
            if (strictTemplate?.systemInstruction) {
                return strictTemplate.systemInstruction;
            }
            return `${basePrompt} STRICT MODE: JSON only, no extra keys.`;
        }
        return basePrompt;
    }


    getPlannerTemplateMeta(strict = false) {
        const intent = strict ? 'router_classifier_strict' : 'router_classifier';
        const template = this._getTemplate(intent, 'de', 'en');
        return {
            intent,
            lang: template?.lang || 'de',
            version: template?.version || 'unknown',
            source: template ? 'template_manager' : 'fallback',
            strict: !!strict
        };
    }

    buildTextPrompt(content, fields = {}, options = {}) {
        const customFieldsStr = this._generateCustomFieldsTemplate();
        const template = this._getTemplate('financial_extraction', 'en');
        const templateMeta = {
            intent: 'financial_extraction',
            lang: template?.lang || 'en',
            version: template?.version || 'unknown',
            source: template ? 'template_manager' : 'fallback'
        };
        const baseSystemPrompt = appendFilenameFormat(
            this.buildBaseTemplate('text').replace('%CUSTOMFIELDS%', customFieldsStr)
        );

        if (options.customPrompt) {
            const prompt = options.customPrompt + '\n\n'
                + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr)
                + "\n\n" + JSON.stringify(content);
            return {
                prompt,
                systemPrompt: baseSystemPrompt,
                customFieldsStr,
                templateMeta: { ...templateMeta, customPrompt: true }
            };
        }

        const existingTags = Array.isArray(fields.existingTags) ? fields.existingTags : [];
        const correspondentList = Array.isArray(fields.existingCorrespondentList)
            ? fields.existingCorrespondentList
            : [];
        const existingDocumentTypes = Array.isArray(fields.existingDocumentTypesList)
            ? fields.existingDocumentTypesList
            : [];

        let promptSystem;
        if (config.useExistingData === 'yes'
            && config.restrictToExistingTags === 'no'
            && config.restrictToExistingCorrespondents === 'no') {
            const existingTagsList = existingTags.join(', ');
            const existingCorrespondentList = correspondentList
                .filter(Boolean)
                .map(correspondent => {
                    if (typeof correspondent === 'string') return correspondent;
                    return correspondent?.name || '';
                })
                .filter(name => name.length > 0)
                .join(', ');
            const existingDocumentTypesList = existingDocumentTypes
                .filter(Boolean)
                .map(docType => {
                    if (typeof docType === 'string') return docType;
                    return docType?.name || '';
                })
                .filter(name => name.length > 0)
                .join(', ');

            promptSystem = `
            Pre-existing tags: ${existingTagsList}\n\n
            Pre-existing correspondents: ${existingCorrespondentList}\n\n
            Pre-existing document types: ${existingDocumentTypesList}\n\n
            ` + process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        } else {
            promptSystem = process.env.SYSTEM_PROMPT + '\n\n' + config.mustHavePrompt.replace('%CUSTOMFIELDS%', customFieldsStr);
        }

        promptSystem = RestrictionPromptService.processRestrictionsInPrompt(
            promptSystem,
            existingTags,
            correspondentList,
            existingDocumentTypes,
            config
        );

        if (options.validatedExternalApiData) {
            promptSystem += `\n\nAdditional context from external API:\n${options.validatedExternalApiData}`;
        }

        if (process.env.USE_PROMPT_TAGS === 'yes') {
            promptSystem = `
            Take these tags and try to match one or more to the document content.\n\n
            ` + config.specialPromptPreDefinedTags;
        }

        promptSystem = appendFilenameFormat(promptSystem);

        const prompt = JSON.stringify(content);
        const systemPrompt = promptSystem;

        return { prompt, systemPrompt, customFieldsStr, templateMeta };
    }

    buildVisionPrompt(fieldSet, docType, options = {}) {
        const coreFieldIds = Object.keys(fieldSet.coreFields || {});
        const customFieldIds = Object.keys(fieldSet.customFields || {});
        const strictMode = options.strict === true;
        const profileName = docType || fieldSet.profileName || 'general';

        let prompt = `You are a ${profileName} document extractor.\n\n`;

        if (fieldSet.profileInstructions) {
            prompt += `Domain instructions:\n${fieldSet.profileInstructions}\n\n`;
        }

        const hints = fieldSet.extractionHints || {};
        if (Object.keys(hints).length > 0) {
            prompt += `Field extraction hints:\n`;
            for (const [fieldId, hint] of Object.entries(hints)) {
                prompt += `- ${fieldId}: ${hint}\n`;
            }
            prompt += `\n`;
        }

        prompt += `Return ONLY JSON with keys: ${coreFieldIds.join(', ')}, custom_fields.\n`;
        if (customFieldIds.length > 0) {
            prompt += `custom_fields is an object with only these keys: ${customFieldIds.join(', ')}.\n`;
        } else {
            prompt += `custom_fields must be {}.\n`;
        }

        prompt += `Constraints:\n`;
        prompt += `- Output ONLY valid JSON, no explanations\n`;
        prompt += `- Do NOT invent fields or custom_fields keys\n`;
        prompt += `- Use null for fields you cannot extract\n`;
        prompt += `- Dates must be YYYY-MM-DD format\n`;
        prompt += `- Numbers must be plain (no currency symbols)\n`;
        prompt += `- Use decimal dot for numbers\n`;
        if (strictMode) {
            prompt += `STRICT MODE: Output JSON only, no extra keys, use null only when unknown.\n`;
            prompt += `- Do NOT include chain-of-thought or <thinking> blocks\n`;
            prompt += `- Put all content in the JSON object only\n`;
        }

        return prompt;
    }

    buildOcrTranscriptionPrompt(input, context) {
        const modality = context?.modality || 'unknown';

        let domainHint = '';
        if (modality === 'lab') {
            domainHint = `
This is a laboratory/blood test report. Focus on:
- Patient information (name, date of birth if visible)
- Test date and laboratory name
- All biomarker rows with: Name, Value, Unit, Reference Range
- Any flags or annotations (H=High, L=Low, *)`;
        } else if (modality === 'prescription') {
            domainHint = `
This is a medical prescription. Focus on:
- Prescribing doctor information
- Patient information
- Medication names, dosages, quantities
- Instructions and notes`;
        }

        return `You are a medical document OCR specialist.

TASK: Transcribe ALL visible text from this medical document into well-structured Markdown.

${domainHint}

OUTPUT REQUIREMENTS:
1. Use Markdown tables for tabular data (lab values, medications)
2. Preserve all numbers exactly as shown (decimal precision matters)
3. Include units and reference ranges in separate columns
4. Mark flagged/abnormal values with [H] or [L] annotations
5. Include document date if visible
6. Include laboratory/clinic name if visible

EXAMPLE OUTPUT FORMAT:
# Document: Laborbefund
**Date:** 2025-10-04
**Laboratory:** Labor Dr. Example

| Biomarker | Value | Unit | Reference | Flag |
|-----------|-------|------|-----------|------|
| Glucose | 95 | mg/dL | 70-100 | |
| HbA1c | 5.8 | % | 4.0-5.6 | [H] |
| Cholesterol | 210 | mg/dL | <200 | [H] |

IMPORTANT:
- Extract EVERY visible value
- Do NOT interpret or explain values
- Do NOT add information not visible in the document
- Preserve German medical terminology as-is`;
    }

    buildMedicalAnalysisPrompt(input, context) {
        const ocrOutput = input?.previousStageOutput?.raw || input?.previousStageOutput || '';

        return `You are a medical laboratory data analyst.

TASK: Parse the following OCR transcription of a lab report and extract structured biomarker data.

OCR TRANSCRIPTION:
${typeof ocrOutput === 'string' ? ocrOutput : JSON.stringify(ocrOutput)}

EXTRACTION RULES:
1. Extract ALL biomarkers found in the transcription
2. Map German names to standard codes where possible
3. Normalize units to standard formats (mg/dL, g/L, %, etc.)
4. Determine status based on reference ranges:
   - "normal" if within range
   - "high" if above range
   - "low" if below range
   - "critical" if far outside range (>2x deviation)
5. Parse reference ranges to numeric low/high values

BIOMARKER CODE MAPPING (German -> Code):
- Glukose, Blutzucker -> GLUCOSE
- HbA1c -> HBA1C
- Cholesterin, Gesamtcholesterin -> CHOL_TOTAL
- HDL-Cholesterin, HDL -> HDL
- LDL-Cholesterin, LDL -> LDL
- Triglyceride -> TRIGLYCERIDES
- GOT, AST -> GOT_AST
- GPT, ALT -> GPT_ALT
- GGT, Gamma-GT -> GGT
- Kreatinin -> CREATININE
- Harnstoff -> UREA
- Harnsaeure -> URIC_ACID
- TSH -> TSH
- fT3 -> FT3
- fT4 -> FT4
- Vitamin D, 25-OH-Vitamin D -> VIT_D
- Vitamin B12 -> VIT_B12
- Ferritin -> FERRITIN
- Eisen -> IRON
- Erythrozyten -> RBC
- Haemoglobin -> HEMOGLOBIN
- Leukozyten -> WBC
- Thrombozyten -> PLATELETS
- CRP -> CRP

OUTPUT FORMAT (JSON only):
{
  "test_date": "YYYY-MM-DD or null",
  "laboratory": "Lab name or null",
  "biomarkers": [
    {
      "code": "GLUCOSE",
      "name_de": "Glukose",
      "name_en": "Glucose",
      "value": 95,
      "unit": "mg/dL",
      "reference_low": 70,
      "reference_high": 100,
      "status": "normal",
      "category": "blood_sugar"
    }
  ],
  "extraction_notes": "Any issues or uncertainties"
}

IMPORTANT:
- Return ONLY valid JSON
- Use null for values you cannot determine
- Preserve numeric precision exactly as in source
- Include ALL extracted biomarkers`;
    }

    buildRadiologyVisionPrompt(input, context) {
        const imagingType = context?.doc_type_hint || 'imaging study';

        return `You are a radiology image analysis assistant.

TASK: Analyze this ${imagingType} and extract structured findings.

ANALYSIS CHECKLIST:
1. Identify the imaging modality (X-ray, CT, MRT/MRI, Ultrasound)
2. Identify the body region/anatomy
3. Describe visible findings systematically
4. Note any abnormalities or pathological findings
5. Identify any comparison with prior studies if mentioned

OUTPUT FORMAT (JSON only):
{
  "modality": "X-ray|CT|MRT|Ultrasound|other",
  "body_region": "chest|abdomen|head|spine|extremity|other",
  "study_date": "YYYY-MM-DD or null",
  "findings": [
    {
      "location": "anatomical location",
      "observation": "what is observed",
      "significance": "normal|abnormal|uncertain",
      "description": "detailed description"
    }
  ],
  "impression": "overall impression/summary",
  "recommendations": "any follow-up recommendations if visible",
  "quality_notes": "image quality or limitations"
}

IMPORTANT:
- Focus on objective observations
- Do NOT provide diagnoses (only describe findings)
- Indicate uncertainty where appropriate
- Return ONLY valid JSON`;
    }

    buildFieldRecoveryPrompt(input, context) {
        const missingFields = context?.missingFields || ['title', 'correspondent', 'document_date'];
        const content = input?.content || input?.previousStageOutput || '';

        const fieldInstructions = [];
        if (missingFields.includes('title')) {
            fieldInstructions.push('- title: Create a concise, meaningful title (max 100 chars)');
        }
        if (missingFields.includes('correspondent')) {
            fieldInstructions.push('- correspondent: Identify the sender/issuing organization (not the recipient)');
        }
        if (missingFields.includes('document_date')) {
            fieldInstructions.push('- document_date: Extract the document date in YYYY-MM-DD format');
        }

        const outputLines = [];
        if (missingFields.includes('title')) {
            outputLines.push('"title": "extracted title or null"');
        }
        if (missingFields.includes('correspondent')) {
            outputLines.push('"correspondent": "sender name or null"');
        }
        if (missingFields.includes('document_date')) {
            outputLines.push('"document_date": "YYYY-MM-DD or null"');
        }
        outputLines.push('"confidence": 0.0-1.0');

        return `You are a document metadata extractor.

TASK: Extract the following missing fields from this document:
${fieldInstructions.join('\n')}

DOCUMENT CONTENT:
${typeof content === 'string' ? content.substring(0, 3000) : JSON.stringify(content).substring(0, 3000)}

OUTPUT FORMAT (JSON only):
{
  ${outputLines.join(',\n  ')}
}

RULES:
- Use null if you cannot determine a field
- For correspondent, use the shortest recognizable form (e.g., "Amazon" not "Amazon EU SARL")
- For dates, prefer the most prominent/relevant date
- Return ONLY valid JSON`;
    }

    buildJsonRepairPrompt(rawText) {
        return `Extract the valid JSON object from the text below.
Rules:
- Ignore any <thinking>, <think>, or <reasoning> blocks or non-JSON content.
- Return ONLY the JSON object (no markdown, no commentary).
- Do NOT include Markdown code fences in your output; provide raw JSON only.
- If multiple JSON objects appear, return the most complete one.

TEXT:
${rawText}`;
    }

    buildMedicalExtractionPrompt(content, fields) {
        const fieldList = fields ? Object.keys(fields).join(', ') : 'title, correspondent, document_date, document_type, tags';

        const template = this._getTemplate('medical_extraction', 'en');
        if (template?.systemInstruction) {
            return this._renderTemplate(template.systemInstruction, {
                field_list: fieldList,
                content
            });
        }

        return `You are a medical document analyzer.

TASK: Extract structured information from this medical document.

REQUIRED FIELDS: ${fieldList}

DOCUMENT CONTENT:
${content}

EXTRACTION RULES:
1. Identify document type (Befund, Arztbrief, Rezept, Laborwerte, etc.)
2. Extract patient-related dates (not print/scan dates)
3. Identify the medical provider/institution
4. Tag with relevant medical categories
5. For lab values, note if any are flagged abnormal

OUTPUT FORMAT (JSON only):
{
  "title": "Document title",
  "correspondent": "Medical provider/institution",
  "document_date": "YYYY-MM-DD",
  "document_type": "Lab Report|Medical Letter|Prescription|etc.",
  "language": "de|en",
  "tags": ["medical", "specific-category"],
  "custom_fields": {
    // Any extracted lab values or medical data
  },
  "medical_summary": {
    "provider_type": "laboratory|hospital|clinic|doctor",
    "has_abnormal_values": true|false,
    "urgency_indicators": []
  }
}

IMPORTANT:
- Return ONLY valid JSON
- Use null for unknown values
- Preserve medical terminology`;
    }

    getBiomarkerSchema() {
        return {
            type: "object",
            properties: {
                test_date: { type: ["string", "null"], format: "date" },
                laboratory: { type: ["string", "null"] },
                biomarkers: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            code: { type: "string" },
                            name_de: { type: "string" },
                            name_en: { type: "string" },
                            value: { type: "number" },
                            unit: { type: "string" },
                            reference_low: { type: ["number", "null"] },
                            reference_high: { type: ["number", "null"] },
                            status: { type: "string", enum: ["normal", "high", "low", "critical"] },
                            category: { type: "string" }
                        },
                        required: ["code", "value", "unit", "status"]
                    }
                }
            },
            required: ["biomarkers"]
        };
    }

    buildGenericAssistantPrompt() {
        return 'You are a helpful assistant. Generate a clear, concise, and informative response to the user\'s question or request.';
    }

    getFieldSchema(profileId) {
        if (!this.fieldProfiler) return null;
        return this.fieldProfiler.generateExtractionSchema(profileId);
    }

    buildFieldInstructions(fields) {
        if (!fields || typeof fields !== 'object') return '';
        const keys = Object.keys(fields);
        if (keys.length === 0) return '';
        return `Return ONLY JSON with keys: ${keys.join(', ')}.`;
    }

    validatePromptLength(prompt, maxTokens) {
        const tokens = this._estimateTokens(prompt);
        return tokens <= maxTokens;
    }

    _estimateTokens(text) {
        if (!text || typeof text !== 'string') return 0;
        return Math.ceil(text.length / 3.5);
    }

    _generateCustomFieldsTemplate() {
        try {
            const obj = JSON.parse(process.env.CUSTOM_FIELDS || '{"custom_fields":[]}');
            const tpl = {};
            obj.custom_fields.forEach((field) => {
                if (field?.value) {
                    tpl[field.value] = null;
                }
            });
            return '"custom_fields": ' + JSON.stringify(tpl, null, 2).split('\n').map(l => '    ' + l).join('\n');
        } catch (e) {
            return "";
        }
    }
}

module.exports = PromptFactory;
