/**
 * OverlayExtractor.js
 *
 * Extracts bounding boxes and visual elements from documents using Qwen3-VL.
 * Produces overlay data for the Visual RAG UI visualization.
 *
 * Architecture Reference: PROMPT-003 (Dual-Path Ingestion, Step 2)
 *
 * Output Format (Visual RAG Detection Agent):
 * [
 *   {
 *     id: "uuid",
 *     label: "Total",
 *     value: "1.250,00 EUR",
 *     domain: "FINANCIAL",
 *     color: "#C2410C",
 *     boundingBox: { x: 300, y: 800, width: 100, height: 30 },
 *     paperlessMapping: "custom_field: invoice_total",
 *     isMandatory: false,
 *     confidence: 0.92,
 *     pageNumber: 1,
 *     box: [300, 800, 400, 830]  // Legacy format [xmin, ymin, xmax, ymax]
 *   }
 * ]
 *
 * Coordinate System:
 * - Legacy array `box`: [xmin, ymin, xmax, ymax] in 0-1000 range
 * - Bounding boxes are normalized downstream to UI 0..1 coordinates
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../logger');
const config = require('../../config/config');
const { jsonrepair } = require('jsonrepair');
const {
    DOMAIN_FIELD_SPECS,
    getColorForLabel,
    getPaperlessMapping,
    isMandatoryField,
    getDomainName,
    normalizeLabel
} = require('./overlayConfig');

// Prompt template for bounding box detection
const BOUNDING_BOX_PROMPT = `Analyze this document image and detect the following visual elements with their bounding box coordinates.

Elements to detect:
- Signature (handwritten signatures)
- Date (document dates, issue dates, due dates)
- Total (total amounts, sum values)
- IBAN (bank account numbers)
- Logo (company logos, letterheads)
- Stamp (official stamps, seals)
- Table (data tables, grids)
- Handwriting (any handwritten text)

For each detected element, provide:
1. label: The element type (signature, date, total, iban, logo, stamp, table, handwriting)
2. box: Bounding box coordinates as [xmin, ymin, xmax, ymax] in range 0-1000
3. confidence: Detection confidence 0.0-1.0
4. text: (optional) Any readable text within the element

Output ONLY valid JSON array. Example:
[
  {"label": "signature", "box": [600, 850, 950, 920], "confidence": 0.95},
  {"label": "date", "box": [700, 50, 900, 80], "confidence": 0.88, "text": "2024-01-15"},
  {"label": "total", "box": [400, 750, 600, 800], "confidence": 0.92, "text": "€1,234.56"}
]

If no elements are detected, output: []`;

/**
 * Build domain-specific prompt extension from field specs
 * @param {string} domain - Domain key
 * @returns {string} Prompt extension
 */
function buildDomainPrompt(domain) {
    const spec = DOMAIN_FIELD_SPECS[domain];
    if (!spec) return '';

    const mandatoryList = spec.mandatory
        .map(key => spec.fields[key]?.label)
        .filter(Boolean)
        .join(', ');

    const fieldList = Object.entries(spec.fields)
        .map(([key, field]) => {
            const mandatory = spec.mandatory.includes(key) ? ' [MANDATORY]' : '';
            return `- ${field.label}${mandatory}`;
        })
        .join('\n');

    return `
Domain: ${spec.name}
Mandatory fields (must detect if present): ${mandatoryList}

Fields to detect for ${spec.name} documents:
${fieldList}

Use exact labels from the list above. Mark confidence higher for mandatory fields when clearly visible.`;
}

// Domain-specific prompt extensions (generated from field specs)
const DOMAIN_PROMPTS = {
    financial: buildDomainPrompt('financial'),
    medical: buildDomainPrompt('medical'),
    legal: buildDomainPrompt('legal'),
    general: buildDomainPrompt('general')
};

class OverlayExtractor {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || config.ollama.apiUrl;
        this.visionModel = options.visionModel || config.ollama.visionModel;
        this.keepAlive = options.keepAlive || config.ollama.visionKeepAlive || '5m';
        this.timeout = options.timeout || 60000;

        this.client = axios.create({
            baseURL: this.apiUrl,
            timeout: this.timeout
        });
    }

    /**
     * Extract bounding boxes from a document image
     * @param {string} base64Image - Base64 encoded image
     * @param {Object} options - Extraction options
     * @param {string} options.domain - Document domain (medical, financial, legal)
     * @param {number} options.pageNumber - Page number for metadata
     * @returns {Promise<Array<Object>>} Array of overlay objects
     */
    async extractOverlays(base64Image, options = {}) {
        const { domain, pageNumber = 1 } = options;

        if (!base64Image) {
            throw new Error('Base64 image is required');
        }

        try {
            logger.info(`[OverlayExtractor] Extracting overlays for page ${pageNumber} (domain: ${domain || 'general'})`);

            // Build domain-specific prompt
            let prompt = BOUNDING_BOX_PROMPT;
            if (domain && DOMAIN_PROMPTS[domain]) {
                prompt += '\n' + DOMAIN_PROMPTS[domain];
            }

            // Call Qwen3-VL
            const response = await this._callVisionAPI(prompt, base64Image);

            // Parse response with domain for color/mapping lookup
            const overlays = this._parseOverlays(response, pageNumber, domain);

            logger.info(`[OverlayExtractor] Extracted ${overlays.length} overlays from page ${pageNumber}`);

            return overlays;
        } catch (error) {
            logger.error(`[OverlayExtractor] Extraction failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Extract overlays from multiple pages
     * @param {Array<string>} base64Images - Array of base64 encoded images
     * @param {Object} options - Extraction options
     * @returns {Promise<Array<Object>>} Array of overlay objects with page numbers
     */
    async extractOverlaysMultiPage(base64Images, options = {}) {
        const allOverlays = [];

        for (let i = 0; i < base64Images.length; i++) {
            const pageNumber = i + 1;

            try {
                const pageOverlays = await this.extractOverlays(base64Images[i], {
                    ...options,
                    pageNumber
                });

                allOverlays.push(...pageOverlays);
            } catch (error) {
                logger.warn(`[OverlayExtractor] Failed to extract page ${pageNumber}: ${error.message}`);
                // Continue with other pages
            }
        }

        return allOverlays;
    }

    /**
     * Call Ollama Vision API
     * @private
     */
    async _callVisionAPI(prompt, base64Image) {
        const images = Array.isArray(base64Image) ? base64Image : [base64Image];

        try {
            const response = await this.client.post('/api/generate', {
                model: this.visionModel,
                prompt: prompt,
                images: images.filter(Boolean),
                keep_alive: this.keepAlive,
                stream: false,
                options: {
                    num_ctx: config.expertModels?.legal?.vision?.limits?.contextWindow || 32768,
                    num_predict: config.expertModels?.legal?.vision?.limits?.maxResponseTokens || 4096,
                    temperature: 0.1   // Low temperature for consistent detection
                }
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`Vision API error: ${error.response.status} - ${error.response.data?.error || 'Unknown error'}`);
            }
            throw new Error(`Vision API request failed: ${error.message}`);
        }
    }

    /**
     * Parse overlay response from Qwen3-VL
     * @private
     */
    _parseOverlays(response, pageNumber, domain = 'general') {
        const rawText = response.response || '';

        logger.debug(`[OverlayExtractor] Raw response length: ${rawText.length}`);
        logger.debug(`[OverlayExtractor] Raw response preview: ${rawText.substring(0, 200)}`);

        // Extract JSON from response
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            logger.debug('[OverlayExtractor] No JSON array found in response');
            return [];
        }

        logger.debug(`[OverlayExtractor] Found JSON: ${jsonMatch[0].substring(0, 100)}...`);

        try {
            let jsonPayload = jsonMatch[0];
            try {
                jsonPayload = jsonrepair(jsonPayload);
            } catch (repairError) {
                logger.debug(`[OverlayExtractor] JSON repair skipped: ${repairError.message}`);
            }
            const overlays = JSON.parse(jsonPayload);

            if (!Array.isArray(overlays)) {
                logger.debug('[OverlayExtractor] Parsed result is not an array');
                return [];
            }

            logger.debug(`[OverlayExtractor] Parsed ${overlays.length} raw overlays`);

            // Validate and normalize overlays
            const validated = overlays.filter(o => {
                const valid = this._isValidOverlay(o);
                if (!valid) {
                    logger.debug(`[OverlayExtractor] Invalid overlay rejected: ${JSON.stringify(o)}`);
                }
                return valid;
            });

            logger.debug(`[OverlayExtractor] ${validated.length} overlays passed validation`);

            return validated.map(o => this._normalizeOverlay(o, pageNumber, domain));
        } catch (error) {
            logger.warn(`[OverlayExtractor] Failed to parse JSON: ${error.message}`);
            return [];
        }
    }

    /**
     * Validate overlay object
     * @private
     */
    _isValidOverlay(overlay) {
        if (!overlay || typeof overlay !== 'object') {
            return false;
        }

        // Must have label
        if (!overlay.label || typeof overlay.label !== 'string') {
            return false;
        }

        // Must have box array with 4 numbers
        if (!Array.isArray(overlay.box) || overlay.box.length !== 4) {
            return false;
        }

        // All box values must be numbers
        if (!overlay.box.every(v => typeof v === 'number' && !isNaN(v))) {
            return false;
        }

        return true;
    }

    /**
     * Normalize overlay coordinates and structure
     * Produces new Visual RAG format with backwards-compatible legacy fields
     * @private
     */
    _normalizeOverlay(overlay, pageNumber, domain = 'general') {
        // Normalize box coordinates to 0-1000 range
        const box = overlay.box.map(v => {
            // If values are already in 0-1000, keep them
            if (v >= 0 && v <= 1000) {
                return Math.round(v);
            }
            // If values are 0-1 (normalized), scale to 0-1000
            if (v >= 0 && v <= 1) {
                return Math.round(v * 1000);
            }
            // Clamp to valid range
            return Math.min(1000, Math.max(0, Math.round(v)));
        });

        // Extract coordinates: box = [xmin, ymin, xmax, ymax]
        const [xmin, ymin, xmax, ymax] = box;

        // Get label (preserve original casing for display)
        const displayLabel = overlay.label.trim();
        const normalizedLabel = normalizeLabel(displayLabel);

        // Get domain-specific metadata
        const domainName = getDomainName(domain);
        const color = getColorForLabel(normalizedLabel, domain);
        const paperlessMapping = getPaperlessMapping(normalizedLabel, domain);
        const mandatory = isMandatoryField(normalizedLabel, domain);

        // Confidence with boost for mandatory fields
        let confidence = typeof overlay.confidence === 'number'
            ? Math.min(1, Math.max(0, overlay.confidence))
            : 0.5;

        return {
            // New Visual RAG format
            id: crypto.randomUUID(),
            label: displayLabel,
            value: overlay.text || null,
            domain: domainName,
            color: color,
            boundingBox: {
                x: xmin,
                y: ymin,
                width: xmax - xmin,
                height: ymax - ymin
            },
            paperlessMapping: paperlessMapping,
            isMandatory: mandatory,
            confidence: confidence,
            pageNumber: pageNumber,

            // Legacy format for backwards compatibility
            box: box,
            text: overlay.text || null,
            x_min: xmin,
            y_min: ymin,
            x_max: xmax,
            y_max: ymax
        };
    }

    /**
     * Unload the vision model to free VRAM
     * Called after extraction to allow other models to load
     */
    async unloadModel() {
        try {
            await this.client.post('/api/generate', {
                model: this.visionModel,
                keep_alive: 0  // Immediately unload
            });
            logger.debug(`[OverlayExtractor] Unloaded ${this.visionModel}`);
        } catch (error) {
            logger.warn(`[OverlayExtractor] Failed to unload model: ${error.message}`);
        }
    }
}

// Export singleton and class
const overlayExtractor = new OverlayExtractor();

module.exports = {
    OverlayExtractor,
    overlayExtractor,
    BOUNDING_BOX_PROMPT,
    DOMAIN_PROMPTS
};
