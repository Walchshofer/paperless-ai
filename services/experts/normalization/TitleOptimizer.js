const logger = require('../../logger');

/**
 * TitleOptimizer
 * 
 * Implements title autocorrection and optimization rules defined in
 * docs/archive/dev/SMART_FILE_MANAGEMENT_STRATEGY.md
 */
class TitleOptimizer {
    constructor(config = {}) {
        this.config = {
            removePatterns: [
                /^Patrick Walchshofer\s*/i,
                /^Herr\s+Walchshofer\s+Patrick\s*/i,
                /\s+vom\s+\d{2}\.\d{2}\.\d{4}$/,  // "vom DD.MM.YYYY"
                /\s+-\s+Kopie$/,  // "- Kopie"
            ],
            replacements: {
                'Bestätigung über die Kostenerstattung': 'Kostenerstattung',
                'Information zu Ihrem': 'Info:',
                'Arbeitsunfähigkeitsmeldung': 'AU-Meldung',
                'Rechnung-Nr.': 'Rechnung',
            },
            maxLength: 80,
            addTagContext: true,
            ...config
        };
        
        this.template = '{{ created_year }} - {{ correspondent }} - {{ title }}';
    }

    /**
     * Optimize a document title based on rules
     * @param {string} title - The raw title (subject)
     * @param {Object} context - Context (tags, correspondent, created, etc.)
     * @returns {string} Optimized title
     */
    optimize(title, context = {}) {
        if (!title || typeof title !== 'string') return title;

        let optimized = title.trim();

        // 1. Remove redundant patterns
        for (const pattern of this.config.removePatterns) {
            optimized = optimized.replace(pattern, '').trim();
        }

        // 2. Apply replacements
        for (const [search, replace] of Object.entries(this.config.replacements)) {
            // Case-insensitive global replacement
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            optimized = optimized.replace(regex, replace).trim();
        }

        // 3. Apply Template (if context is available)
        if (this.template && (context.created || context.correspondent)) {
            optimized = this._applyTemplate(optimized, context);
        }

        // 4. Max Length truncation (after template application)
        if (optimized.length > this.config.maxLength) {
            optimized = optimized.substring(0, this.config.maxLength - 3) + '...';
        }

        return optimized;
    }

    _applyTemplate(title, context) {
        let createdYear = '';
        if (context.created) {
            const date = new Date(context.created);
            if (!isNaN(date.getTime())) {
                createdYear = date.getFullYear().toString();
            }
        }

        const correspondent = context.correspondent || '';
        const currentTitle = title || '';

        // If title is just a scan ID (e.g. SCN_...), treat it as empty for the purpose of the template
        // unless it's the ONLY info we have.
        const isScanId = /^SCN_|^Scan_|^Doc_|\.pdf$/i.test(currentTitle);
        const effectiveTitle = isScanId && (createdYear || correspondent) ? '' : currentTitle;

        let result = this.template
            .replace('{{ created_year }}', createdYear)
            .replace('{{ correspondent }}', correspondent)
            .replace('{{ title }}', effectiveTitle);

        // Cleanup: remove empty sections (e.g. " -  - Title" -> "Title")
        // 1. Remove double separators
        result = result.replace(/\s+-\s+-\s+/g, ' - ');
        // 2. Remove leading/trailing separators
        result = result.replace(/^\s*-\s+/, '').replace(/\s+-\s*$/, '');
        // 3. Cleanup multiple spaces
        result = result.replace(/\s{2,}/g, ' ').trim();

        // Fallback: If result is empty (e.g. only scan ID and no other metadata), return original
        if (!result && currentTitle) return currentTitle;

        return result;
    }
}

module.exports = { TitleOptimizer };
