/**
 * FieldProfiler - Core component for Visual RAG pipeline
 *
 * Purpose: Select minimal field sets based on document classification.
 * Position in pipeline: Planner → [FieldProfiler] → Extractor
 *
 * Design principles:
 * - Backend-controlled, deterministic
 * - AI may assist ONLY in selecting a profile ID from allowlist
 * - Field names are NEVER invented at runtime
 * - Rule-based first, AI-assisted profile selection optional
 */

const fs = require('fs').promises;
const path = require('path');

// ============================================================================
//  FIELD REGISTRY & PROFILES (loaded from JSON)
// ============================================================================

let fieldRegistry = null;
let profiles = null;

async function loadSchemas() {
    if (fieldRegistry && profiles) return;

    const schemasPath = path.join(__dirname, '../../config/schemas');

    fieldRegistry = JSON.parse(
        await fs.readFile(path.join(schemasPath, 'fieldRegistry.json'), 'utf-8')
    );
    profiles = JSON.parse(
        await fs.readFile(path.join(schemasPath, 'profiles.json'), 'utf-8')
    );

    console.log(`[FieldProfiler] Loaded ${Object.keys(fieldRegistry.fields).length} fields, ${Object.keys(profiles.profiles).length} profiles`);
}

// ============================================================================
//  FIELD PROFILER CLASS
// ============================================================================

class FieldProfiler {
    constructor(options = {}) {
        this.options = {
            defaultProfile: 'general',
            strictMode: true,  // Only allow fields from selected profile
            ...options
        };

        this.initialized = false;
    }

    /**
     * Initialize profiler (load schemas)
     */
    async init() {
        if (this.initialized) return;
        await loadSchemas();
        this.initialized = true;
    }

    // ========================================================================
    //  PROFILE SELECTION (Rule-based)
    // ========================================================================

    /**
     * Select profile based on document classification
     * @param {Object} classification - Output from Planner stage
     * @returns {string} Profile ID
     */
    selectProfile(classification) {
        const { category, confidence, keywords } = classification;

        // Direct category mapping
        const categoryMap = {
            'medical': 'medical',
            'health': 'medical',
            'financial': 'financial',
            'invoice': 'financial',
            'receipt': 'financial',
            'bank': 'financial',
            'legal': 'legal',
            'contract': 'legal',
            'technical': 'technical',
            'manual': 'technical',
            'specification': 'technical',
            'personal': 'personal',
            'correspondence': 'personal'
        };

        // Check direct mapping first
        const normalizedCategory = (category || '').toLowerCase();
        if (categoryMap[normalizedCategory]) {
            return categoryMap[normalizedCategory];
        }

        // Keyword-based fallback
        if (keywords && Array.isArray(keywords)) {
            for (const keyword of keywords) {
                const normalizedKeyword = keyword.toLowerCase();
                if (categoryMap[normalizedKeyword]) {
                    return categoryMap[normalizedKeyword];
                }
            }
        }

        return this.options.defaultProfile;
    }

    /**
     * Get list of valid profile IDs (for AI-assisted selection)
     * @returns {string[]} Array of valid profile IDs
     */
    getValidProfileIds() {
        return Object.keys(profiles.profiles);
    }

    // ========================================================================
    //  FIELD SET GENERATION
    // ========================================================================

    /**
     * Get field set for a profile
     * @param {string} profileId - Profile ID
     * @returns {Object} Field definitions for extraction
     */
    getFieldSet(profileId) {
        const profile = profiles.profiles[profileId];
        if (!profile) {
            console.warn(`[FieldProfiler] Unknown profile: ${profileId}, using default`);
            return this.getFieldSet(this.options.defaultProfile);
        }

        const result = {
            profileId,
            profileName: profile.name,
            coreFields: {},
            customFields: {},
            extractionHints: profile.extractionHints || {}
        };

        // Add core fields (always present)
        for (const fieldId of profile.coreFields || []) {
            const field = fieldRegistry.fields[fieldId];
            if (field) {
                result.coreFields[fieldId] = { ...field };
            }
        }

        // Add custom fields (domain-specific)
        for (const fieldId of profile.customFields || []) {
            const field = fieldRegistry.fields[fieldId];
            if (field) {
                result.customFields[fieldId] = { ...field };
            }
        }

        return result;
    }

    /**
     * Generate JSON schema for extraction prompt
     * @param {string} profileId - Profile ID
     * @returns {Object} JSON schema for LLM output
     */
    generateExtractionSchema(profileId) {
        const fieldSet = this.getFieldSet(profileId);

        const properties = {};
        const required = [];

        // Core fields
        for (const [fieldId, field] of Object.entries(fieldSet.coreFields)) {
            properties[fieldId] = this._fieldToSchemaProperty(field);
            if (field.required) {
                required.push(fieldId);
            }
        }

        // Custom fields container
        if (Object.keys(fieldSet.customFields).length > 0) {
            const customFieldsProperties = {};
            for (const [fieldId, field] of Object.entries(fieldSet.customFields)) {
                customFieldsProperties[fieldId] = this._fieldToSchemaProperty(field);
            }

            properties.custom_fields = {
                type: 'object',
                properties: customFieldsProperties,
                additionalProperties: false
            };
        }

        return {
            type: 'object',
            properties,
            required,
            additionalProperties: false  // Strict: no invented fields
        };
    }

    /**
     * Convert field definition to JSON schema property
     * @private
     */
    _fieldToSchemaProperty(field) {
        const prop = {
            type: field.type || 'string',
            description: field.description
        };

        if (field.enum) {
            prop.enum = field.enum;
        }

        if (field.format) {
            prop.format = field.format;
        }

        if (field.type === 'array') {
            prop.items = { type: field.itemType || 'string' };
        }

        return prop;
    }

    // ========================================================================
    //  PROMPT GENERATION
    // ========================================================================

    /**
     * Generate extraction prompt for a profile
     * @param {string} profileId - Profile ID
     * @param {Object} options - Additional options
     * @returns {string} System prompt for extractor
     */
    generateExtractionPrompt(profileId, options = {}) {
        const fieldSet = this.getFieldSet(profileId);
        const schema = this.generateExtractionSchema(profileId);

        const profile = profiles.profiles[profileId];
        const hints = fieldSet.extractionHints;

        let prompt = `You are a ${profile.name} document extractor.\n\n`;

        // Add domain-specific instructions
        if (profile.instructions) {
            prompt += `Domain instructions:\n${profile.instructions}\n\n`;
        }

        // Add extraction hints
        if (hints && Object.keys(hints).length > 0) {
            prompt += `Field extraction hints:\n`;
            for (const [fieldId, hint] of Object.entries(hints)) {
                prompt += `- ${fieldId}: ${hint}\n`;
            }
            prompt += `\n`;
        }

        // Add output schema
        prompt += `Extract ONLY these fields. Output JSON matching this schema:\n`;
        prompt += `\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\`\n\n`;

        // Add constraints
        prompt += `Constraints:\n`;
        prompt += `- Output ONLY valid JSON, no explanations\n`;
        prompt += `- Do NOT invent fields not in the schema\n`;
        prompt += `- Use null for fields you cannot extract\n`;
        prompt += `- Dates must be YYYY-MM-DD format\n`;
        prompt += `- Numbers must be plain (no currency symbols)\n`;

        return prompt;
    }

    // ========================================================================
    //  VALIDATION
    // ========================================================================

    /**
     * Validate extraction result against profile schema
     * @param {Object} result - Extraction result from LLM
     * @param {string} profileId - Profile ID
     * @returns {Object} Validation result
     */
    validateResult(result, profileId) {
        const fieldSet = this.getFieldSet(profileId);
        const errors = [];
        const warnings = [];

        if (!result || typeof result !== 'object') {
            return { valid: false, errors: ['Result is not an object'], warnings: [] };
        }

        // Check required core fields
        for (const [fieldId, field] of Object.entries(fieldSet.coreFields)) {
            if (field.required && (result[fieldId] === undefined || result[fieldId] === null)) {
                errors.push(`Missing required field: ${fieldId}`);
            }
        }

        // Check for unexpected fields (strict mode)
        if (this.options.strictMode) {
            const allowedFields = new Set([
                ...Object.keys(fieldSet.coreFields),
                'custom_fields'
            ]);

            for (const key of Object.keys(result)) {
                if (!allowedFields.has(key)) {
                    warnings.push(`Unexpected field: ${key} (will be ignored)`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}

// ============================================================================
//  EXPORTS
// ============================================================================

module.exports = FieldProfiler;

// Also export utility for profile listing
module.exports.getAvailableProfiles = async () => {
    await loadSchemas();
    return Object.entries(profiles.profiles).map(([id, profile]) => ({
        id,
        name: profile.name,
        description: profile.description
    }));
};
