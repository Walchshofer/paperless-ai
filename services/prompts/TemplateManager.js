const { templateRegistry } = require('./TemplateRegistry');

class TemplateManager {
    constructor(registry = templateRegistry) {
        this.registry = registry;
    }

    getTemplate(intent, lang, fallbackLang) {
        if (!intent) return null;
        const normalizedIntent = String(intent).trim().toLowerCase();
        const normalizedLang = String(lang || '').trim().toLowerCase();
        const normalizedFallback = String(fallbackLang || '').trim().toLowerCase();

        if (normalizedLang) {
            const direct = this.registry.get(normalizedIntent, normalizedLang);
            if (direct) return direct;
        }

        if (normalizedFallback && normalizedFallback !== normalizedLang) {
            const fallback = this.registry.get(normalizedIntent, normalizedFallback);
            if (fallback) return fallback;
        }

        const candidates = this.registry.getByIntent(normalizedIntent);
        if (!candidates || candidates.length === 0) return null;

        const sorted = candidates.slice().sort((a, b) => a.lang.localeCompare(b.lang));
        return sorted[0] || null;
    }
}

const templateManager = new TemplateManager();

module.exports = {
    TemplateManager,
    templateManager
};
