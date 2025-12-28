const DEFAULT_LANGUAGE = 'en';

const ROUTER_CLASSIFIER_BASE = 'AT/DE doc classifier. Choose ONE: financial, medical, legal, technical, personal, general. Hints: financial=Rechnung/Quittung/Honorarnote/Bank, medical=Befund/Rezept/Arztbrief, legal=Vertrag/Vereinbarung/GZ, technical=Anleitung/Datenblatt, personal=Brief/Mitteilung/Schreiben. If medical, set modality: lab|radiology|prescription|unknown. Modality hints: lab=Laborwerte/Blutbild/Befund tables, radiology=X-ray/CT/MRT/Roentgen, prescription=Rezept/Verordnung. Return ONLY JSON: {"category":"financial|medical|legal|technical|personal|general","doc_type_hint":"invoice|lab_report|contract|...","modality":"lab|radiology|prescription|unknown","confidence":0-1,"keywords":["..."],"needs_visual":true|false}. Rules: doc_type_hint specific; confidence>=0.8 clear, 0.5-0.8 maybe, <0.5 unsure; keywords 2-5 DE/EN; needs_visual true if tables/forms/stamps/complex layout.';

const MEDICAL_EXTRACTION_TEMPLATE = `You are a medical document analyzer.

TASK: Extract structured information from this medical document.

REQUIRED FIELDS: {{field_list}}

DOCUMENT CONTENT:
{{content}}

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

const FINANCIAL_EXTRACTION_TEMPLATE = `You are a multilingual financial document extraction assistant.

TASK: Extract structured financial data from this document.

DOCUMENT CONTENT:
{{content}}

OUTPUT FORMAT (JSON only):
{
  "document_type": "invoice|receipt|statement|tax_form|other",
  "language": "en|de|fr|other",
  "parties": {
    "issuer": {"name": "<name>", "tax_id": "<id or null>", "address": "<address or null>"},
    "recipient": {"name": "<name>", "tax_id": "<id or null>", "address": "<address or null>"}
  },
  "dates": {
    "document_date": "YYYY-MM-DD or null",
    "due_date": "YYYY-MM-DD or null"
  },
  "amounts": {
    "subtotal": <number or null>,
    "tax": <number or null>,
    "total": <number or null>,
    "currency": "EUR|USD|CHF|other",
    "tax_rate_percent": <number or null>
  },
  "reference_numbers": {
    "invoice_number": "<value or null>",
    "customer_number": "<value or null>",
    "iban": "<value or null>"
  },
  "confidence": 0.0
}

RULES:
- Return ONLY valid JSON
- Use null when unknown
- Do not invent values`;

const CHAT_DE_SYSTEM = 'Du bist ein hilfreicher Assistent. Antworte klar, knapp und sachlich. Wenn Informationen fehlen, sage es offen.';
const CHAT_DE_USER = 'Benutzerfrage:\n{{question}}';

const SUMMARY_DE_SYSTEM = 'Du bist ein Zusammenfassungs-Assistent. Erstelle eine kurze, praezise Zusammenfassung.';
const SUMMARY_DE_USER = 'Text:\n{{content}}\n\nGib eine kurze Zusammenfassung auf Deutsch.';

class TemplateRegistry {
    constructor(options = {}) {
        this.templates = new Map();
        const includeDefaults = options.includeDefaults !== false;
        if (includeDefaults) {
            this._registerDefaults();
        }
    }

    _normalizeIntent(intent) {
        return String(intent || '').trim().toLowerCase();
    }

    _normalizeLang(lang) {
        return String(lang || '').trim().toLowerCase();
    }

    _key(intent, lang) {
        return `${intent}:${lang}`;
    }

    register(template, opts = {}) {
        if (!template) {
            throw new Error('Template is required');
        }

        const intent = this._normalizeIntent(template.intent);
        const lang = this._normalizeLang(template.lang || DEFAULT_LANGUAGE);
        const systemInstruction = template.systemInstruction || '';
        const userInstruction = template.userInstruction || '';

        if (!intent || !lang) {
            throw new Error('Template intent and lang are required');
        }
        if (!systemInstruction && !userInstruction) {
            throw new Error('Template must include systemInstruction or userInstruction');
        }

        const key = this._key(intent, lang);
        if (this.templates.has(key) && !opts.overwrite) {
            throw new Error(`Template already registered for ${intent}:${lang}`);
        }

        const entry = {
            intent,
            lang,
            version: template.version || '1.0.0',
            systemInstruction: systemInstruction,
            userInstruction: userInstruction,
            registeredAt: Date.now()
        };

        this.templates.set(key, entry);
        return entry;
    }

    get(intent, lang = DEFAULT_LANGUAGE) {
        const normalizedIntent = this._normalizeIntent(intent);
        const normalizedLang = this._normalizeLang(lang || DEFAULT_LANGUAGE);
        if (!normalizedIntent) return null;
        const key = this._key(normalizedIntent, normalizedLang);
        return this.templates.get(key) || null;
    }

    has(intent, lang = DEFAULT_LANGUAGE) {
        return Boolean(this.get(intent, lang));
    }

    list() {
        return Array.from(this.templates.values());
    }

    getByIntent(intent) {
        const normalizedIntent = this._normalizeIntent(intent);
        if (!normalizedIntent) return [];
        return this.list().filter(template => template.intent === normalizedIntent);
    }

    _registerDefaults() {
        this.register({
            intent: 'router_classifier',
            lang: 'de',
            version: '1.0.0',
            systemInstruction: ROUTER_CLASSIFIER_BASE
        });

        this.register({
            intent: 'router_classifier_strict',
            lang: 'de',
            version: '1.0.0',
            systemInstruction: `${ROUTER_CLASSIFIER_BASE} STRICT MODE: JSON only, no extra keys.`
        });

        this.register({
            intent: 'medical_extraction',
            lang: 'en',
            version: '1.0.0',
            systemInstruction: MEDICAL_EXTRACTION_TEMPLATE
        });

        this.register({
            intent: 'financial_extraction',
            lang: 'en',
            version: '1.0.0',
            systemInstruction: FINANCIAL_EXTRACTION_TEMPLATE
        });

        this.register({
            intent: 'chat',
            lang: 'de',
            version: '1.0.0',
            systemInstruction: CHAT_DE_SYSTEM,
            userInstruction: CHAT_DE_USER
        });

        this.register({
            intent: 'summary',
            lang: 'de',
            version: '1.0.0',
            systemInstruction: SUMMARY_DE_SYSTEM,
            userInstruction: SUMMARY_DE_USER
        });
    }
}

const templateRegistry = new TemplateRegistry();

module.exports = {
    TemplateRegistry,
    templateRegistry
};
