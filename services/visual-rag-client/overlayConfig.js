/**
 * overlayConfig.js
 *
 * Visual RAG Overlay Configuration
 * Domain-specific color codes, field specifications, and paperless-ngx mappings.
 *
 * Architecture Reference: PROMPT-008 (Visual RAG UI Enhancement)
 *
 * Color Scheme:
 * - FINANCIAL: Oranges (#FFF7ED → #9A3412)
 * - MEDICAL: Greens/Teals (#BBF7D0 → #065F46)
 * - LEGAL: Purples (#E9D5FF → #581C87)
 * - GENERAL: Blues (#93C5FD → #1D4ED8)
 */

/**
 * Domain color palettes for overlay visualization
 */
const DOMAIN_COLORS = Object.freeze({
    FINANCIAL: {
        primary: '#F97316',  // Orange-500
        range: ['#FFF7ED', '#FDBA74', '#F97316', '#C2410C', '#9A3412']
    },
    MEDICAL: {
        primary: '#22C55E',  // Green-500
        range: ['#BBF7D0', '#86EFAC', '#22C55E', '#15803D', '#065F46']
    },
    LEGAL: {
        primary: '#A855F7',  // Purple-500
        range: ['#E9D5FF', '#C084FC', '#A855F7', '#7E22CE', '#581C87']
    },
    GENERAL: {
        primary: '#3B82F6',  // Blue-500
        range: ['#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8']
    }
});

/**
 * Domain-specific field specifications with paperless-ngx mappings
 */
const DOMAIN_FIELD_SPECS = Object.freeze({
    financial: {
        name: 'FINANCIAL',
        mandatory: ['inv_date', 'sender', 'invoice_number'],
        fields: {
            inv_date: { label: 'Inv Date', color: '#FDBA74', mapping: 'created' },
            sender: { label: 'Sender', color: '#FED7AA', mapping: 'correspondent' },
            invoice_number: { label: 'Invoice #', color: '#9A3412', mapping: 'title' },
            total: { label: 'Total', color: '#C2410C', mapping: 'custom_field: invoice_total' },
            net: { label: 'Net', color: '#EA580C', mapping: 'custom_field: invoice_net' },
            vat: { label: 'VAT', color: '#F97316', mapping: 'custom_field: invoice_vat' },
            due_date: { label: 'Due Date', color: '#FDBA74', mapping: 'custom_field: due_date' },
            receiver: { label: 'Receiver', color: '#FED7AA', mapping: 'metadata' },
            sender_uid: { label: 'Sender UID', color: '#FFF7ED', mapping: 'custom_field: vat_id' },
            iban: { label: 'IBAN', color: '#FB923C', mapping: 'custom_field: iban' },
            line_items: { label: 'Line Items', color: '#FFEDD5', mapping: 'content' }
        }
    },
    medical: {
        name: 'MEDICAL',
        mandatory: ['doc_date', 'zuweiser', 'behandler', 'type_subj'],
        fields: {
            doc_date: { label: 'Doc Date', color: '#BBF7D0', mapping: 'created' },
            zuweiser: { label: 'Zuweiser', color: '#0D9488', mapping: 'correspondent' },
            behandler: { label: 'Behandler', color: '#14B8A6', mapping: 'correspondent' },
            type_subj: { label: 'Type/Subj', color: '#065F46', mapping: 'title' },
            patient: { label: 'Patient', color: '#15803D', mapping: 'custom_field: patient_name' },
            dob: { label: 'DOB', color: '#16A34A', mapping: 'custom_field: patient_dob' },
            diagnosis: { label: 'Diagnosis', color: '#22C55E', mapping: 'tags' },
            meds: { label: 'Meds', color: '#4ADE80', mapping: 'custom_field: medication' },
            lab_val: { label: 'Lab Val', color: '#86EFAC', mapping: 'content' },
            signature: { label: 'Signature', color: '#059669', mapping: 'metadata' }
        }
    },
    legal: {
        name: 'LEGAL',
        mandatory: ['start_date', 'party_1', 'doc_type'],
        fields: {
            start_date: { label: 'Start Date', color: '#A855F7', mapping: 'created' },
            party_1: { label: 'Party 1', color: '#7E22CE', mapping: 'correspondent' },
            doc_type: { label: 'Doc Type', color: '#581C87', mapping: 'title' },
            party_2: { label: 'Party 2', color: '#9333EA', mapping: 'metadata' },
            valid_from: { label: 'Valid From', color: '#C084FC', mapping: 'custom_field: valid_from' },
            valid_until: { label: 'Valid Until', color: '#D8B4FE', mapping: 'custom_field: valid_until' },
            law: { label: 'Law', color: '#E9D5FF', mapping: 'custom_field: jurisdiction' },
            clause: { label: 'Clause', color: '#A78BFA', mapping: 'content' },
            notary_seal: { label: 'Notary Seal', color: '#6D28D9', mapping: 'metadata' }
        }
    },
    general: {
        name: 'GENERAL',
        mandatory: ['date', 'sender', 'subject'],
        fields: {
            date: { label: 'Date', color: '#2563EB', mapping: 'created' },
            sender: { label: 'Sender', color: '#1D4ED8', mapping: 'correspondent' },
            subject: { label: 'Subject', color: '#3B82F6', mapping: 'title' },
            recipient: { label: 'Recipient', color: '#60A5FA', mapping: 'metadata' },
            tags: { label: 'Tags', color: '#93C5FD', mapping: 'tags' },
            signature: { label: 'Signature', color: '#1E40AF', mapping: 'metadata' },
            logo: { label: 'Logo', color: '#BFDBFE', mapping: 'metadata' },
            stamp: { label: 'Stamp', color: '#DBEAFE', mapping: 'metadata' }
        }
    }
});

/**
 * Label aliases for mapping common detection labels to domain fields
 */
const LABEL_ALIASES = Object.freeze({
    // Financial aliases
    'invoice number': 'invoice_number',
    'invoice #': 'invoice_number',
    'invoice_no': 'invoice_number',
    'invoice date': 'inv_date',
    'date': 'inv_date',
    'total amount': 'total',
    'amount': 'total',
    'vat amount': 'vat',
    'tax': 'vat',
    'company': 'sender',
    'vendor': 'sender',

    // Medical aliases
    'doctor': 'behandler',
    'physician': 'behandler',
    'referrer': 'zuweiser',
    'referring physician': 'zuweiser',
    'patient name': 'patient',
    'patient info': 'patient',
    'date of birth': 'dob',
    'birth date': 'dob',
    'lab values': 'lab_val',
    'lab results': 'lab_val',
    'medication': 'meds',
    'prescription': 'meds',
    'document date': 'doc_date',

    // Legal aliases
    'contract date': 'start_date',
    'effective date': 'start_date',
    'document type': 'doc_type',
    'contract type': 'doc_type',
    'first party': 'party_1',
    'second party': 'party_2',
    'expiration date': 'valid_until',
    'end date': 'valid_until',
    'jurisdiction': 'law',

    // General aliases
    'from': 'sender',
    'to': 'recipient',
    'title': 'subject',
    'table': 'content',
    'handwriting': 'content'
});

/**
 * Normalize label to match field key
 * @param {string} label - Raw label from detection
 * @returns {string} Normalized label
 */
function normalizeLabel(label) {
    if (!label) return '';
    const normalized = label.toLowerCase().trim().replace(/[\s/]+/g, '_');

    // Check aliases first
    if (LABEL_ALIASES[label.toLowerCase().trim()]) {
        return LABEL_ALIASES[label.toLowerCase().trim()];
    }

    return normalized;
}

/**
 * Get field specification for a label in a domain
 * @param {string} label - Detection label
 * @param {string} domain - Domain name
 * @returns {Object|null} Field spec or null
 */
function getFieldSpec(label, domain) {
    const spec = DOMAIN_FIELD_SPECS[domain?.toLowerCase()];
    if (!spec) return null;

    const normalized = normalizeLabel(label);

    // Direct match on field key
    if (spec.fields[normalized]) {
        return { key: normalized, ...spec.fields[normalized] };
    }

    // Match on label text
    for (const [key, field] of Object.entries(spec.fields)) {
        if (field.label.toLowerCase().replace(/[\s/]+/g, '_') === normalized) {
            return { key, ...field };
        }
    }

    return null;
}

/**
 * Get color for a label in a domain
 * @param {string} label - Detection label
 * @param {string} domain - Domain name
 * @returns {string} Hex color code
 */
function getColorForLabel(label, domain) {
    const fieldSpec = getFieldSpec(label, domain);
    if (fieldSpec) {
        return fieldSpec.color;
    }

    // Fallback to domain primary color
    const spec = DOMAIN_FIELD_SPECS[domain?.toLowerCase()];
    if (spec) {
        return DOMAIN_COLORS[spec.name]?.primary || '#6B7280';
    }

    return '#6B7280'; // Gray fallback
}

/**
 * Get paperless-ngx mapping for a label
 * @param {string} label - Detection label
 * @param {string} domain - Domain name
 * @returns {string|null} Mapping or null
 */
function getPaperlessMapping(label, domain) {
    const fieldSpec = getFieldSpec(label, domain);
    return fieldSpec?.mapping || null;
}

/**
 * Check if a field is mandatory for the domain
 * @param {string} label - Detection label
 * @param {string} domain - Domain name
 * @returns {boolean}
 */
function isMandatoryField(label, domain) {
    const spec = DOMAIN_FIELD_SPECS[domain?.toLowerCase()];
    if (!spec) return false;

    const fieldSpec = getFieldSpec(label, domain);
    if (!fieldSpec) return false;

    return spec.mandatory.includes(fieldSpec.key);
}

/**
 * Get legend data for a domain (for UI display)
 * @param {string} domain - Domain name
 * @returns {Array<Object>} Array of legend items
 */
function getLegendForDomain(domain) {
    const spec = DOMAIN_FIELD_SPECS[domain?.toLowerCase()];
    if (!spec) return [];

    return Object.entries(spec.fields).map(([key, field]) => ({
        key,
        label: field.label,
        color: field.color,
        mapping: field.mapping,
        isMandatory: spec.mandatory.includes(key)
    }));
}

/**
 * Get all mandatory fields for a domain
 * @param {string} domain - Domain name
 * @returns {Array<Object>} Array of mandatory field specs
 */
function getMandatoryFields(domain) {
    const spec = DOMAIN_FIELD_SPECS[domain?.toLowerCase()];
    if (!spec) return [];

    return spec.mandatory.map(key => ({
        key,
        ...spec.fields[key]
    }));
}

/**
 * Get domain name (uppercase) from lowercase key
 * @param {string} domain - Domain key (e.g., 'financial')
 * @returns {string} Domain name (e.g., 'FINANCIAL')
 */
function getDomainName(domain) {
    const spec = DOMAIN_FIELD_SPECS[domain?.toLowerCase()];
    return spec?.name || 'GENERAL';
}

module.exports = {
    DOMAIN_COLORS,
    DOMAIN_FIELD_SPECS,
    LABEL_ALIASES,
    normalizeLabel,
    getFieldSpec,
    getColorForLabel,
    getPaperlessMapping,
    isMandatoryField,
    getLegendForDomain,
    getMandatoryFields,
    getDomainName
};
